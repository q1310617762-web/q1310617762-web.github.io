// 抓取 B 站番剧更新表（番剧+国创），生成静态数据文件
// 用法：npm run fetch:anime
// 说明：封面使用 B 站外链（前端以 referrerpolicy="no-referrer" 加载，可绕过防盗链），
//       因此本脚本无第三方依赖，可在 CI 中秒级运行。
import fs from 'node:fs';
import path from 'node:path';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const API = 'https://api.bilibili.com/pgc/web/timeline?types=1%2C4&before=0&after=6';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_FILE = path.join(ROOT, 'src', 'data', 'anime-data.json');
const WEEK = ['一', '二', '三', '四', '五', '六', '日'];

async function fetchTimeline() {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), 15000);
  try {
    const r = await fetch(API, {
      headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Accept: 'application/json' },
      signal: c.signal,
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j.code !== 0 || !Array.isArray(j.result)) throw new Error('接口返回异常 code=' + j.code);
    return j.result;
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  let days;
  try {
    days = await fetchTimeline();
  } catch (e) {
    console.log('抓取失败: ' + e.message);
    if (fs.existsSync(DATA_FILE)) {
      console.log('保留原有数据，未更新。');
      process.exit(0);
    }
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ fetchedAt: new Date().toISOString(), total: 0, days: [] }, null, 2));
    console.log('已写入空数据。');
    process.exit(0);
  }

  const out = [];
  for (const d of days) {
    const eps = [];
    const seen = new Set();
    for (const e of d.episodes || []) {
      // 过滤「中文配音」等重复条目
      if (/中文配音|国语版|日语版|中配版/.test(e.title)) continue;
      if (seen.has(e.title)) continue;
      seen.add(e.title);
      eps.push({
        id: String(e.episode_id),
        title: e.title,
        index: e.pub_index || '',
        time: e.pub_time || '',
        cover: e.square_cover || e.cover || '',
        seasonId: e.season_id || 0,
        url: `https://www.bilibili.com/bangumi/play/ep${e.episode_id}`,
        delay: e.delay ? e.delay_reason || '延期' : '',
      });
    }
    out.push({
      date: d.date,
      dateTs: d.date_ts,
      weekday: WEEK[(d.day_of_week - 1 + 7) % 7],
      isToday: !!d.is_today,
      episodes: eps,
    });
  }

  const total = out.reduce((s, d) => s + d.episodes.length, 0);
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify({ fetchedAt: new Date().toISOString(), total, days: out }, null, 2), 'utf8');

  console.log(`已更新 ${out.length} 天 / 共 ${total} 部`);
  out.slice(0, 3).forEach((d) => {
    console.log(
      `  ${d.date} 周${d.weekday}${d.isToday ? '（今天）' : ''}  ${d.episodes.length} 部: ${d.episodes.slice(0, 3).map((e) => e.title).join(' / ')}`
    );
  });
})();
