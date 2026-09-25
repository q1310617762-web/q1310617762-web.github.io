// 设置「受保护相册」的问题与口令
// 用法：npm run set:gate
// 结果：生成 photo-gate.config.json（已被 .gitignore 忽略，不会上传到 GitHub）
//       其中保存问题文案与口令；口令用于派生加密密钥，绝不会出现在网站或仓库里
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const ROOT = path.resolve(import.meta.dirname, '..');
const CFG = path.join(ROOT, 'photo-gate.config.json');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));

(async () => {
  console.log('=== 设置受保护相册（家人照片等）===');
  console.log('受保护目录：C:\\Users\\VOS-User\\Pictures\\Saved Pictures\\相片');
  console.log('（该目录下的图片会被加密，必须输入口令才能查看）\n');

  let old = {};
  if (fs.existsSync(CFG)) {
    try {
      old = JSON.parse(fs.readFileSync(CFG, 'utf8'));
      console.log(`检测到已有配置：问题「${old.question}」\n`);
    } catch {}
  }

  const question = (await ask(`问题提示 [${old.question || '请输入口令查看家人照片'}]: `)) || old.question || '请输入口令查看家人照片';
  let answer = await ask('口令（直接回车 = 沿用原口令）: ');
  if (!answer) answer = old.answer || '';
  if (!answer) {
    console.log('\n❌ 口令不能为空，已取消');
    rl.close();
    process.exit(1);
  }
  const hint = (await ask(`输入框下方的补充说明 [${old.hint || '仅家人可查看'}]: `)) || old.hint || '仅家人可查看';

  fs.writeFileSync(CFG, JSON.stringify({ question, answer, hint, updatedAt: new Date().toISOString() }, null, 2), 'utf8');

  console.log('\n✅ 已保存到 photo-gate.config.json（该文件不会上传到 GitHub）');
  console.log('   接下来执行：npm run publish:photos   即可加密并发布');
  rl.close();
})();
