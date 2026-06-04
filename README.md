# GitGUI

现代化 Git 客户端，基于 Electron + React + TypeScript 构建。

## 技术栈

| 技术 | 说明 |
|------|------|
| Electron 33+ | 跨平台桌面应用框架 |
| React 19 | UI 组件库 |
| TypeScript | 类型安全 |
| Vite | 快速构建工具 |
| Zustand | 状态管理 |
| Tailwind CSS | 样式框架 |
| isomorphic-git | Git 操作库 |
| keytar | 系统凭证存储 |
| chokidar | 文件监听 |

## 项目结构

```
src/
├── main/                    # 主进程
│   ├── index.ts            # 入口文件
│   ├── ipc/                # IPC 处理器
│   ├── services/           # 服务层
│   │   ├── git/           # Git 服务
│   │   └── credential/    # 凭证服务
│   └── utils/              # 工具函数
├── renderer/               # 渲染进程
│   ├── App.tsx            # 根组件
│   ├── components/       # UI 组件
│   │   ├── layout/       # 布局组件
│   │   ├── repo/         # 仓库相关
│   │   ├── commit/       # 提交相关
│   │   ├── branch/       # 分支相关
│   │   ├── diff/         # 差异查看
│   │   └── common/       # 通用组件
│   ├── stores/           # Zustand 状态
│   ├── hooks/            # React Hooks
│   ├── i18n/             # 国际化
│   └── styles/           # 样式
├── preload/               # Preload 脚本
└── shared/               # 共享类型
    ├── types/            # 类型定义
    └── utils/           # 工具函数
```

## 快速开始

### 安装依赖

```bash
cd GitGUI/src
npm install
```

### 开发模式

```bash
# 启动开发服务器
npm run dev
```

或者分别启动：

```bash
# 终端 1：渲染进程开发服务器
npm run dev:renderer

# 终端 2：主进程
npm run dev:main
```

### 构建

```bash
npm run build
```

### 打包

```bash
npm run package
```

## 功能特性

- [x] 三栏布局（仓库列表 + 提交历史 + 详情）
- [x] 仓库管理（打开、切换）
- [x] 分支管理（查看、切换、创建）
- [x] 提交历史查看
- [x] 文件状态显示
- [x] 差异查看
- [x] 中文界面
- [ ] Git 操作（暂存、提交、推送、拉取）
- [ ] 凭证管理
- [ ] Gitee 集成

## 开发说明

### TypeScript 配置

- `tsconfig.json` - 渲染进程 TypeScript 配置
- `tsconfig.main.json` - 主进程 TypeScript 配置

### Vite 配置

渲染进程使用 Vite 进行构建，支持热更新。

### Tailwind CSS

使用 Tailwind CSS 进行样式开发，预置了 GitGUI 主题色。

## License

MIT
