@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title 江湖撤离录 - 本地测试

where node >nul 2>&1
if errorlevel 1 goto :missing_runtime

where npm >nul 2>&1
if errorlevel 1 goto :missing_runtime

for /f %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR goto :missing_runtime
if %NODE_MAJOR% LSS 22 goto :old_runtime

if not exist "package.json" goto :missing_project

if not exist "node_modules\" (
  echo [首次启动] 正在安装项目依赖，请稍候……
  call npm ci
  if errorlevel 1 goto :install_failed
  echo.
)

echo 正在启动《江湖撤离录》……
echo 默认使用 5280 端口；如果端口被占用，会自动选择下一个空闲端口。
echo 浏览器将自动打开实际使用的地址。关闭本窗口即可停止服务器。
echo.
call npm run dev -- --open
set "SERVER_EXIT=%errorlevel%"

if "%SERVER_EXIT%"=="0" exit /b 0
echo.
echo [启动结束] 游戏服务器已停止，退出代码：%SERVER_EXIT%
pause
exit /b %SERVER_EXIT%

:missing_runtime
echo [无法启动] 未找到 Node.js 或 npm。
echo 请安装 Node.js 22 或更高版本，然后重新双击本文件。
pause
exit /b 1

:old_runtime
echo [无法启动] 当前 Node.js 主版本为 %NODE_MAJOR%，项目需要 Node.js 22 或更高版本。
echo 请升级 Node.js 后重新双击本文件。
pause
exit /b 1

:missing_project
echo [无法启动] 脚本所在目录缺少 package.json。
echo 请将本文件保留在项目根目录后重试。
pause
exit /b 1

:install_failed
echo.
echo [安装失败] npm ci 未成功完成，请根据上方错误信息排查后重试。
pause
exit /b 1
