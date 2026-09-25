// 同步「Saved Pictures」里的图片到博客相册
// 用法：npm run sync:photos
// 逻辑：扫描源目录 → 按内容哈希去重 → 压缩为网页尺寸 → 生成 src/data/photos.json
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

// 不参与同步的子目录
const IGNORE_DIRS = new Set(['博客壁纸', 'node_modules', '.git']);

const IMG_RE = /\.(jpg|jpeg|png|webp|bmp|gif|avif)$/i;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
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

  const files = walk(SRC);
  console.log(`扫描到 ${files.length} 张图片（源：${SRC}）`);

  // 读旧数据，保留已导入的哈希（避免重复压缩）
  let old = { items: [] };
  if (fs.existsSync(DATA_FILE)) {
    try {
      old = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {}
  }
  const known = new Map((old.items || []).map((i) => [i.hash, i]));

  const items = [];
  let converted = 0;
  let reused = 0;

  for (const f of files) {
    let buf;
    try {
      buf = fs.readFileSync(f);
    } catch {
      continue;
    }
    const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
    const outName = `${hash}.jpg`;
    const outPath = path.join(OUT_DIR, outName);

    const base = path.basename(f).replace(IMG_RE, '');
    const stat = fs.statSync(f);
    const date = fmtDate(stat.mtime);
    const title = looksLikeHash(base) ? date : base.slice(0, 40);

    if (!fs.existsSync(outPath)) {
      try {
        await sharp(buf)
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: 80, mozjpeg: true })
          .toFile(outPath);
        converted++;
      } catch (e) {
        console.log('  跳过（无法解析）: ' + path.basename(f) + ' — ' + e.message);
        continue;
      }
    } else {
      reused++;
    }

    items.push({
      hash,
      src: `/photos/${outName}`,
      title,
      date,
      desc: date,
      source: path.relative(SRC, f).replace(/\\/g, '/'),
      mtime: stat.mtimeMs,
    });
  }

  // 按修改时间倒序（新的在前），并限制数量
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

  const payload = {
    updatedAt: new Date().toISOString(),
    source: SRC,
    count: kept.length,
    total: items.length,
    items: kept.map(({ mtime, ...rest }) => rest),
  };
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');

  const size = fs
    .readdirSync(OUT_DIR)
    .reduce((s, f) => s + fs.statSync(path.join(OUT_DIR, f)).size, 0);

  console.log(`完成：相册共 ${kept.length} 张（源共 ${items.length} 张，超出上限的旧图不展示）`);
  console.log(`  新转换 ${converted} 张，复用 ${reused} 张，清理 ${removed} 张`);
  console.log(`  图片目录占用：${(size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  数据文件：src/data/photos.json`);
})();
