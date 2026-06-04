# GitScope 码界

面向国内开发者的现代 Git 图形化客户端，原生中文、深度集成国内平台。

## 截图

![主界面](screenshots/v0.2/01-main-ui.png)

## 功能特性

- 🎨 **Fork 风格提交图** — Bezier 曲线分支连线 + 节点分层（HEAD/分支/普通）+ 拖拽交互
- 📋 **Quick Launch 命令面板** — Ctrl+K 快速执行任何操作
- 🌿 **完整分支操作** — 创建/切换/删除/重命名/合并/拖拽合并/Cherry-pick
- 🔀 **交互式 Rebase** — 可视化提交列表，支持 pick/squash/reword/edit/drop
- ⚔️ **三窗格冲突解决器** — Theirs/Merged/Yours 三窗格 + 冲突解析
- 📝 **增强 CommitBar** — Conventional Commits 模板 + Amend 标记
- 🔍 **DiffView 增强** — 行内 Stage/Unstage + Staged/Unstaged 分区 + Hunk 折叠 + Blame 模式
- ↩️ **Undo/Redo 安全网** — 14 种可撤销操作 + Ctrl+Z / Ctrl+Shift+Z
- 🏷️ **标签管理** — 创建/删除/检出/推送标签
- 📦 **Stash 管理** — Stash/Pop/Apply/Drop + 右键菜单
- 🔗 **远程仓库管理** — 侧边栏 Remotes 区块 + 添加/删除/修改 URL
- 📊 **Reflog 查看** — 操作历史浏览 + Reset/Detach 恢复
- 🧩 **子模块管理** — 添加/初始化/更新/删除
- ✏️ **.gitignore 编辑器** — 可视化弹窗 + 快捷规则
- 🌐 **中英文 i18n** — 完整语言包，默认中文

## 技术栈

| 技术 | 说明 |
|------|------|
| Electron 33+ | 跨平台桌面应用框架 |
| React 19 | UI 组件库 |
| TypeScript | 类型安全 |
| Vite | 快速构建工具 |
| Zustand | 状态管理 |
| Tailwind CSS | 样式框架 |
| isomorphic-git + git CLI | Git 操作双引擎 |

## 项目结构

```
├── main/                    # Electron 主进程
│   ├── index.ts            # 应用入口
│   ├── ipc/                # IPC 通信处理
│   └── services/           # 后端服务（Git、凭证）
├── preload/                 # 预加载脚本
├── renderer/                # 渲染进程（React UI）
│   ├── App.tsx             # 根组件
│   ├── components/         # UI 组件
│   ├── hooks/              # React Hooks
│   ├── i18n/               # 国际化（zh-CN / en-US）
│   ├── stores/             # Zustand 状态管理
│   └── styles/             # 样式
├── shared/                  # 共享类型定义
├── resources/               # 应用图标
└── docs/                    # 文档
    ├── PRD.md              # 产品需求文档
    ├── TECH_DESIGN.md      # 技术架构文档
    ├── FEATURE_STATUS.md   # 功能现状清单
    └── TEST_AND_OPTIMIZATION_PLAN.md  # 测试与优化规划
```

## 快速开始

### 环境要求

- Node.js 18+
- Git（部分功能需要）

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/zhouqinglong520/GitScope.git
cd GitScope

# 安装依赖
npm install

# 开发模式启动
npm run dev
```

或使用一键启动脚本：
- Windows: 双击 `start.bat`
- macOS/Linux: `chmod +x start.sh && ./start.sh`

### 构建 & 打包

```bash
# 构建
npm run build

# 打包 Windows 安装程序
npm run package
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+K | Quick Launch 命令面板 |
| Ctrl+Z | Undo 撤销 |
| Ctrl+Shift+Z | Redo 重做 |
| Ctrl+O | 打开仓库 |
| F5 | 刷新 |

## 文档

- [产品需求文档](docs/PRD.md)
- [技术架构文档](docs/TECH_DESIGN.md)
- [功能现状清单](docs/FEATURE_STATUS.md) — 34 项已完成功能详情
- [测试与优化规划](docs/TEST_AND_OPTIMIZATION_PLAN.md) — 36 项测试用例 + 三阶段优化

## License

MIT
