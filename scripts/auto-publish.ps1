# 自动同步相册并发布到 GitHub
# 由 Windows 计划任务定时调用，也可手动双击 scripts\auto-publish.cmd 运行
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'auto-publish.log'

function Log([string]$m) {
  $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
  Write-Host $line
  Add-Content -LiteralPath $log -Value $line -Encoding UTF8
}

# 保证能找到 git / node
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

Log '===== 开始自动同步相册 ====='

# 1) 同步图片（源目录 → public/photos + src/data/photos.json）
$sync = & node scripts/sync-photos.mjs 2>&1
$sync | ForEach-Object { Log "  $_" }
if ($LASTEXITCODE -ne 0) { Log '同步失败，已中止'; exit 1 }

# 2) 本地构建校验（避免把坏数据推上去）
$build = & npm run build 2>&1 | Select-Object -Last 2
$build | ForEach-Object { Log "  $_" }

# 3) 有变化才提交推送（CI 会自动重新构建并部署）
& git add -A 2>&1 | Out-Null
$changed = (& git diff --cached --name-only | Measure-Object).Count
if ($changed -eq 0) {
  Log '相册无变化，无需发布'
  Log '===== 结束 ====='
  exit 0
}

Log "  检测到 $changed 个文件变化，准备提交"
& git -c user.name="东芽果DYG" -c user.email="q1310617762@gmail.com" commit -q -m "chore(photos): 自动同步相册 $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>&1 | Out-Null

$push = & git push origin main 2>&1
$push | ForEach-Object { Log "  $_" }
if ($LASTEXITCODE -eq 0) {
  Log '✅ 已推送，GitHub Actions 将自动构建并部署'
} else {
  Log '❌ 推送失败（可能是凭据失效），请检查 logs/auto-publish.log'
}
Log '===== 结束 ====='
