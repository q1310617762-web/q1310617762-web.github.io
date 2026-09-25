# 我的个人博客

一个基于 **Astro + Tailwind CSS** 的静态个人博客。内容用 Markdown 编写，开箱即用、SEO 友好、加载极快。

## 功能

- 文章列表 / 分页 / 详情
- 分类、标签、归档页
- 站内代码高亮（Shiki）+ 复制按钮
- 深色模式（明暗切换、无闪烁）
- 上一篇 / 下一篇、相关文章
- 文章目录 TOC（大屏右侧 sticky）
- RSS 订阅、Sitemap、SEO / Open Graph
- 返回顶部、卡片 hover 动效

## 目录结构

```
src/
├─ components/    设计系统 UI + 布局 + 博客业务组件
├─ content/posts/ Markdown 文章
├─ content.config.ts  内容集合 schema 校验
├─ data/site.ts   站点配置（作者/导航/社交）
├─ layouts/       全站基础布局
├─ pages/         各页面与路由
├─ utils/posts.ts 内容工具函数
└─ styles/        设计令牌 + 全局样式
```

## 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 本地开发 http://localhost:4321
npm run build      # 构建到 dist/
npm run preview    # 本地预览 dist/
```

## 写文章

在 `src/content/posts/` 新增 `.md` 文件，Frontmatter 字段：

```md
---
title: 标题
description: 摘要
pubDate: 2025-01-01
category: 前端
tags: [Astro, 博客]
cover: /placeholder.svg   # 可选
draft: false              # 草稿不发布
featured: false           # 是否精选
---

正文 Markdown……
```

## 部署

静态产物在 `dist/`，可直接部署到 Vercel / Netlify / GitHub Pages。

> 记得把 `src/data/site.ts` 与 `astro.config.mjs` 里的 `site` 地址换成你的真实域名。
