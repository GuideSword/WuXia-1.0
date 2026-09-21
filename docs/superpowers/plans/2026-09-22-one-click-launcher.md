# Windows One-Click Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Windows batch file that installs missing dependencies, starts the game, opens the correct browser URL, and stops the server when its window closes.

**Architecture:** A root-level `启动游戏.cmd` owns environment checks and runs the existing Vite development command in the foreground. Vite keeps 5280 as the preferred port, selects the next free port when needed, and opens the URL it actually selected.

**Tech Stack:** Windows Command Prompt, npm, Vite 8, Markdown

---

### Task 1: Add the Windows launcher

**Files:**
- Create: `启动游戏.cmd`

- [ ] **Step 1: Verify the launcher does not exist**

Run:

```powershell
Test-Path '.\启动游戏.cmd'
```

Expected: `False`.

- [ ] **Step 2: Create the launcher**

Create `启动游戏.cmd` with this content:

```bat
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
```

- [ ] **Step 3: Check batch syntax and the missing-runtime branch**

Run a child `cmd.exe` with a deliberately empty executable search path:

```powershell
cmd.exe /d /c "set PATH=C:\__wuxia_missing_tools__&& (echo.|call 启动游戏.cmd)"
```

Expected: output contains `[无法启动] 未找到 Node.js 或 npm。` and the process exits with code `1`.

- [ ] **Step 4: Commit the launcher**

```powershell
git add -- '启动游戏.cmd'
git commit -m "feat: add Windows one-click launcher"
```

### Task 2: Document the launcher

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add one-click and manual startup instructions**

Replace the opening of the `## 运行` section with:

```markdown
## 运行

需要 Node.js 22+ 与 npm。

### Windows 一键启动

双击项目根目录的 `启动游戏.cmd`。脚本会在首次运行时安装依赖，启动开发服务器，并自动打开浏览器。关闭脚本窗口即可停止服务器。

服务器优先使用 5280 端口。如果该端口已被其他程序占用，Vite 会自动选择 5281、5282 等空闲端口；请以终端显示和浏览器打开的实际地址为准。

### 手动启动

```powershell
npm ci
npm run dev
```
```

Keep the existing paragraph about desktop and LAN access after this block.

- [ ] **Step 2: Check the documentation and commit**

Run:

```powershell
git diff --check
rg -n "一键启动|端口已被|npm run dev" README.md
```

Expected: `git diff --check` reports no errors and `rg` finds the new instructions.

Commit:

```powershell
git add README.md
git commit -m "docs: explain one-click game startup"
```

### Task 3: Verify normal startup and port fallback

**Files:**
- Test: `启动游戏.cmd`

- [ ] **Step 1: Verify normal startup**

Start the launcher in a hidden child window, wait for the server, request the page, then stop the complete process tree:

```powershell
$process = Start-Process cmd.exe -ArgumentList '/d','/c','启动游戏.cmd' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 4
(Invoke-WebRequest 'http://127.0.0.1:5280/' -UseBasicParsing).StatusCode
taskkill /PID $process.Id /T /F
```

Expected: HTTP status `200`. Vite may open the default browser because the launcher passes `--open`; close that tab after the check if necessary.

- [ ] **Step 2: Verify occupied-port fallback**

Start a temporary server on 5280, then start the launcher and probe 5281:

```powershell
$occupier = Start-Process node.exe -ArgumentList '-e',"require('http').createServer((_,r)=>r.end('occupied')).listen(5280)" -PassThru -WindowStyle Hidden
$launcher = Start-Process cmd.exe -ArgumentList '/d','/c','启动游戏.cmd' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 4
$occupiedBody = (Invoke-WebRequest 'http://127.0.0.1:5280/' -UseBasicParsing).Content
$gameStatus = (Invoke-WebRequest 'http://127.0.0.1:5281/' -UseBasicParsing).StatusCode
taskkill /PID $launcher.Id /T /F
Stop-Process -Id $occupier.Id -Force
"$occupiedBody / $gameStatus"
```

Expected: `occupied / 200`. The process on 5280 remains alive until the explicit `Stop-Process`, showing that the launcher does not terminate it.

- [ ] **Step 3: Run project checks**

Run:

```powershell
npm run typecheck
npm run build
git diff --check
git status --short --branch
```

Expected: type checking and build pass, whitespace checks report no errors, and only the planned commits are ahead of the remote branch.

- [ ] **Step 4: Push the completed work**

```powershell
git -c http.proxy= -c https.proxy= push origin codex/explore-ui-backpack
```

Expected: GitHub accepts the new commits on `codex/explore-ui-backpack`.
