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

/** 取今天起的前 N 天（默认 3 天），每天最多 maxPerDay 部 */
export function getAnimeSchedule(days = 3, maxPerDay = 5): AnimeDay[] {
  return (animeData.days || [])
    .slice(0, days)
    .map((d) => ({ ...d, episodes: d.episodes.slice(0, maxPerDay) }));
}

/** 今天更新的番剧 */
export function getTodayAnime(): AnimeEpisode[] {
  const today = (animeData.days || []).find((d) => d.isToday);
  return today ? today.episodes : [];
}

/** 数据抓取时间的友好显示 */
export function getAnimeUpdatedLabel(): string {
  if (!animeData.fetchedAt) return '';
  const d = new Date(animeData.fetchedAt);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
