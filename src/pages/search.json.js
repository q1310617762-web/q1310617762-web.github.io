import { getAllPosts } from '@utils/posts';

// 构建时生成站内搜索索引（静态 JSON，无外部依赖）
export const GET = async () => {
  const posts = await getAllPosts();
  const index = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
    category: p.category,
    tags: p.tags,
    date: p.pubDate.toISOString().slice(0, 10),
    text: (typeof p.body === 'string' ? p.body : `${p.title} ${p.description}`).slice(0, 6000),
  }));
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
};
