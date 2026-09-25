// 微信二维码一键处理
//   用法 A（推荐）：把二维码图片丢进  E:\AI cahs\微信二维码  ，本脚本自动挑最新的一张
//   用法 B：node scripts/set-wechat.mjs "C:\某处\我的二维码.png"
// 处理结果写入 public/wechat.png，网站上的「微信」卡片会自动显示。
//
// 处理流程：
//   1. 自动识别二维码位置 —— 微信导出的「名片卡」（头像+昵称+二维码+说明文字）
//      和手机截图都能自动裁出中间的二维码；本来就是干净方图的则原样使用
//   2. 四周补足白边（二维码必须留静区才能被扫出来）
//   3. 输出正方形 720×720 PNG
//   4. 内容与已有文件完全一致时不写盘 —— 避免定时任务产生无意义的提交
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const DROP_DIR = path.resolve(ROOT, '..', '微信二维码'); // E:\AI cahs\微信二维码
const OUT = path.join(ROOT, 'public', 'wechat.png');
const EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.avif', '.tif', '.tiff']);

const say = (m) => console.log(m);
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');

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

  return list[0] ?? null;
}

/**
 * 在灰度图里找出二维码的包围盒。
 * 依据：二维码区域「每一行的黑色像素既铺得很宽、占比又接近一半」，
 *       而头像（窄）、昵称/说明文字（同一行里黑色像素占比低）都不满足；
 *       再取满足条件的最长连续行带，即可稳定锁定二维码。
 * @returns {{left:number,top:number,width:number,height:number}|null}
 */
function detectQrBox(gray, W, H) {
  const DARK = 128;
  const pass = new Uint8Array(H);

  for (let y = 0; y < H; y++) {
    const base = y * W;
    let count = 0;
    let minX = -1;
    let maxX = -1;
    for (let x = 0; x < W; x++) {
      if (gray[base + x] < DARK) {
        count++;
        if (minX < 0) minX = x;
        maxX = x;
      }
    }
    if (minX < 0) continue;
    const span = maxX - minX + 1;
    const density = count / span;
    // 「像二维码的一行」：黑色像素铺得够宽（排除头像/昵称），
    // 且占比既不接近全白也不接近全黑（排除文字行与二维码的上下边框行）
    pass[y] = span > W * 0.3 && density >= 0.2 && density <= 0.8 ? 1 : 0;
  }

  // 容错分组：二维码内部存在「整行几乎全白、只有中间 logo」的行，
  // 会把它自己切成好几段，所以允许一定宽度的间隙把段并回来。
  const hits = [];
  for (let y = 0; y < H; y++) if (pass[y]) hits.push(y);
  if (!hits.length) return null;

  const maxGap = Math.max(12, Math.round(H * 0.04));
  const groups = [];
  let top = hits[0];
  let prev = hits[0];
  let n = 1;
  for (let i = 1; i < hits.length; i++) {
    if (hits[i] - prev <= maxGap) {
      n++;
      prev = hits[i];
    } else {
      groups.push({ top, bottom: prev, hits: n });
      top = hits[i];
      prev = hits[i];
      n = 1;
    }
  }
  groups.push({ top, bottom: prev, hits: n });
  for (const g of groups) {
    g.len = g.bottom - g.top + 1;
    g.ratio = g.hits / g.len;
  }

  // 选覆盖范围最大的那一段（二维码一定比一行文字高得多）
  const best = groups
    .filter((g) => g.len >= H * 0.12 && g.ratio >= 0.3)
    .sort((a, b) => b.len - a.len)[0];
  if (!best) return null;

  // 在选中的行带内求左右边界
  let colMin = -1;
  let colMax = -1;
  for (let x = 0; x < W; x++) {
    let c = 0;
    for (let y = best.top; y <= best.bottom; y++) {
      if (gray[y * W + x] < DARK) c++;
    }
    if (c / best.len >= 0.1) {
      if (colMin < 0) colMin = x;
      colMax = x;
    }
  }
  if (colMin < 0) return null;

  const width = colMax - colMin + 1;
  const height = best.len;
  const ratio = width / height;

  // 合理性检查：够大、接近正方形
  if (width < W * 0.15 || height < H * 0.15) return null;
  if (ratio < 0.75 || ratio > 1.34) return null;

  return { left: colMin, top: best.top, width, height, fill: best.ratio };
}

const input = resolveInput();

if (!input) {
  // 退出码 2 = 「没有二维码可处理」，属于正常情况，定时任务会当作跳过
  say(`ℹ️ ${DROP_DIR} 里还没有二维码图片，跳过`);
  process.exit(2);
}

// 统一转成灰度原始像素用于识别（顺带按 EXIF 转正）
let grayData;
try {
  grayData = await sharp(input.file)
    .rotate()
    .flatten({ background: '#ffffff' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
} catch (e) {
  console.error(`❌ 无法读取图片（可能不是有效图片）：${e.message}`);
  process.exit(1);
}

const W = grayData.info.width;
const H = grayData.info.height;
const box = detectQrBox(grayData.data, W, H);

let buf;
let desc;

if (box) {
  // 补足静区：四周各留约 9% 的白边，并输出成正方形
  const side = Math.max(box.width, box.height);
  const margin = Math.max(8, Math.round(side * 0.09));
  const target = side + margin * 2;
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const left = Math.round(cx - target / 2);
  const top = Math.round(cy - target / 2);

  // 先把正方形窗口与图像求交集，保证 extract 一定落在图内；
  // 超出的部分再由 extend 用白底补齐。
  // （sharp 的固定管线里 extract 先于 extend 执行，所以必须先夹取范围、再补白）
  const x0 = Math.max(0, left);
  const y0 = Math.max(0, top);
  const x1 = Math.min(W, left + target);
  const y1 = Math.min(H, top + target);
  const cw = Math.max(1, x1 - x0);
  const ch = Math.max(1, y1 - y0);

  const squared = await sharp(input.file)
    .rotate()
    .flatten({ background: '#ffffff' })
    .extract({ left: x0, top: y0, width: cw, height: ch })
    .extend({
      top: y0 - top,
      bottom: target - ch - (y0 - top),
      left: x0 - left,
      right: target - cw - (x0 - left),
      background: '#ffffff',
    })
    .png()
    .toBuffer();

  buf = await sharp(squared).resize(720, 720).png({ compressionLevel: 9 }).toBuffer();

  desc = `已从 ${W}×${H} 中裁出二维码 ${box.width}×${box.height}（占原图宽 ${((box.width / W) * 100).toFixed(0)}%），四周补白至 ${target}×${target}`;
} else {
  // 没识别出二维码：按「本来就是干净方图」处理，只做补白/缩放
  buf = await sharp(input.file)
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(720, 720, { fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  desc = `未识别出名片卡结构，按整张图处理（${W}×${H}）`;
  if (Math.abs(W / H - 1) > 0.05) {
    say(`⚠️ 源图不是正方形（${W}×${H}）—— 二维码通常应以正方形保存。`);
    say('   若二维码周围有多余界面，请先裁剪到只剩二维码再放进来。');
  }
}

const outMeta = await sharp(buf).metadata();

// 内容没变就不写盘（保持文件 mtime 不变，git 也就不会有变化）
let unchanged = false;
if (fs.existsSync(OUT)) {
  const old = fs.readFileSync(OUT);
  if (old.length === buf.length && sha1(old) === sha1(buf)) unchanged = true;
}

if (!unchanged) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buf);
}

say(`📷 源图：${input.name}  (${W}×${H})`);
say(`🔍 ${desc}`);
say(`🖼️ 输出：public/wechat.png  (${outMeta.width}×${outMeta.height}, ${(buf.length / 1024).toFixed(1)} KB)`);
say(unchanged ? '✅ 与现有二维码一致，无需更新' : '✅ 已更新二维码');
process.exit(0);
