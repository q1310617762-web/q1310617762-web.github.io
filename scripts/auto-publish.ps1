# 自动同步相册并发布到 GitHub
# 由 Windows 计划任务通过 run-hidden.vbs 以「隐藏窗口」方式调用（不会抢焦点）
# 也可手动双击 scripts\auto-publish.cmd 运行
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# 关键：禁止任何交互式弹窗（否则凭据失效时会弹出登录框抢焦点）
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'never'
$env:GIT_ASKPASS = ''
$env:ASTRO_TELEMETRY_DISABLED = '1'

$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'auto-publish.log'

function Log([string]$m) {
  $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
  Add-Content -LiteralPath $log -Value $line -Encoding UTF8
}

# 保证能找到 git / node（计划任务的 PATH 可能不全）
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

# 日志超过 200 行时截断，避免无限增长
if (Test-Path $log) {
  $lines = Get-Content -LiteralPath $log
  if ($lines.Count -gt 200) {
    $lines | Select-Object -Last 100 | Set-Content -LiteralPath $log -Encoding UTF8
  }
}

# 1) 同步图片（源目录 → public/photos + src/data/photos.json）
$sync = & node scripts/sync-photos.mjs 2>&1
$syncTail = ($sync | Select-Object -Last 2) -join ' | '

# 2) 先判断有没有变化 —— 没变化就立刻退出（不做构建、不推送、不占资源）
& git add -A 2>&1 | Out-Null
$changed = (& git diff --cached --name-only | Measure-Object).Count
if ($changed -eq 0) {
  Log "无变化 | $syncTail"
  exit 0
}

Log "检测到 $changed 个文件变化 | $syncTail"

# 3) 只有确实有新图片时才本地构建校验
$build = & npm run build 2>&1 | Select-Object -Last 1
Log "  构建: $build"

# 4) 提交并推送（CI 会自动重新构建并部署）
& git -c user.name="东芽果DYG" -c user.email="q1310617762@gmail.com" commit -q -m "chore(photos): 自动同步相册 $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>&1 | Out-Null

$push = & git push origin main 2>&1
$pushText = ($push | ForEach-Object { "$_" }) -join ' | '
if ($LASTEXITCODE -eq 0) {
  Log "  ✅ 已推送，GitHub Actions 将自动构建部署"
} else {
  Log "  ❌ 推送失败（凭据可能已失效）: $pushText"
}
exit 0
