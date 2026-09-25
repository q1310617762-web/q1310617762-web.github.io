// 自动同步相册并发布（纯 Node 实现，所有子进程 windowsHide，不产生任何控制台窗口）
// 由 run-hidden.vbs 以隐藏窗口方式调用；也可手动执行：npm run publish:photos
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');
const LOG = path.join(LOG_DIR, 'auto-publish.log');

fs.mkdirSync(LOG_DIR, { recursive: true });

/** 本地时间戳 yyyy-MM-dd HH:mm（与日志文件保持一致，不用 UTC）*/
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function log(msg) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const line = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}  ${msg}`;
  try {
    fs.appendFileSync(LOG, line + '\n', 'utf8');
    // 日志超过 200 行则裁剪
    const lines = fs.readFileSync(LOG, 'utf8').split('\n');
    if (lines.length > 200) fs.writeFileSync(LOG, lines.slice(-100).join('\n'), 'utf8');
  } catch {}
}

/** 运行子进程：windowsHide 保证不弹窗；不继承可见控制台 */
function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // 禁止任何交互式弹窗（凭据失效时也不弹窗，只失败）
        GIT_TERMINAL_PROMPT: '0',
        GCM_INTERACTIVE: 'never',
        GIT_ASKPASS: '',
        ASTRO_TELEMETRY_DISABLED: '1',
      },
      ...opts,
    });
    let out = '';
    let err = '';
    child.stdout?.on('data', (d) => (out += d.toString()));
    child.stderr?.on('data', (d) => (err += d.toString()));
    child.on('error', (e) => resolve({ code: -1, out, err: err + ' ' + e.message }));
    child.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });
}

const NODE = process.execPath;

/** 找到可用的 git */
async function resolveGit() {
  const r = await run('git', ['--version']);
  if (r.code === 0) return 'git';
  const candidates = [
    'C:/Program Files/Git/cmd/git.exe',
    'C:/Program Files (x86)/Git/cmd/git.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs/Git/cmd/git.exe'),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return 'git';
}

(async () => {
  const started = Date.now();
  const git = await resolveGit();

  // 1) 同步图片
  const sync = await run(NODE, [path.join(ROOT, 'scripts', 'sync-photos.mjs')]);
  const syncLine = (sync.out || sync.err || '').split('\n').filter(Boolean).pop() || '(无输出)';
  if (sync.code !== 0) {
    log(`❌ 同步失败: ${syncLine}`);
    return;
  }

  // 1.5) 微信二维码：投递文件夹里有新图就自动转成 public/wechat.png
  //      退出码 2 = 没有二维码可处理，属于正常跳过
  const wx = await run(NODE, [path.join(ROOT, 'scripts', 'set-wechat.mjs')]);
  let wxLine = '';
  if (wx.code === 0) {
    wxLine = (wx.out || '').split('\n').filter(Boolean).pop() || '二维码已处理';
  } else if (wx.code !== 2) {
    wxLine = `二维码处理异常: ${(wx.err || wx.out || '').split('\n').filter(Boolean).pop() || wx.code}`;
  }

  // 2) 有没有变化？没有就立刻退出（不做任何多余工作）
  await run(git, ['add', '-A']);
  const diff = await run(git, ['diff', '--cached', '--name-only']);
  const changed = diff.out ? diff.out.split('\n').filter(Boolean).length : 0;

  if (changed === 0) {
    log(`无变化 | ${syncLine}${wxLine ? ' | ' + wxLine : ''} | ${Date.now() - started}ms`);
    return;
  }

  // 3) 提交并推送（GitHub Actions 会自动构建部署）
  log(`检测到 ${changed} 个文件变化 | ${syncLine}${wxLine ? ' | ' + wxLine : ''}`);

  const commit = await run(git, [
    '-c', 'user.name=东芽果DYG',
    '-c', 'user.email=q1310617762@gmail.com',
    'commit', '-q',
    '-m', `chore(auto): 自动更新相册/二维码 ${stamp()}`,
  ]);
  if (commit.code !== 0) {
    log(`❌ 提交失败: ${(commit.err || commit.out).slice(0, 200)}`);
    return;
  }

  const push = await run(git, ['push', 'origin', 'main']);
  if (push.code === 0) {
    log(`✅ 已推送，GitHub Actions 将自动构建部署 | ${Date.now() - started}ms`);
  } else {
    log(`❌ 推送失败（凭据可能已失效）: ${(push.err || push.out).slice(0, 200)}`);
  }
})();
