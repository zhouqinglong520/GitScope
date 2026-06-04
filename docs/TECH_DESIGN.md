# GitGUI 技术架构设计

## 1. 整体架构

```
┌──────────────────────────────────────────────┐
│                  渲染进程 (React)              │
│  ┌──────────────────────────────────────────┐  │
│  │  多仓库 Tab  │ repo1 │ repo2 │           │  │
│  ├──────────┬───────────────────────────────┤  │
│  │          │  提交图面板 (Canvas DAG)       │  │
│  │ 仓库/分支 │  ●──●──●  main              │  │
│  │ 标签/Stash│  └──●  feature              │  │
│  │          ├───────────────────────────────┤  │
│  │          │  暂存区 │ Diff 对比 (同屏)     │  │
│  │          │  ✓file1 │ -old  +new          │  │
│  │          ├───────────────────────────────┤  │
│  │          │  💬 提交消息      [Commit]     │  │
│  └──────────┴───────────────────────────────┘  │
├────────────────── IPC Bridge ────────────────┤
│                  主进程 (Node.js)              │
│  ┌──────────┐ ┌───────────┐ ┌─────────────┐  │
│  │ Git 服务  │ │ 凭证服务   │ │ Gitee 服务  │  │
│  │(isogit + │ │(keytar +  │ │(OAuth2 +    │  │
│  │ git CLI) │ │ keychain) │ │ REST API)   │  │
│  └──────────┘ └───────────┘ └─────────────┘  │
│  ┌──────────┐ ┌───────────┐                  │
│  │ 文件监听  │ │ 通知服务   │                  │
│  │(chokidar)│ │(electron) │                  │
│  └──────────┘ └───────────┘                  │
└──────────────────────────────────────────────┘
```

## 2. 技术选型

| 层次 | 技术 | 版本 | 理由 |
|------|------|------|------|
| 框架 | Electron | 33+ | 成熟稳定，GitKraken 验证 |
| 前端 | React + TypeScript | React 19 | 组件化、类型安全 |
| 状态管理 | Zustand | 5.x | 轻量、支持异步 |
| UI 组件 | Shadcn/ui + Tailwind | - | 现代风格、可定制 |
| Git 操作 | isomorphic-git + git CLI | - | 轻量操作用 isogit，复杂操作降级 CLI |
| 提交图 | 自绘 Canvas | - | 性能优先，避免 DOM 节点膨胀 |
| Diff 渲染 | Monaco Editor / 自研 | - | 复用 VS Code 编辑器核心 |
| 凭证存储 | keytar | - | 调用系统原生钥匙串 |
| SSH | node-ssh / ssh2 | - | SSH 操作支持 |
| HTTP | undici | - | 高性能 HTTP 客户端 |
| 打包 | electron-builder | - | 多平台打包 |
| 更新 | electron-updater | - | 自动更新 |

## 3. 核心模块设计

### 3.1 Git 服务层

```typescript
// 双引擎策略：isomorphic-git（轻量） + git CLI（完整）
interface GitService {
  // 基础操作（isomorphic-git）
  clone(url: string, path: string): Promise<void>;
  add(path: string): Promise<void>;
  commit(message: string): Promise<string>;
  push(remote: string, branch: string): Promise<void>;
  pull(remote: string, branch: string): Promise<void>;
  
  // 复杂操作（git CLI 降级）
  rebase(branch: string): Promise<RebaseResult>;
  merge(branch: string): Promise<MergeResult>;
  resolveConflicts(files: ConflictFile[]): Promise<void>;
  
  // 查询操作
  log(options?: LogOptions): Promise<Commit[]>;
  diff(ref?: string): Promise<DiffResult>;
  status(): Promise<StatusResult>;
  branches(): Promise<Branch[]>;
}
```

### 3.2 提交图渲染

```
设计要点：
- 使用 Canvas 自绘，避免大量 DOM 节点
- 虚拟滚动：只渲染可视区域的提交
- 异步加载：滚动到底部时增量加载
- 分支颜色自动分配，支持自定义
```

### 3.3 Gitee 集成

```typescript
interface GiteeService {
  // OAuth2 流程
  startAuth(): Promise<void>;        // 打开浏览器授权
  handleCallback(code: string): Promise<Token>;
  refreshToken(): Promise<Token>;
  
  // 仓库操作
  listRepos(): Promise<Repository[]>;
  cloneRepo(repo: Repository): Promise<void>;
  
  // PR/MR（V2 规划功能）
  listPullRequests(): Promise<PR[]>;
  createPullRequest(pr: CreatePR): Promise<PR>;
  reviewPullRequest(pr: PR): Promise<void>;
}
```

### 3.4 IPC 通信协议

```typescript
// 主进程 ↔ 渲染进程通信
// 使用 contextBridge + ipcRenderer/ipcMain

// 渲染进程调用
const gitService = {
  clone: (url, path) => ipcRenderer.invoke('git:clone', { url, path }),
  commit: (message) => ipcRenderer.invoke('git:commit', { message }),
  push: (remote, branch) => ipcRenderer.invoke('git:push', { remote, branch }),
  // ...
};

// 主进程注册
ipcMain.handle('git:clone', async (_, { url, path }) => {
  return gitService.clone(url, path);
});
```

## 4. 项目结构

```
GitGUI/
├── docs/                    # 产品文档
│   ├── PRD.md
│   └── TECH_DESIGN.md
├── src/
│   ├── main/               # 主进程
│   │   ├── index.ts        # 入口
│   │   ├── ipc/            # IPC 处理器
│   │   ├── services/       # 后端服务
│   │   │   ├── git/
│   │   │   ├── credential/
│   │   │   ├── gitee/
│   │   │   └── watcher/
│   │   └── utils/
│   ├── renderer/           # 渲染进程
│   │   ├── index.html
│   │   ├── App.tsx
│   │   ├── components/     # UI 组件
│   │   │   ├── layout/     # 布局组件
│   │   │   ├── repo/       # 仓库相关
│   │   │   ├── commit/     # 提交相关
│   │   │   ├── branch/     # 分支相关
│   │   │   ├── diff/       # 差异查看
│   │   │   └── common/     # 通用组件
│   │   ├── hooks/          # React Hooks
│   │   ├── stores/         # Zustand 状态
│   │   ├── i18n/           # 国际化
│   │   │   ├── zh-CN.ts
│   │   │   └── en-US.ts
│   │   └── styles/         # 样式
│   └── shared/             # 共享类型/工具
│       ├── types/
│       └── utils/
├── resources/              # 静态资源
│   └── icons/
├── electron-builder.yml    # 打包配置
├── package.json
├── tsconfig.json
├── vite.config.ts          # 渲染进程构建
└── README.md
```

## 5. 性能目标

| 指标 | 目标 | 措施 |
|------|------|------|
| 冷启动 | < 3秒 | 延迟加载非核心模块 |
| 仓库打开 | < 1秒 | 异步加载提交历史 |
| 提交图渲染 | 60fps | Canvas + 虚拟滚动 |
| 内存占用（空仓库） | < 150MB | 监控泄漏、及时释放 |
| 内存占用（大仓库） | < 400MB | 增量加载、分页查询 |
| Diff 渲染 | < 500ms | Worker 线程计算 diff |

## 6. 开发路线图

### Phase 1：基础框架（第 1-2 周）
- Electron + React 项目初始化
- 主进程/渲染进程架构搭建
- IPC 通信层
- 基础布局（参考 Fork 三栏式）
- 多仓库 Tab 标签页

### Phase 2：核心 Git 操作（第 3-6 周）
- Git 服务层（clone/commit/push/pull）
- 暂存区管理（文件+hunk 级别）
- 分支操作
- 文件状态监听
- 右键菜单体系（提交/分支/文件三级）

### Phase 3：可视化（第 7-10 周）
- 提交图（Canvas 渲染，彩色分支线+圆点节点）
- Diff 查看器（side-by-side + unified）
- 暂存区+Diff 同屏（Fork 核心布局）
- 提交详情面板（折叠式）
- 底部常驻提交栏

### Phase 4：中文与集成（第 11-14 周）
- 完整中文 UI（原生设计，非翻译）
- Gitee OAuth2 一键登录
- 凭证管理（系统钥匙串）
- Quick Launch 命令面板（Ctrl+K）
- 暗/亮色主题

### Phase 5：内测（第 15-16 周）
- 内测版本发布
- Bug 修复
- 性能优化
- Windows 安装包（.exe/.msi）
