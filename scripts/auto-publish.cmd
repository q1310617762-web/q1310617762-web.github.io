@echo off
rem 手动同步相册并发布（双击即可运行，会显示运行结果）
rem 自动模式由 Windows 计划任务「博客相册自动同步」以隐藏窗口调用 run-hidden.vbs
setlocal
node "%~dp0auto-publish.mjs"
if errorlevel 1 (
  echo.
  echo [失败] 详情见 logs\auto-publish.log
) else (
  echo.
  echo [完成] 已同步并发布（线上约 1~2 分钟后更新）
)
echo.
type "%~dp0..\logs\auto-publish.log" 2>nul | more +0
timeout /t 10 >nul
endlocal
