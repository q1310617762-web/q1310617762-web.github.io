// 缩略图路径映射
//
// 原图放在 public/<相册目录>/xxx.jpg（1600px、150~250KB），
// 缩略图由 scripts/optimize-images.mjs 生成到：
//   public/thumbs/480/<相册目录>/xxx.webp
//   public/thumbs/960/<相册目录>/xxx.webp
//
// 页面里的 <img src> 指向缩略图，data-src（灯箱大图）仍指向原图。
// 找不到缩略图时自动回退原图 —— 例如刚加进来还没跑优化脚本的图片，
// 宁可慢一点也不要 404 出现破图。
import fs from 'node:fs';
import path from 'node:path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

/** 原图路径 → 对应档位的缩略图路径（不做存在性检查） */
function toThumbPath(src: string, w: number): string {
  const i = src.lastIndexOf('/');
  if (i < 0) return src;
  const dir = src.slice(0, i);
  const file = src.slice(i + 1);
  const base = file.replace(/\.[^./]+$/, '');
  return `/thumbs/${w}${dir}/${base}.webp`;
}

/** 取某档位的缩略图；不存在则回退原图 */
export function thumb(src: string, w = 480): string {
  const t = toThumbPath(src, w);
  if (t === src) return src;
  const onDisk = path.join(PUBLIC_DIR, t.replace(/^\//, '').split('/').join(path.sep));
  return fs.existsSync(onDisk) ? t : src;
}

/** 生成 srcset 字符串；缺失的档位会被略过 */
export function thumbSet(src: string, widths: number[] = [480, 960]): string {
  return widths
    .map((w) => ({ w, url: thumb(src, w) }))
    .filter(({ url }) => url !== src)
    .map(({ w, url }) => `${url} ${w}w`)
    .join(', ');
}

/** 该图是否有任何可用缩略图 */
export function hasThumb(src: string): boolean {
  return thumb(src, 480) !== src || thumb(src, 960) !== src;
}
