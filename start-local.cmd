@echo off
chcp 65001 >nul
title 图片提交与统计系统 - 本地预览
setlocal enabledelayedexpansion
cd /d "%~dp0.."
set "ROOT=%CD%"

echo ============================================
echo   图片提交与统计系统 - 本地预览
echo ============================================
echo.

rem ---------- 找 bash（脚本用 Git Bash 执行） ----------
set "BASHEXE=bash"
where bash >nul 2>nul || (
  if exist "%ProgramFiles%\Git\bin\bash.exe" set "BASHEXE=%ProgramFiles%\Git\bin\bash.exe"
)
echo [1/4] 启动本地数据库（便携 MariaDB :3307）...
call "%BASHEXE%" scripts/db-local.sh start
if errorlevel 1 (
  echo.
  echo 数据库启动失败，请查看上方错误信息。
  pause
  exit /b 1
)
echo.

rem ---------- 依赖与构建 ----------
echo [2/4] 检查依赖与后端构建...
if not exist "%ROOT%\server\node_modules" (
  echo    安装后端依赖...
  pushd server
  call npm install --no-audit --no-fund || goto :fail
  popd
)
if not exist "%ROOT%\web\node_modules" (
  echo    安装前端依赖...
  pushd web
  call npm install --no-audit --no-fund || goto :fail
  popd
)
pushd server
call npx prisma generate >nul 2>nul
call npx prisma db push --skip-generate || goto :fail
if not exist "%ROOT%\server\dist\main.js" (
  echo    编译后端...
  call npm run build || goto :fail
)
popd
echo.

echo [3/4] 启动后端 API（:3000）与前端（:5173）...
start "imgstats-api" cmd /k "cd /d %ROOT%\server && npm run start"
timeout /t 4 >nul
start "imgstats-web" cmd /k "cd /d %ROOT%\web && npm run dev"
timeout /t 6 >nul

echo [4/4] 打开浏览器...
start http://localhost:5173
echo.
echo --------------------------------------------
echo  管理员   admin    / Admin@123456
echo  普通用户 zhangwei / User@123456
echo.
echo  手机访问同一 WiFi 下的 http://本机IP:5173
echo  停止数据库：bash scripts/db-local.sh stop
echo --------------------------------------------
echo 提示：若是全新数据库，执行一次演示数据初始化：
echo   cd server ^&^& set SEED_DEMO=true ^&^& npm run seed
echo --------------------------------------------
pause
exit /b 0

:fail
echo.
echo 启动失败，请查看上方错误。
pause
exit /b 1
