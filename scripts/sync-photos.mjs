// 同步「Saved Pictures」里的图片到博客相册
// 用法：npm run sync:photos
//
// 两类图片：
//   1) 公开相册 —— 目录下的普通图片（除受保护目录），压缩后直接展示
//   2) 受保护相册 —— 「相片」等受保护目录下的图片，用口令派生密钥做 AES-256-GCM 加密，
//      网站上只存密文；没有口令无法解密（密钥只存在你本机的 photo-gate.config.json）
//
// 优化：记录文件「修改时间+大小」签名，未变动就不重复读取，每 30 分钟的检查非常轻量
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = process.env.PHOTO_DIR || 'C:/Users/VOS-User/Pictures/Saved Pictures';
const OUT_DIR = path.join(ROOT, 'public', 'photos');
const ENC_DIR = path.join(OUT_DIR, 'private');
const DATA_FILE = path.join(ROOT, 'src', 'data', 'photos.json');
const GATE_CFG = path.join(ROOT, 'photo-gate.config.json');
const MAX_PHOTOS = Number(process.env.PHOTO_MAX || 60);
const MAX_WIDTH = 1600;

// 完全不参与同步的目录（壁纸等）
const IGNORE_DIRS = new Set(['博客壁纸', 'node_modules', '.git']);
// 受保护目录（其中图片会被加密）
const GATED_DIRS = new Set(['相片', '私密', '真人']);

const IMG_RE = /\.(jpg|jpeg|png|webp|bmp|gif|avif)$/i;

// PBKDF2 参数（浏览器 WebCrypto 同样支持）
const PBKDF2_ITER = 210000;
const PBKDF2_HASH = 'sha256';
const KEY_LEN = 32;

function walk(dir, out = [], inGated = false) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      walk(p, out, inGated || GATED_DIRS.has(e.name));
    } else if (IMG_RE.test(e.name)) {
      out.push({ file: p, gated: inGated });
    }
  }
  return out;
}

const looksLikeHash = (name) =>
  /^[0-9a-f]{8,}$/i.test(name) ||
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name) ||
  /^image_\d+$/i.test(name) ||
  /^\{[0-9A-F-]{36}\}$/i.test(name) ||
  /^\d{8,}$/.test(name);

const fmtDate = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function loadGateConfig() {
  if (!fs.existsSync(GATE_CFG)) return null;
  try {
    // 去掉可能的 UTF-8 BOM（PowerShell 写文件时会带）
    const raw = fs.readFileSync(GATE_CFG, 'utf8').replace(/^\uFEFF/, '');
    const c = JSON.parse(raw);
    if (!c.answer) return null;
    return c;
  } catch {
    return null;
  }
}

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error('源目录不存在: ' + SRC);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(ENC_DIR, { recursive: true });

  let old = { items: [], signatures: {}, gated: null };
  if (fs.existsSync(DATA_FILE)) {
    try {
      old = { signatures: {}, gated: null, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
    } catch {}
  }

  const gate = loadGateConfig();
  const found = walk(SRC);
  const publicFiles = found.filter((f) => !f.gated).map((f) => f.file);
  const gatedFiles = found.filter((f) => f.gated).map((f) => f.file);

  const items = [];
  const gatedItems = [];
  let converted = 0;
  let reused = 0;
  let encrypted = 0;
  let skippedRead = 0;
  const signatures = {};
  const gatedSignatures = {};

  // ---------- 1) 公开图片 ----------
  for (const f of publicFiles) {
    let stat;
    try {
      stat = fs.statSync(f);
    } catch {
      continue;
    }
    const rel = path.relative(SRC, f).replace(/\\/g, '/');
    const sig = old.signatures[rel];
    const sameFile = Array.isArray(sig) && sig[0] === stat.mtimeMs && sig[1] === stat.size;

    let hash;
    if (sameFile) {
      hash = sig[2];
      skippedRead++;
    } else {
      let buf;
      try {
        buf = fs.readFileSync(f);
      } catch {
        continue;
      }
      hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
      const outName = `${hash}.jpg`;
      if (!fs.existsSync(path.join(OUT_DIR, outName))) {
        try {
          await sharp(buf)
            .resize({ width: MAX_WIDTH, withoutEnlargement: true })
            .jpeg({ quality: 80, mozjpeg: true })
            .toFile(path.join(OUT_DIR, outName));
          converted++;
        } catch (e) {
          console.log('  跳过（无法解析）: ' + path.basename(f) + ' — ' + e.message);
          continue;
        }
      } else {
        reused++;
      }
    }

    signatures[rel] = [stat.mtimeMs, stat.size, hash];
    const base = path.basename(f).replace(IMG_RE, '');
    const date = fmtDate(stat.mtime);
    items.push({
      hash,
      src: `/photos/${hash}.jpg`,
      title: looksLikeHash(base) ? date : base.slice(0, 40),
      date,
      desc: date,
      source: rel,
      mtime: stat.mtimeMs,
    });
  }

  // ---------- 2) 受保护图片（加密） ----------
  // 安全兜底：没有配置口令时，绝不把这些图片公开出去
  const gateChanged = !old.gated || old.gated.configStamp !== (gate ? gate.updatedAt : 'none');

  for (const f of gatedFiles) {
    let stat;
    try {
      stat = fs.statSync(f);
    } catch {
      continue;
    }
    const rel = path.relative(SRC, f).replace(/\\/g, '/');
    const sig = old.gated && old.gated.signatures ? old.gated.signatures[rel] : null;
    const sameFile = Array.isArray(sig) && sig[0] === stat.mtimeMs && sig[1] === stat.size;

    if (!gate) {
      // 无口令配置 → 跳过，不发布
      gatedSignatures[rel] = null;
      continue;
    }

    if (sameFile && !gateChanged) {
      // 未变动且口令未改 → 复用已有密文
      const id = sig[2];
      const encName = `${id}.enc`;
      if (fs.existsSync(path.join(ENC_DIR, encName))) {
        gatedSignatures[rel] = [stat.mtimeMs, stat.size, id, sig[3], sig[4]];
        const base = path.basename(f).replace(IMG_RE, '');
        const date = fmtDate(stat.mtime);
        gatedItems.push({
          id,
          src: `/photos/private/${encName}`,
          salt: sig[3],
          iv: sig[4],
          title: looksLikeHash(base) ? date : base.slice(0, 40),
          date,
          mtime: stat.mtimeMs,
        });
        skippedRead++;
        continue;
      }
    }

    let buf;
    try {
      buf = fs.readFileSync(f);
    } catch {
      continue;
    }

    // 先压到合理尺寸再加密（减小体积，且不泄露原图）
    let plain;
    try {
      plain = await sharp(buf)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
    } catch (e) {
      console.log('  跳过（无法解析）: ' + path.basename(f) + ' — ' + e.message);
      continue;
    }

    const id = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = crypto.pbkdf2Sync(gate.answer, salt, PBKDF2_ITER, KEY_LEN, PBKDF2_HASH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);

    fs.writeFileSync(path.join(ENC_DIR, `${id}.enc`), enc);
    encrypted++;

    const saltB64 = salt.toString('base64');
    const ivB64 = iv.toString('base64');
    gatedSignatures[rel] = [stat.mtimeMs, stat.size, id, saltB64, ivB64];

    const base = path.basename(f).replace(IMG_RE, '');
    const date = fmtDate(stat.mtime);
    gatedItems.push({
      id,
      src: `/photos/private/${id}.enc`,
      salt: saltB64,
      iv: ivB64,
      title: looksLikeHash(base) ? date : base.slice(0, 40),
      date,
      mtime: stat.mtimeMs,
    });
  }

  // ---------- 3) 整理与清理 ----------
  items.sort((a, b) => b.mtime - a.mtime);
  gatedItems.sort((a, b) => b.mtime - a.mtime);
  const kept = items.slice(0, MAX_PHOTOS);
  const keptHashes = new Set(kept.map((i) => i.hash));
  const keptGatedIds = new Set(gatedItems.map((i) => i.id));

  let removed = 0;
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (!f.endsWith('.jpg')) continue;
    const m = f.match(/^([0-9a-f]{12})\.jpg$/);
    if (m && !keptHashes.has(m[1])) {
      fs.unlinkSync(path.join(OUT_DIR, f));
      removed++;
    }
  }
  for (const f of fs.readdirSync(ENC_DIR)) {
    const m = f.match(/^([0-9a-f]{12})\.enc$/);
    if (m && !keptGatedIds.has(m[1])) {
      fs.unlinkSync(path.join(ENC_DIR, f));
      removed++;
    }
  }

  const newItems = kept.map(({ mtime, ...rest }) => rest);
  const oldItems = old.items || [];
  const newGated = gatedItems.map(({ mtime, ...rest }) => rest);
  const oldGatedItems = (old.gated && old.gated.items) || [];

  const unchanged =
    old.source === SRC &&
    oldItems.length === newItems.length &&
    JSON.stringify(oldItems) === JSON.stringify(newItems) &&
    JSON.stringify(oldGatedItems) === JSON.stringify(newGated);

  const payload = {
    updatedAt: unchanged && old.updatedAt ? old.updatedAt : new Date().toISOString(),
    source: SRC,
    count: kept.length,
    total: items.length,
    items: newItems,
    signatures,
    gated: {
      enabled: !!gate,
      question: gate ? gate.question : '',
      hint: gate ? gate.hint || '' : '',
      configStamp: gate ? gate.updatedAt : 'none',
      count: newGated.length,
      items: newGated,
      signatures: gatedSignatures,
    },
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');

  // ---------- 4) 输出摘要 ----------
  const pubSize = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.jpg')).reduce((s, f) => s + fs.statSync(path.join(OUT_DIR, f)).size, 0);
  const encSize = fs.readdirSync(ENC_DIR).reduce((s, f) => s + fs.statSync(path.join(ENC_DIR, f)).size, 0);

  if (!gate && gatedFiles.length > 0) {
    console.log(`⚠️  检测到 ${gatedFiles.length} 张受保护图片，但尚未设置口令 —— 已跳过（不会公开）`);
    console.log('   请先运行：npm run set:gate');
  }

  if (converted || encrypted || removed || !unchanged) {
    console.log(`同步完成：公开 ${kept.length} 张（源 ${items.length} 张）| 加密 ${newGated.length} 张`);
    console.log(`  新转换 ${converted}，复用 ${reused}，新加密 ${encrypted}，清理 ${removed}`);
    console.log(`  公开 ${(pubSize / 1024 / 1024).toFixed(1)} MB | 密文 ${(encSize / 1024 / 1024).toFixed(1)} MB | 跳过读取 ${skippedRead} 个`);
  } else {
    console.log(`无变化：公开 ${kept.length} 张，加密 ${newGated.length} 张 | 跳过读取 ${skippedRead} 个文件（轻量检查）`);
  }
})();
