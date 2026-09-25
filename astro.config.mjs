// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkGfm from 'remark-gfm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 站点地址：通过环境变量注入，方便不同托管平台使用
// - Vercel / Netlify / EdgeOne：站点在根路径，无需设置
// - GitHub Pages（项目页 https://<用户>.github.io/<仓库>/）：设置 SITE_URL 与 BASE_PATH
const site = process.env.SITE_URL || 'https://example.com';
const base = process.env.BASE_PATH || '/';

/**
 * 子路径兼容插件。
 * Astro 的 `base` 只改写它自身处理的资源，不会改写模板里写死的绝对路径
 * （如 /avatar.jpg、/blog/xxx、CSS 里的 url(/wallpaper.jpg)）。
 * 因此在 base != '/' 时，构建完成后统一为 HTML/CSS 中的站内绝对路径补上前缀，
 * 这样部署到 GitHub Pages 项目页也能正常显示。
 */
function basePathFixer() {
  return {
    name: 'base-path-fixer',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        if (base === '/' || base === '') {
          logger.info('base 为根路径，无需改写');
          return;
        }
        const prefix = base.replace(/\/+$/, '');
        const root = fileURLToPath(dir);

        const needsPrefix = (url) => !url.startsWith('//') && url !== prefix && !url.startsWith(prefix + '/');

        let htmlCount = 0;
        let cssCount = 0;

        const walk = (d) => {
          for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, entry.name);
            if (entry.isDirectory()) {
              walk(p);
            } else if (entry.name.endsWith('.html')) {
              const src = fs.readFileSync(p, 'utf8');
              const out = src.replace(/(\s(?:href|src)=")(\/[^"]*)"/g, (m, attr, url) =>
                needsPrefix(url) ? `${attr}${prefix}${url}"` : m
              );
              if (out !== src) {
                fs.writeFileSync(p, out, 'utf8');
                htmlCount++;
              }
            } else if (entry.name.endsWith('.css')) {
              const src = fs.readFileSync(p, 'utf8');
              const out = src.replace(/url\((\/[^)]*)\)/g, (m, url) =>
                needsPrefix(url) ? `url(${prefix}${url})` : m
              );
              if (out !== src) {
                fs.writeFileSync(p, out, 'utf8');
                cssCount++;
              }
            }
          }
        };
        walk(root);
        logger.info(`子路径改写完成：${htmlCount} 个 HTML、${cssCount} 个 CSS（前缀 ${prefix}）`);
      },
    },
  };
}

export default defineConfig({
  site,
  base,
  integrations: [mdx(), sitemap(), basePathFixer()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    remarkPlugins: [remarkGfm],
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
  prefetch: true,
});
