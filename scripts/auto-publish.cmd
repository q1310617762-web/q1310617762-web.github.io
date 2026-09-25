@echo off
rem 双击本文件即可手动同步相册并发布
rem 也可由 Windows 计划任务定时调用
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0auto-publish.ps1"
if errorlevel 1 (
  echo.
  echo [失败] 请查看 logs\auto-publish.log
) else (
  echo.
  echo [完成] 相册已同步并发布
)
timeout /t 8 >nul
