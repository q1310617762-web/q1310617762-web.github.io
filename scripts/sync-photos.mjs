// 同步「Saved Pictures」里的图片到博客相册
// 用法：npm run sync:photos
// 优化：记录每个文件的「修改时间+大小」签名，未变动的文件直接跳过读取
//       （这样每 30 分钟一次的检查非常轻量，不影响游戏等前台程序）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = process.env.PHOTO_DIR || 'C:/Users/VOS-User/Pictures/Saved Pictures';
const OUT_DIR = path.join(ROOT, 'public', 'photos');
const DATA_FILE = path.join(ROOT, 'src', 'data', 'photos.json');
const MAX_PHOTOS = Number(process.env.PHOTO_MAX || 60);
const MAX_WIDTH = 1600;

const IGNORE_DIRS = new Set(['博客壁纸', 'node_modules', '.git']);
const IMG_RE = /\.(jpg|jpeg|png|webp|bmp|gif|avif)$/i;

function walk(dir, out = []) {
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
      walk(p, out);
    } else if (IMG_RE.test(e.name)) {
      out.push(p);
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

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error('源目录不存在: ' + SRC);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 旧数据（含文件签名表，用于跳过未变动文件）
  let old = { items: [], signatures: {} };
  if (fs.existsSync(DATA_FILE)) {
    try {
      old = { signatures: {}, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
    } catch {}
  }

  const files = walk(SRC);
  const items = [];
  let converted = 0;
  let reused = 0;
  let skippedRead = 0;
  const signatures = {};

  for (const f of files) {
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
      hash = sig[2]; // 未修改 → 不读取文件内容
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

  items.sort((a, b) => b.mtime - a.mtime);
  const kept = items.slice(0, MAX_PHOTOS);
  const keptHashes = new Set(kept.map((i) => i.hash));

  // 清理不再需要的图片文件
  let removed = 0;
  for (const f of fs.readdirSync(OUT_DIR)) {
    const m = f.match(/^([0-9a-f]{12})\.jpg$/);
    if (m && !keptHashes.has(m[1])) {
      fs.unlinkSync(path.join(OUT_DIR, f));
      removed++;
    }
  }

  const newItems = kept.map(({ mtime, ...rest }) => rest);
  const oldItems = old.items || [];
  const unchanged =
    old.source === SRC &&
    oldItems.length === newItems.length &&
    JSON.stringify(oldItems) === JSON.stringify(newItems);

  const payload = {
    updatedAt: unchanged && old.updatedAt ? old.updatedAt : new Date().toISOString(),
    source: SRC,
    count: kept.length,
    total: items.length,
    items: newItems,
    signatures,
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');

  const size = fs.readdirSync(OUT_DIR).reduce((s, f) => s + fs.statSync(path.join(OUT_DIR, f)).size, 0);

  if (converted || removed || !unchanged) {
    console.log(
      `同步完成：相册 ${kept.length} 张（源 ${items.length} 张）| 新转换 ${converted}，复用 ${reused}，清理 ${removed}`
    );
    console.log(`  跳过读取（未变动）${skippedRead} 个文件 | 图片目录 ${(size / 1024 / 1024).toFixed(1)} MB`);
  } else {
    console.log(`无变化：相册 ${kept.length} 张 | 跳过读取 ${skippedRead} 个文件（轻量检查）`);
  }
})();
