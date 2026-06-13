@echo off
chcp 65001 >nul
REM GitGUI 一键启动脚本（Windows）
REM 使用方法：双击 start.bat 或在 cmd 中运行 start.bat

echo ========================================
echo   GitGUI 开发环境启动脚本
echo ========================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js v18+
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js 版本: %NODE_VERSION%

REM 安装依赖
if not exist "node_modules" (
    echo.
    echo [1/3] 首次运行，安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败，请检查网络连接
        pause
        exit /b 1
    )
    echo [OK] 依赖安装完成
) else (
    echo [OK] 依赖已安装
)

REM 构建渲染进程
echo.
echo [2/3] 构建渲染进程 ^(Vite^)...
call npx vite build
if %errorlevel% neq 0 (
    echo [错误] 渲染进程构建失败
    pause
    exit /b 1
)
echo [OK] 渲染进程构建完成

REM 构建主进程和预加载脚本
echo.
echo [3/3] 构建主进程和预加载脚本 ^(TypeScript^)^...
call npx tsc -p tsconfig.preload.json
if %errorlevel% neq 0 (
    echo [错误] 预加载脚本构建失败
    pause
    exit /b 1
)
call npx tsc -p tsconfig.main.json
if %errorlevel% neq 0 (
    echo [错误] 主进程构建失败
    pause
    exit /b 1
)
echo [OK] 主进程和预加载脚本构建完成

REM 启动 Electron
echo.
echo ========================================
echo   构建成功！正在启动 Electron 应用...
echo ========================================
echo.
call npx electron .

pause
