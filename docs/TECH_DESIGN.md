# Majie 码界 — 技术架构设计

> 最后更新：2026-06-08

## 1. 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                    渲染进程 (React 19)                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │  多仓库 Tab  │ repo1 │ repo2 │                     │  │
│  ├──────────┬─────────────────────────┬──────────────┤  │
│  │          │  提交图 (Canvas DAG)     │              │  │
│  │  侧边栏   │  ──●──● main           │  提交详情     │  │
│  │  分支/标签 │  └──● feature          │  文件变更     │  │
│  │  远程/子模│  ● stash(金)           │  Diff 视图    │  │
│  │  块       │  minimap│scrollbar标记  │  Blame       │  │
│  ├──────────┴─────────────────────────┴──────────────┤  │
│  │  暂存区 │ Diff 对比（词级高亮+行级暂存+minimap）    │  │
│  ├───────────────────────────────────────────────────┤  │
│  │  💬 提交消息 (Conventional Commits)    [Commit]    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  21 个专业弹窗（Fork 风格设计令牌）                       │
│  Quick Launch (Ctrl+K) │ 快捷键速查 │ 内置终端           │
├─────────────────────── IPC Bridge ─────────────────────┤
│                    主进程 (Node.js)                       │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Git 服务  │ │ 凭证服务   │ │ Gitee    │ │ AI 服务  │ │
│  │(isogit + │ │(safeStore)│ │(OAuth2 + │ │(OpenAI + │ │
│  │ git CLI) │ │           │ │ REST API)│ │ Ollama)  │ │
│  └──────────┘ └───────────┘ └──────────┘ └──────────┘ │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐              │
│  │ 文件监听  │ │ 通知服务   │ │ Activity │              │
│  │(chokidar)│ │(electron) │ │  Log     │              │
│  └──────────┘ └───────────┘ └──────────┘              │
└──────────────────────────────────────────────────────────┘
```

### 三栏布局

```
┌──────────┬─────────────────────┬──────────────┐
│ 侧边栏    │     提交图           │   提交详情    │
│ 160-400px│     (Canvas)         │   (可折叠)    │
│ 拖拽调宽   │  Fork风格直线分支     │   Diff/Blame │
│          │  分支着色+Stash节点    │   文件变更列表 │
└──────────┴─────────────────────┴──────────────┘
```

## 2. 技术选型

| 层次 | 技术 | 版本 | 理由 |
|------|------|------|------|
| 框架 | Electron | 33+ | 成熟稳定，GitKraken 验证 |
| 前端 | React + TypeScript | React 19 | 组件化、类型安全 |
| 构建 | Vite | 6.x | 快速 HMR + 构建 |
| 状态管理 | Zustand | 5.x | 轻量、支持异步 |
| UI | Tailwind CSS + 自研 | - | 深色主题、Fork 设计令牌 |
| Git 操作 | isomorphic-git + git CLI | - | 轻量操作用 iso，复杂操作降级 CLI |
| 提交图 | 自绘 Canvas（Lane-based） | - | Fork 风格直线分支算法 |
| Diff 渲染 | 自研 DiffView | - | 词级高亮 + 行级暂存 + minimap |
| 凭证存储 | Electron safeStorage | - | 系统原生加密（替代 keytar） |
| SSH | node-ssh / ssh2 | - | SSH 操作支持 |
| HTTP | undici | - | 高性能 HTTP 客户端 |
| 打包 | electron-builder | - | 多平台打包 |
| 更新 | electron-updater | - | 自动更新 |
| AI | OpenAI API + Ollama | - | 云端 + 本地双模式 |

## 3. 核心模块设计

### 3.1 Git 服务层

```typescript
// 双引擎策略：isomorphic-git（轻量） + git CLI（完整）
// 路径：main/services/git/index.ts

class GitService {
  // 基础操作（isomorphic-git）
  clone(url: string, path: string): Promise<void>;
  add(path: string): Promise<void>;
  commit(message: string): Promise<string>;
  push(remote: string, branch: string): Promise<void>;
  pull(remote: string, branch: string): Promise<void>;

  // 行级暂存
  stageLines(filePath: string, lines: number[]): Promise<void>;
  unstageLines(filePath: string, lines: number[]): Promise<void>;
  getStagedDiff(): Promise<DiffResult>;

  // 复杂操作（git CLI 降级）
  rebase(branch: string): Promise<RebaseResult>;
  rebaseInteractive(commits: RebaseAction[]): Promise<void>;
  rebaseWithUpdateRefs(onto: string, updateRefs: string[]): Promise<void>;
  merge(branch: string, strategy?: MergeStrategy): Promise<MergeResult>;
  resolveConflicts(files: ConflictFile[]): Promise<void>;
  cherryPick(oids: string[]): Promise<void>;
  revert(oids: string[]): Promise<void>;

  // 冲突预判
  predictConflict(operation: string, target: string): Promise<ConflictPrediction>;

  // 查询操作
  log(options?: LogOptions): Promise<Commit[]>;
  diff(ref?: string): Promise<DiffResult>;
  status(): Promise<StatusResult>;
  branches(): Promise<Branch[]>;
  blame(filePath: string): Promise<BlameLine[]>;

  // Stash
  stash(options?: StashOptions): Promise<void>;
  stashPartial(options: PartialStashOptions): Promise<void>;
  stashPop(index?: number): Promise<void>;

  // Patch
  applyPatchFromContent(patchContent: string, options?: ApplyPatchOptions): Promise<void>;

  // 磁盘占用
  getRepoDiskUsage(): Promise<DiskUsageEntry[]>;

  // Activity Log（内存维护，最多 200 条）
  logActivity(action: string, detail: string, status: string): void;
  getActivityLog(limit?: number): ActivityEntry[];
  clearActivityLog(): void;

  // Undo-Redo
  undo(): Promise<void>;
  redo(): Promise<void>;
}
```

### 3.2 提交图渲染

**Fork 风格直线分支算法（Lane-based）**：

1. 遍历提交列表，为每个提交分配 Lane
2. 分支线尽量保持直线（不交叉）
3. 当前分支（HEAD）最左列
4. 分支节点用分支颜色着色（BRANCH_COLORS 哈希映射）
5. Stash 节点用金色（`#e8c547`）标记
6. 合并提交可折叠

```
Lane:  0    1    2
       ●────●────●  main (HEAD, 最左)
       │    └──●  feature
       │       ●  stash (金色节点)
```

### 3.3 Diff 视图

**DiffView 三大增强**：

1. **词级高亮**：同一行内精确到词的增删标记
2. **行级暂存**：勾选行 → `git add -p` 精确暂存
3. **视觉增强**：
   - Diff minimap（右侧 Canvas 迷你地图）
   - 滚动条冲突标记（左侧 6px 窄条）
   - ↩︎ 段落标记

### 3.4 弹窗系统

**21 个专业弹窗**，统一使用 Fork 风格设计令牌：

| 分类 | 弹窗 |
|------|------|
| 分支 | 新建分支 / 删除分支 / 重命名分支 / 切换分支 / 合并分支 |
| 标签 | 新建标签 / 删除标签 / 推送标签 |
| 仓库 | 初始化仓库 / 克隆仓库 / 远程仓库管理 / .gitignore 编辑 |
| 工作流 | Stash / 交互式 Rebase / Git Flow / 部分 Stash / Rebase --update-refs |
| 工具 | 外部 Diff/Merge / 粘贴 Patch / Treemap / Activity Manager |
| 远程 | GitHub 通知 / 陈旧分支批量删除 |

**状态管理**：`useReducer` + `DialogState` 接口，菜单事件通过 `dispatch` 触发。

### 3.5 IPC 通信

```typescript
// IPC 通道命名：git:action
// Preload 暴露：window.electronAPI.git.action()

// 示例注册（main/ipc/index.ts）
ipcMain.handle('git:rebaseWithUpdateRefs', (_, onto, refs) =>
  gitService.rebaseWithUpdateRefs(onto, refs)
);

// Preload 桥接（preload/index.ts）
rebaseWithUpdateRefs: (onto: string, refs: string[]) =>
  ipcRenderer.invoke('git:rebaseWithUpdateRefs', onto, refs)
);
```

### 3.6 AI 服务

双模式架构：

```typescript
interface AIService {
  // 云端模式（OpenAI 兼容 API）
  generateCommitMessage(diff: string): Promise<string>;
  codeReview(diff: string): Promise<ReviewResult>;

  // 本地模式（Ollama）
  setLocalEndpoint(url: string): void;
}
```

### 3.7 Gitee 集成

```typescript
interface GiteeService {
  // OAuth2 流程
  startOAuth(clientId: string): Promise<GiteeToken>;

  // API 操作
  getPullRequests(repo: string): Promise<PR[]>;
  createPullRequest(repo: string, pr: CreatePROptions): Promise<PR>;
}
```

## 4. 项目结构

```
├── main/                    # Electron 主进程
│   ├── index.ts            # 应用入口
│   ├── ipc/                # IPC 通信处理（40+ handler）
│   ├── menu.ts             # 应用菜单模板
│   └── services/           # 后端服务
│       ├── git/index.ts    # Git 服务（isogit + CLI，2500+ 行）
│       ├── ai.ts           # AI 服务
│       ├── gitee.ts        # Gitee OAuth + API
│       └── credential.ts   # 凭证管理（safeStorage）
├── preload/                 # 预加载脚本（contextBridge）
├── renderer/                # 渲染进程（React UI）
│   ├── App.tsx             # 根组件 + 弹窗状态管理
│   ├── components/
│   │   ├── graph/          # 提交图（Canvas DAG）
│   │   ├── diff/           # Diff 视图（词级高亮+行级暂存+minimap）
│   │   ├── layout/         # 三栏布局（侧边栏+提交图+详情）
│   │   ├── commitbar/      # 提交栏（Conventional Commits）
│   │   ├── dialogs/        # 21 个专业弹窗
│   │   ├── customactions/  # 自定义命令面板
│   │   └── terminal/       # 内置终端
│   ├── hooks/              # React Hooks（useMenuEvents 等）
│   ├── i18n/               # 国际化（zh-CN / en-US）
│   ├── stores/             # Zustand 状态管理
│   └── styles/             # 样式
├── shared/                  # 共享类型定义
├── resources/               # 应用图标
├── doc/                     # 项目文档（状态/变更日志/设计令牌/对比）
│   ├── PROJECT_STATUS.md
│   ├── CHANGELOG.md
│   ├── DESIGN_TOKENS.md
│   └── FORK_COMPARISON.md
└── docs/                    # 技术文档
    ├── PRD.md              # 产品需求文档
    ├── TECH_DESIGN.md      # 技术架构文档（本文件）
    └── FEATURE_STATUS.md   # 功能现状清单
```

## 5. 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| Git 操作 | isomorphic-git + CLI 降级 | 轻量操作无需 git 二进制，复杂操作 CLI 最可靠 |
| 提交图 | 自绘 Canvas | DOM 节点数与提交数线性增长，Canvas 性能更好 |
| Diff 渲染 | 自研 DiffView | Monaco 过重，自研可精确控制词级高亮和行级暂存 |
| 凭证存储 | safeStorage | keytar 需要 native 编译，safeStorage 是 Electron 内置 |
| 弹窗系统 | 自研 Fork 风格 | showInputBox 功能有限，专业弹窗体验远优于原生对话框 |
| 状态管理 | useReducer | 弹窗状态多且类型明确，reducer 比 useState 更清晰 |
| 分支颜色 | 名称哈希映射 | 保证侧边栏与提交图颜色一致，无需手动配置 |
