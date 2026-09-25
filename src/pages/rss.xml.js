import rss from '@astrojs/rss';
import { getAllPosts } from '@utils/posts';
import { site } from '@data/site';

export const GET = async () => {
  const posts = await getAllPosts();
  return rss({
    title: site.title,
    description: site.description,
    site: site.url,
    items: posts.map((p) => ({
      title: p.title,
      description: p.description,
      pubDate: p.pubDate,
      link: `/blog/${p.slug}`,
    })),
    customData: '<language>zh-CN</language>',
  });
};
