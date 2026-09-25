@echo off
rem 双击本文件 = 设置「家人相册」的口令，并立即加密发布
rem 口令只保存在本机 photo-gate.config.json（不会上传到 GitHub）
setlocal
echo ============================================
echo   设置家人相册口令
echo ============================================
echo.
node "%~dp0set-photo-gate.mjs"
if errorlevel 1 goto end
echo.
echo --------------------------------------------
echo   正在加密并发布，请稍候…
echo --------------------------------------------
node "%~dp0auto-publish.mjs"
echo.
echo 最近日志：
type "%~dp0..\logs\auto-publish.log" 2>nul
echo.
echo 完成！线上约 1~2 分钟后更新。
echo 访问：https://q1310617762-web.github.io/gallery
:end
echo.
timeout /t 20 >nul
endlocal
