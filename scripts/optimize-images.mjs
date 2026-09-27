// 生成 WebP 缩略图
//
// 背景：public/ 里的原图都是 1600px 级别（单张 150~250KB），但页面上
// 实际只显示 224px（首页图片条）到 300px 级（相册网格）——相当于为了
// 一张缩略图下载了 8 倍的像素。GitHub Pages 从国内访问又被限速到
// ~80KB/s，所以首页会被这几十张图拖到 20 秒以上。
//
// 做法：为每张原图额外生成两档 WebP 缩略图，页面用 srcset 让浏览器挑：
//   public/thumbs/480/<原目录>/<原名>.webp   约 15~30KB  —— 首页图片条 / 手机
//   public/thumbs/960/<原目录>/<原名>.webp   约 50~90KB  —— 相册网格 / 高分屏
// 原图仍然保留：灯箱大图、以及缩略图缺失时的兜底，都指向原图。
//
// 特性：增量处理（源文件没变就跳过）、并发受限、结束后打印省下多少体积。
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const THUMBS = path.join(PUBLIC, 'thumbs');

// 需要生成的档位（宽度）与质量
const SIZES = [
  { w: 480, quality: 76 },
  { w: 960, quality: 78 },
];

// 要处理的来源目录（相对 public/）
const SOURCES = ['gallery', 'games', 'photos'];
// 跳过的子目录（加密相册的密文不是图片；缩略图本身也不处理）
const SKIP_DIRS = new Set(['private', 'thumbs']);
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

let processed = 0;
let skipped = 0;
let srcBytes = 0;
let outBytes = 0;
const failures = [];

/** 递归收集源图片 */
function collect(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collect(p, out);
    } else if (EXTS.has(path.extname(entry.name).toLowerCase())) {
      out.push(p);
    }
  }
  return out;
}

async function handle(srcPath) {
  const rel = path.relative(PUBLIC, srcPath); // 如 gallery\genshin-01.jpg
  const relDir = path.dirname(rel);
  const base = path.basename(rel, path.extname(rel));
  const srcStat = fs.statSync(srcPath);

  let meta;
  try {
    meta = await sharp(srcPath).metadata();
  } catch (e) {
    failures.push(`${rel}: ${e.message}`);
    return;
  }
  if (!meta.width) return;

  let madeSomething = false;

  for (const { w, quality } of SIZES) {    // 原图本身就比目标还小，就不放大了
    if (meta.width <= w * 1.02) continue;

    const outPath = path.join(THUMBS, String(w), relDir, `${base}.webp`);
    // 增量判断：缩略图比源图新就跳过
    if (fs.existsSync(outPath)) {
      const outStat = fs.statSync(outPath);
      if (outStat.mtimeMs >= srcStat.mtimeMs) {
        srcBytes += srcStat.size;
        outBytes += outStat.size;
        skipped++;
        continue;
      }
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    try {
      const buf = await sharp(srcPath)
        .rotate()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toBuffer();
      fs.writeFileSync(outPath, buf);
      srcBytes += srcStat.size;
      outBytes += buf.length;
      processed++;
      madeSomething = true;
    } catch (e) {
      failures.push(`${rel} @${w}: ${e.message}`);
    }
  }

  if (!madeSomething && !failures.length) {
    // 已经是最新的（或原图太小），不做任何事
  }
}

const files = [];
for (const s of SOURCES) files.push(...collect(path.join(PUBLIC, s)));

if (!files.length) {
  console.log('没有需要处理的图片');
  process.exit(0);
}

fs.mkdirSync(THUMBS, { recursive: true });

// 并发 4 路，避免一次性开太多 sharp 任务
const queue = [...files];
const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
  while (queue.length) {
    const f = queue.shift();
    if (f) await handle(f);
  }
});
await Promise.all(workers);

const kb = (n) => (n / 1024).toFixed(0);

// ---- public/ 根目录下的装饰图 ----
// 壁纸是通过 CSS 铺满全屏（background: cover）、且只用 10~20% 不透明度
// 显示的纯装饰图，所以缩到 1280 宽、质量降到 58 也看不出区别，
// 实测 259KB → 约 72KB。想更清晰就把 width/quality 调大后重跑本脚本。
const ROOT_WEBP = [
  { src: 'wallpaper.jpg', out: 'wallpaper.webp', width: 1280, quality: 58 },
  { src: 'wallpaper-dark.jpg', out: 'wallpaper-dark.webp', width: 1280, quality: 58 },
];

for (const item of ROOT_WEBP) {
  const srcPath = path.join(PUBLIC, item.src);
  if (!fs.existsSync(srcPath)) continue;
  const outPath = path.join(PUBLIC, item.out);
  const srcStat = fs.statSync(srcPath);
  if (fs.existsSync(outPath) && fs.statSync(outPath).mtimeMs >= srcStat.mtimeMs) continue;
  try {
    const buf = await sharp(srcPath)
      .resize({ width: item.width, withoutEnlargement: true })
      .webp({ quality: item.quality, effort: 5 })
      .toBuffer();
    fs.writeFileSync(outPath, buf);
    processed++;
    console.log(`  ${item.src} ${kb(srcStat.size)}KB → ${item.out} ${kb(buf.length)}KB`);
  } catch (e) {
    failures.push(`${item.src}: ${e.message}`);
  }
}
if (failures.length) {
  console.log(`⚠️ ${failures.length} 张处理失败：`);
  for (const f of failures.slice(0, 10)) console.log(`   ${f}`);
}

const saved = srcBytes > 0 ? (100 - (outBytes / srcBytes) * 100).toFixed(0) : '0';
if (processed === 0) {
  console.log(`缩略图已是最新（跳过 ${skipped} 档）| 当前缩略图总体积比原图小 ${saved}%`);
} else {
  console.log(`生成 ${processed} 个缩略图，跳过 ${skipped} 个已最新的 | 原图 ${kb(srcBytes)}KB → 缩略图 ${kb(outBytes)}KB，省 ${saved}%`);
}
process.exit(0);
