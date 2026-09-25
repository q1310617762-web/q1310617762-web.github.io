// 自动同步的相册数据（由 scripts/sync-photos.mjs 生成）
import data from '@data/photos.json';

export interface PhotoItem {
  hash: string;
  src: string;
  title: string;
  date: string;
  desc: string;
  source: string;
}

export interface GatedItem {
  id: string;
  src: string;
  salt: string;
  iv: string;
  title: string;
  date: string;
}

export interface GatedAlbum {
  enabled: boolean;
  question: string;
  hint: string;
  configStamp: string;
  count: number;
  items: GatedItem[];
}

export interface PhotoData {
  updatedAt: string;
  source: string;
  count: number;
  total: number;
  items: PhotoItem[];
  gated?: GatedAlbum;
}

export const photoData = data as PhotoData;

/** 公开相册「随手拍」；无图片时返回 null */
export function getPhotoAlbum() {
  if (!photoData.items || photoData.items.length === 0) return null;
  return {
    name: '随手拍',
    desc: '来自 Saved Pictures · 自动同步',
    items: photoData.items.map((p) => ({ src: p.src, title: p.title, desc: p.date })),
  };
}

/** 受保护相册（加密，需口令）；未启用或无图片时返回 null */
export function getGatedAlbum(): GatedAlbum | null {
  const g = photoData.gated;
  if (!g || !g.enabled || !g.items || g.items.length === 0) return null;
  return g;
}

export function getPhotoUpdatedLabel(): string {
  if (!photoData.updatedAt) return '';
  const d = new Date(photoData.updatedAt);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
