@echo off
chcp 65001 >nul
title 微信二维码更新
cd /d "%~dp0.."
set ASTRO_TELEMETRY_DISABLED=1

echo ============================================
echo   微信二维码更新
echo ============================================
echo.

node "scripts\set-wechat.mjs" %*
set RC=%ERRORLEVEL%

if "%RC%"=="2" goto :nodrop
if not "%RC%"=="0" goto :fail

echo.
echo --------------------------------------------
echo   正在发布到线上（约需 10~60 秒）...
echo --------------------------------------------
echo.
node "scripts\auto-publish.mjs"

echo.
echo ============================================
echo   完成！等 1~2 分钟后刷新网站即可看到新二维码
echo   https://q1310617762-web.github.io/
echo ============================================
echo.
pause
exit /b 0

:nodrop
echo.
echo 没有找到二维码图片。请按以下步骤操作：
echo.
echo   1. 手机微信 -^> 我 -^> 点右上角二维码 -^> 保存二维码
echo   2. 把图片传到电脑，放进这个文件夹：
echo      E:\AI cahs\微信二维码
echo   3. 再双击运行本文件
echo.
echo   也可以直接把图片拖到本文件上（自动处理该张）。
echo.
pause
exit /b 0

:fail
echo.
echo 处理失败，请把上面的错误信息发给 AI 助手。
echo.
pause
exit /b 1
