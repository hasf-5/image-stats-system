@echo off
chcp 65001 >nul
title 图片提交与统计系统 - 本地预览
cd /d "%~dp0.."

echo ============================================
echo   图片提交与统计系统 - 本地预览
echo ============================================
echo.

echo [1/3] 启动本地数据库（便携 MariaDB :3307）...
call bash scripts/db-local.sh start
if errorlevel 1 (
  echo.
  echo 数据库启动失败，请查看上方错误信息。
  pause
  exit /b 1
)
echo.

echo [2/3] 启动后端 API（:3000）...
start "imgstats-api" cmd /k "cd /d %CD%\server && npm run start"
timeout /t 4 >nul

echo [3/3] 启动前端（:5173）...
start "imgstats-web" cmd /k "cd /d %CD%\web && npm run dev"
timeout /t 5 >nul

start http://localhost:5173
echo.
echo --------------------------------------------
echo  管理员  admin     / Admin@123456
echo  普通用户 zhangwei / User@123456
echo  手机访问  http://本机IP:5173（同一 WiFi）
echo --------------------------------------------
echo  关闭本窗口不会停止服务；
echo  停止数据库：bash scripts/db-local.sh stop
echo --------------------------------------------
pause
