// 微信二维码一键处理
//   用法 A（推荐）：把二维码图片丢进  E:\AI cahs\微信二维码  ，本脚本自动挑最新的一张
//   用法 B：node scripts/set-wechat.mjs "C:\某处\我的二维码.png"
// 处理结果写入 public/wechat.png，网站上的「微信」卡片会自动显示。
//
// 设计要点：
//   · 自动纠正手机截图的方向（EXIF rotate）
//   · 透明背景铺白（二维码必须有白底才能被扫出来）
//   · 等比缩放到最长边 720px，不放大（避免糊掉扫不出）
//   · 内容与已有的 wechat.png 完全一致时不写盘 —— 避免定时任务产生无意义的提交
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const DROP_DIR = path.resolve(ROOT, '..', '微信二维码'); // E:\AI cahs\微信二维码
const OUT = path.join(ROOT, 'public', 'wechat.png');
const EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.avif', '.tif', '.tiff']);

const say = (m) => console.log(m);

/** 找输入图片：命令行参数优先，否则取投递文件夹里最新的一张 */
function resolveInput() {
  const arg = process.argv[2];
  if (arg) {
    const p = path.resolve(arg);
    if (!fs.existsSync(p)) {
      console.error(`❌ 找不到文件：${p}`);
      process.exit(1);
    }
    return { file: p, name: path.basename(p) };
  }

  if (!fs.existsSync(DROP_DIR)) fs.mkdirSync(DROP_DIR, { recursive: true });

  const list = fs
    .readdirSync(DROP_DIR)
    .filter((f) => EXTS.has(path.extname(f).toLowerCase()))
    .map((f) => {
      const p = path.join(DROP_DIR, f);
      return { file: p, name: f, t: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.t - a.t);

  if (!list.length) return null;
  return list[0];
}

const input = resolveInput();

if (!input) {
  // 退出码 2 = 「没有二维码可处理」，属于正常情况，定时任务会当作跳过
  say(`ℹ️ ${DROP_DIR} 里还没有二维码图片，跳过`);
  process.exit(2);
}

let meta;
try {
  meta = await sharp(input.file).metadata();
} catch (e) {
  console.error(`❌ 无法读取图片（可能不是有效图片）：${e.message}`);
  process.exit(1);
}

const srcW = meta.width || 0;
const srcH = meta.height || 0;
const ratio = srcH ? srcW / srcH : 1;
if (ratio < 0.95 || ratio > 1.05) {
  say(`⚠️ 源图不是正方形（${srcW}×${srcH}）—— 二维码通常应以正方形保存。`);
  say('   若原图里二维码周围有多余界面，请先裁剪到只剩二维码（含四周留白）再放进来。');
}

const buf = await sharp(input.file)
  .rotate() // 按 EXIF 自动转正
  .flatten({ background: '#ffffff' }) // 透明 → 白底
  .resize(720, 720, { fit: 'inside', withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toBuffer();

const outMeta = await sharp(buf).metadata();

// 内容没变就不写盘（保持文件 mtime 不变，git 也就不会有变化）
let unchanged = false;
if (fs.existsSync(OUT)) {
  const old = fs.readFileSync(OUT);
  if (old.length === buf.length && crypto.createHash('sha1').update(old).digest('hex') === crypto.createHash('sha1').update(buf).digest('hex')) {
    unchanged = true;
  }
}

if (!unchanged) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buf);
}

say(`📷 源图：${input.name}  (${srcW}×${srcH})`);
say(`🖼️ 输出：public/wechat.png  (${outMeta.width}×${outMeta.height}, ${(buf.length / 1024).toFixed(1)} KB)`);
say(unchanged ? '✅ 与现有二维码一致，无需更新' : '✅ 已更新二维码');
process.exit(0);
