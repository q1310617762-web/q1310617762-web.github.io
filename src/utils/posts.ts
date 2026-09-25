import { getCollection } from 'astro:content';

export type Post = {
  id: string;
  slug: string;
  title: string;
  description: string;
  pubDate: Date;
  updatedDate?: Date;
  category: string;
  tags: string[];
  cover?: string;
  draft: boolean;
  featured: boolean;
  body?: string;
};

/**
 * 读取所有文章并按发布日期倒序。
 * 可选的过滤参数用于按分类/标签过滤，同时排除草稿。
 */
export async function getAllPosts(
  filter?: { category?: string; tag?: string; featured?: boolean }
): Promise<Post[]> {
  let posts = await getCollection('posts', ({ data }) => {
    if (data.draft) return false;
    if (filter?.category && data.category !== filter.category) return false;
    if (filter?.tag && !data.tags.includes(filter.tag)) return false;
    if (filter?.featured && !data.featured) return false;
    return true;
  });

  return posts
    .map((post) => ({
      ...post.data,
      slug: post.id,
      body: typeof post.body === 'string' ? post.body : undefined,
    }))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

/** 统计所有标签（去重并按数量排序） */
export async function getAllTags(): Promise<{ name: string; count: number }[]> {
  const posts = await getAllPosts();
  const map = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.tags) map.set(t, (map.get(t) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** 统计所有分类 */
export async function getAllCategories(): Promise<{ name: string; count: number }[]> {
  const posts = await getAllPosts();
  const map = new Map<string, number>();
  for (const p of posts) map.set(p.category, (map.get(p.category) ?? 0) + 1);
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** 按年份归档 */
export async function getArchive(): Promise<{ year: string; posts: Post[] }[]> {
  const posts = await getAllPosts();
  const map = new Map<string, Post[]>();
  for (const p of posts) {
    const y = p.pubDate.getFullYear().toString();
    if (!map.has(y)) map.set(y, []);
    map.get(y)!.push(p);
  }
  return [...map.entries()]
    .map(([year, posts]) => ({ year, posts }))
    .sort((a, b) => b.year.localeCompare(a.year));
}

/** 日期格式化 */
export function formatDate(date: Date, locale: string = 'zh-CN'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/** 估算阅读时长（分钟） */
export function readingTime(text: string | undefined): string {
  if (!text) return '1 分钟';
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words = (text.match(/[a-zA-Z]+/g) || []).length;
  const minutes = Math.max(1, Math.round(cjk / 400 + words / 200));
  return `${minutes} 分钟`;
}

/** 生成文章 slug 对应的 URL */
export function postUrl(slug: string): string {
  return `/blog/${slug}`;
}
