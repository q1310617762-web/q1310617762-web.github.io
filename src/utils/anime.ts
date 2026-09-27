// 新番更新数据（由 scripts/fetch-anime.mjs 生成，构建时静态读取）
import data from '@data/anime-data.json';

export interface AnimeEpisode {
  id: string;
  title: string;
  index: string;
  time: string;
  cover: string;
  seasonId: number;
  url: string;
  delay: string;
}

export interface AnimeDay {
  date: string;
  dateTs: number;
  weekday: string;
  isToday: boolean;
  episodes: AnimeEpisode[];
}

export interface AnimeData {
  fetchedAt: string;
  total: number;
  days: AnimeDay[];
}

export const animeData = data as AnimeData;

/**
 * 把 B 站图床的原图 URL 换成立即缩略图。
 *
 * 为什么必须做：B 站时间线给的封面是原始大图，实测 18 张合计 5.3 MB，
 * 其中最大一张 3.5 MB —— 而页面上这些封面只显示 34×46 px。
 * 图床支持在 URL 后追加 `@宽w_高h_裁剪_格式` 直接出缩略图，
 * 实测同样 18 张合计降到 102 KB（省 98%），且全部返回 WebP。
 *
 * 非 B 站图床（或已经带过后缀）的地址原样返回。
 */
export function animeCoverThumb(cover: string, width = 120, height = 162): string {
  if (!cover) return cover;
  if (!/^https?:\/\/[^/]*hdslb\.com\//i.test(cover)) return cover;
  if (cover.includes('@')) return cover; // 已经有了，别叠加
  return `${cover}@${width}w_${height}h_1c.webp`;
}

/** 取今天起的前 N 天（默认 3 天），每天最多 maxPerDay 部 */
export function getAnimeSchedule(days = 3, maxPerDay = 5): AnimeDay[] {
  return (animeData.days || []).slice(0, days).map((d) => ({
    ...d,
    episodes: d.episodes.slice(0, maxPerDay).map((ep) => ({
      ...ep,
      cover: animeCoverThumb(ep.cover),
    })),
  }));
}

/** 今天更新的番剧 */
export function getTodayAnime(): AnimeEpisode[] {
  const today = (animeData.days || []).find((d) => d.isToday);
  return today ? today.episodes.map((ep) => ({ ...ep, cover: animeCoverThumb(ep.cover) })) : [];
}

/** 数据抓取时间的友好显示 */
export function getAnimeUpdatedLabel(): string {
  if (!animeData.fetchedAt) return '';
  const d = new Date(animeData.fetchedAt);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
