// 站点全局配置：作者、导航、社交、SEO 信息。所有页面与组件共享这份数据。
export const site = {
  title: '东芽果DYG 的博客',
  tagline: '收录游戏与音乐',
  description: '东芽果DYG 的个人博客：记录喜欢的游戏、游戏原声，以及日常想法。',
  author: '东芽果DYG',
  url: 'https://example.com',
  lang: 'zh-CN',
  avatar: '/avatar.jpg',
  email: 'q1310617762@gmail.com',
  keywords: ['东芽果DYG', '博客', '游戏', '原神', '崩坏星穹铁道', '游戏音乐', 'B站'],
} as const;

// 联系方式（首页与「关于」页展示）
export const contacts = [
  {
    label: 'Bilibili',
    value: '东芽果DYG',
    href: 'https://space.bilibili.com/14184207',
    icon: 'bilibili',
  },
  {
    label: 'QQ',
    value: '1310617762',
    href: 'https://wpa.qq.com/msgrd?v=3&uin=1310617762&site=qq&menu=yes',
    icon: 'qq',
  },
  {
    label: '邮箱',
    value: 'q1310617762@gmail.com',
    href: 'mailto:q1310617762@gmail.com',
    icon: 'mail',
  },
] as const;

// 微信（二维码图片放到 public/wechat.png 即可生效）
export const wechat = {
  id: 'a1310617762', // 你的微信号；留空则显示「待填写」
  qr: '/wechat.png', // 二维码图片路径（默认 public/wechat.png）
  note: '添加好友请备注「博客」',
  enabled: true,
} as const;

// 导航链接
export const nav = [
  { label: '首页', href: '/' },
  { label: '博客', href: '/blog' },
  { label: '相册', href: '/gallery' },
  { label: '归档', href: '/archive' },
  { label: '友链', href: '/friends' },
  { label: '关于', href: '/about' },
] as const;

// 相册（多相册结构，在 /gallery 页按相册分组展示）
export const albums = [
  {
    name: '原神',
    desc: '提瓦特的旅途',
    items: [
      { src: '/gallery/genshin-01.jpg', title: '雪地合影', desc: '原神 · 2026-08-25' },
      { src: '/gallery/genshin-02.jpg', title: '雪村广场', desc: '原神 · 2026-08-17' },
      { src: '/gallery/genshin-03.jpg', title: '星空浮岛', desc: '原神 · 2026-05-21' },
      { src: '/gallery/genshin-04.jpg', title: '璃月夜色', desc: '原神 · 2026-02-03' },
      { src: '/gallery/genshin-05.jpg', title: '桥边荷塘', desc: '原神 · 2026-02-02' },
      { src: '/gallery/genshin-06.jpg', title: '稻妻灯笼夜', desc: '原神 · 2026-02-02' },
      { src: '/gallery/genshin-07.jpg', title: '港口晴空', desc: '原神 · 2026-02-02' },
      { src: '/gallery/genshin-08.jpg', title: '剧情对话 ①', desc: '原神 · 2025-10-05' },
      { src: '/gallery/genshin-09.jpg', title: '剧情对话 ②', desc: '原神 · 2025-10-05' },
      { src: '/gallery/genshin-10.jpg', title: '剧情对话 ③', desc: '原神 · 2025-10-05' },
      { src: '/gallery/genshin-11.jpg', title: '剧情对话 ④', desc: '原神 · 2025-10-05' },
      { src: '/gallery/genshin-12.jpg', title: '剧情对话 ⑤', desc: '原神 · 2025-10-05' },
    ],
  },
  {
    name: '崩坏：星穹铁道',
    desc: '星海列车沿途的风景',
    items: [
      { src: '/gallery/starrail-01.jpg', title: '剧院大厅', desc: '星穹铁道 · 2026-09-17' },
      { src: '/gallery/starrail-02.jpg', title: '猩红天穹', desc: '星穹铁道 · 2026-09-17' },
      { src: '/gallery/starrail-03.jpg', title: '黄金裂痕', desc: '星穹铁道 · 2026-09-17' },
      { src: '/gallery/starrail-04.jpg', title: '水镜星环', desc: '星穹铁道 · 2026-09-17' },
      { src: '/gallery/starrail-05.jpg', title: '紫色星门', desc: '星穹铁道 · 2026-09-17' },
      { src: '/gallery/starrail-06.jpg', title: '天空的巨影', desc: '星穹铁道 · 2026-09-17' },
      { src: '/gallery/starrail-07.jpg', title: '樱色庭院', desc: '星穹铁道 · 2026-09-17' },
      { src: '/gallery/starrail-08.jpg', title: '巨舰俯瞰', desc: '星穹铁道 · 2026-09-17' },
      { src: '/gallery/starrail-09.jpg', title: '星穹列车 · 车厢', desc: '星穹铁道 · 2026-09-17' },
      { src: '/gallery/starrail-10.jpg', title: '倒悬之城', desc: '星穹铁道 · 2026-09-17' },
    ],
  },
  {
    name: '绝区零',
    desc: '新艾利都的街头与空洞',
    items: [
      { src: '/gallery/zzz-01.jpg', title: '街头特写', desc: '绝区零 · 2026-08-31' },
      { src: '/gallery/zzz-02.jpg', title: '巷口的阳光', desc: '绝区零 · 2026-08-28' },
      { src: '/gallery/zzz-03.jpg', title: '夏日合影 Summer Vibe', desc: '绝区零 · 2026-08-24' },
      { src: '/gallery/zzz-04.jpg', title: '暗夜之翼', desc: '绝区零 · 2026-08-14' },
      { src: '/gallery/zzz-05.jpg', title: '卫非半岛 · 合影', desc: '绝区零 · 2026-02-16' },
      { src: '/gallery/zzz-06.jpg', title: '偶像合影 ANGELS', desc: '绝区零 · 2026-02-07' },
      { src: '/gallery/zzz-07.jpg', title: '拍立得 · 黄昏', desc: '绝区零 · 2025-12-12' },
      { src: '/gallery/zzz-08.jpg', title: '沸土 · 与邦布合影', desc: '绝区零 · 2025-11-13' },
      { src: '/gallery/zzz-09.jpg', title: '码头合影', desc: '绝区零 · 2025-11-06' },
      { src: '/gallery/zzz-10.jpg', title: '战斗瞬间 ①', desc: '绝区零 · 2025-10-31' },
      { src: '/gallery/zzz-11.jpg', title: '战斗瞬间 ②', desc: '绝区零 · 2025-10-31' },
      { src: '/gallery/zzz-12.jpg', title: '战斗瞬间 ③', desc: '绝区零 · 2025-10-31' },
      { src: '/gallery/zzz-13.jpg', title: '水族馆前', desc: '绝区零 · 2025-10-09' },
      { src: '/gallery/zzz-14.jpg', title: '广场入口', desc: '绝区零 · 2025-05-28' },
      { src: '/gallery/zzz-15.jpg', title: '星环塔大厅', desc: '绝区零 · 2025-05-28' },
      { src: '/gallery/zzz-16.jpg', title: '夜色的阶梯', desc: '绝区零 · 2025-05-28' },
      { src: '/gallery/zzz-17.jpg', title: 'Reverb Arena · 合影', desc: '绝区零 · 2025-05-14' },
      { src: '/gallery/zzz-18.jpg', title: '爱丽丝港 · 合影', desc: '绝区零 · 2025-03-01' },
      { src: '/gallery/zzz-19.jpg', title: '空洞战斗', desc: '绝区零 · 2025-02-10' },
    ],
  },
];

// 首页「图片」栏用的平铺列表（取前几张）
export const gallery = albums.flatMap((a) => a.items);

// 友情链接（在 /friends 页展示）
export const friends = [
  { name: 'Astro', url: 'https://astro.build', desc: '内容驱动的 Web 框架' },
  { name: 'Tailwind CSS', url: 'https://tailwindcss.com', desc: 'Utility-first CSS 框架' },
  { name: 'GitHub', url: 'https://github.com', desc: '全球最大的代码托管平台' },
  { name: 'MDN', url: 'https://developer.mozilla.org', desc: 'Web 技术权威文档' },
] as const;

// 社交链接
export const social = [
  { label: 'Bilibili', href: 'https://space.bilibili.com/14184207', icon: 'bilibili' },
  { label: 'QQ', href: 'https://wpa.qq.com/msgrd?v=3&uin=1310617762&site=qq&menu=yes', icon: 'qq' },
  { label: '邮箱', href: 'mailto:q1310617762@gmail.com', icon: 'mail' },
  { label: 'RSS', href: '/rss.xml', icon: 'rss' },
] as const;

// 首页 Hero 介绍
export const hero = {
  greeting: '你好，我是东芽果DYG 👋',
  headline: '在游戏与音乐里寄存日常',
  sub: '游戏 · 音乐 · 日常随笔 · 二次元杂谈',
  lead: '把喜欢的东西，认真记下来。',
  ctas: [
    { label: '看我的文章', href: '/blog' },
    { label: '了解我', href: '/about' },
  ],
} as const;

// 音乐播放器曲单
// src 可以是站内文件（如 /music/song.mp3，放入 public/music/）或外部音频地址。
// 留空数组则不显示播放器。
export const music = [
  { title: '至冬 Snezhnaya', artist: 'HOYO-MiX · 原神（至冬主题曲）', src: '/music/snezhnaya-theme.m4a' },
  { title: '零露漙然 Heavy Is the Dew', artist: 'HOYO-MiX · 至冬堡（白天）', src: '/music/snezhnaya-day1.m4a' },
  { title: '黑雪鹄的夜梦 Dream of the Black Snow Swan', artist: 'HOYO-MiX · 至冬堡（夜晚）', src: '/music/snezhnaya-night1.m4a' },
  { title: '自由颂 Ode to Liberty（巴扬版）', artist: 'HOYO-MiX · 列车总站', src: '/music/snezhnaya-liberty.m4a' },
  { title: '冰湖的凯旋礼 Triumph on the Ice', artist: 'HOYO-MiX · 至冬（战斗）', src: '/music/snezhnaya-battle.m4a' },
] as const;

// 评论系统（Giscus）配置
// 留空时评论区显示「暂未开启」的提示；填写后自动加载 Giscus 评论。
export const giscus = {
  repo: '', // 例如 'your-name/your-repo'
  repoId: '', // GitHub 仓库的 repoId
  category: 'Announcements', // Discussions 分类名
  categoryId: '', // 该分类的 categoryId
  mapping: 'pathname',
  lang: 'zh-CN',
} as const;
