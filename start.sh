#!/bin/bash
# GitGUI 一键启动脚本（macOS / Linux）
# 使用方法：chmod +x start.sh && ./start.sh

set -e

echo "🔧 GitGUI 开发环境启动脚本"
echo "============================"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js v18+"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js 版本: $NODE_VERSION"

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 首次运行，安装依赖..."
    npm install
    echo "✅ 依赖安装完成"
else
    echo "✅ 依赖已安装"
fi

# 构建渲染进程
echo ""
echo "🏗️  构建渲染进程 (Vite)..."
npx vite build

# 构建主进程
echo "🏗️  构建主进程 (TypeScript)..."
npx tsc -p tsconfig.main.json

echo ""
echo "✅ 构建完成！"
echo ""
echo "🚀 启动 Electron 应用..."
npx electron .
