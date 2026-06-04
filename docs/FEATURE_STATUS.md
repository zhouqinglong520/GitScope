# GitScope 码界 — 功能现状清单

> 更新时间：2026-06-04 (v0.2)

## ✅ 已完成（后端 API + 前端 UI + IPC 通道全部打通）

| # | 功能 | 后端 API | IPC | Preload | 前端 UI | 右键菜单 |
|---|------|---------|-----|---------|--------|---------|
| 1 | 打开仓库 | ✅ | ✅ | ✅ | ✅ | ✅（资源管理器/复制路径/移除） |
| 2 | 提交历史（log） | ✅ | ✅ | ✅ | ✅ CommitGraph | ✅（创建分支/标签/Rebase/Reset/Cherry-pick/Revert/复制SHA） |
| 3 | 分支列表+右键 | ✅ | ✅ | ✅ | ✅ Sidebar | ✅ 切换/合并/重命名/删除 |
| 4 | 当前分支切换 | ✅ checkout | ✅ | ✅ | ✅ 单击分支名 | — |
| 5 | 创建分支 | ✅ | ✅ | ✅ | ✅ QuickLaunch + 右键 | ✅ |
| 6 | 文件状态（status） | ✅ | ✅ | ✅ | ✅ StatusPanel | ✅（查看历史） |
| 7 | Diff 查看 | ✅ | ✅ | ✅ | ✅ DiffView（行内Stage/Unstage+Hunk折叠+统计条） | — |
| 8 | 暂存/取消暂存 | ✅ add/reset | ✅ | ✅ stage/unstage | ✅ checkbox 勾选 | — |
| 9 | 提交（commit） | ✅ | ✅ | ✅ | ✅ CommitBar（Conventional Commits+Amend标记） | — |
| 10 | 标签列表+右键 | ✅ tags | ✅ | ✅ | ✅ Sidebar | ✅ 检出/推送/删除 |
| 11 | Stash + 右键 | ✅ stash/stashPop | ✅ | ✅ | ✅ Sidebar + QuickLaunch | ✅ 应用/弹出/删除 |
| 12 | Push/Pull/Fetch | ✅ | ✅ | ✅ | ✅ 工具栏按钮+操作反馈 | — |
| 13 | Quick Launch (Ctrl+K) | — | — | — | ✅ | — |
| 14 | 提交筛选栏 | — | — | — | ✅ CommitFilterBar | — |
| 15 | 作者筛选 | ✅ getAuthorStats | ✅ | ✅ | ✅ AuthorFilter | — |
| 16 | 提交详情面板 | ✅ getCommitDetail | ✅ | ✅ | ✅ CommitDetailPanel | — |
| 17 | 文件历史弹窗 | ✅ getFileHistory | ✅ | ✅ | ✅ FileHistory | — |
| 18 | 凭证管理 | ✅ safeStorage | ✅ | ✅ | — | — |
| 19 | 多仓库 Tab | — | — | — | ✅ | — |
| 20 | 自定义标题栏 | — | ✅ | ✅ | ✅ 最小化/最大化/关闭 | — |
| 21 | 提交图 Fork 风格 | — | — | — | ✅ 通道线+S曲线+节点分层(HEAD实心/分支实心/普通空心)+当前分支最左列 | — |
| 22 | Undo/Redo 安全网 | ✅ | ✅ | ✅ | ✅ 14种可撤销操作+Ctrl+Z/Ctrl+Shift+Z | — |
| 23 | 自定义输入弹窗 | ✅ BrowserWindow | ✅ | ✅ | ✅ 文本输入+Enter/Esc+预填值 | — |
| 24 | 远程仓库管理 | ✅ addRemote/removeRemote/setRemoteUrl | ✅ | ✅ | ✅ 侧边栏Remotes区块+右键菜单 | — |
| 25 | Reflog 查看 | ✅ reflog | ✅ | ✅ | ✅ 弹窗式浏览+Reset/Detach恢复 | — |
| 26 | Blame 视图 | ✅ blame | ✅ | ✅ | ✅ DiffView内Blame模式切换 | — |
| 27 | .gitignore 编辑 | ✅ fs读写 | ✅ | ✅ | ✅ 可视化编辑弹窗+快捷规则 | — |
| 28 | 克隆仓库 | ✅ clone | ✅ | ✅ | ✅ QuickLaunch入口+输入URL+选择目录 | — |
| 29 | 状态栏 ahead/behind | ✅ rev-list | ✅ | ✅ | ✅ 动态数字显示 | — |
| 30 | 侧边栏宽度拖拽 | — | — | — | ✅ 160-400px | — |
| 31 | 工具栏操作反馈 | — | — | — | ✅ loading+成功/失败闪烁+disabled | — |
| 32 | 子模块管理 | ✅ listSubmodules等5方法 | ✅ | ✅ | ✅ 侧边栏Submodules区段+右键菜单 | ✅ 初始化/更新/删除 |
| 33 | 交互式 Rebase | ✅ rebaseInteractive | ✅ | ✅ | ✅ 弹窗式提交列表+5种操作+排序 | — |
| 34 | 三窗格冲突解决器 | ✅ merge冲突检测 | ✅ | ✅ | ✅ Theirs/Merged/Yours三窗格+冲突解析+选择解决 | — |

## ✅ 本轮修复的 IPC 通道断裂（关键！）

| 问题 | 修复 |
|------|------|
| Preload `git:stage` → IPC 无此通道 | IPC 添加 `git:stage` 别名→`gitService.add()` |
| Preload `git:stageAll` → IPC 无此通道 | IPC 添加 `git:stageAll` 别名→`gitService.addAll()` |
| Preload `git:unstage` → IPC 无此通道 | IPC 添加 `git:unstage` 别名→`gitService.reset()` |
| Preload `git:unstageAll` → IPC 无此通道 | IPC 添加 `git:unstageAll`→`git reset HEAD .` |
| Preload `git:getFileLog` → IPC 无此通道 | IPC 添加 `git:getFileLog` 别名→`gitService.getFileHistory()` |
| Preload `git:getFileDiff` → IPC 无此通道 | IPC 添加 `git:getFileDiff`→`gitService.diff()` |
| Preload `shell:openPath` → IPC 无此通道 | IPC 添加 `shell:openPath`→`shell.openPath()` |
| Preload 缺 `getStagedDiff` | Preload 添加 `git:getStagedDiff` |
| Preload 缺 `getRemotes` | Preload 添加 `git:getRemotes` |
| IPC 类型缺 `GitRemote` import | ipc.ts 添加 `GitRemote` import |

## ❌ 未实现（需新增）

| # | 功能 | 优先级 | 说明 |
|---|------|-------|------|
| 1 | 拖拽操作 | P2 | ✅ 已完成：拖拽分支标签到另一分支=合并/Cherry-pick |
| 2 | DiffView 分区显示 | P2 | ✅ 已完成：区分 Staged/Unstaged 模式，点击 staged 文件看暂存区 diff |
| 3 | 确认对话框美化 | P2 | 危险操作目前用 confirm()，后续改为自定义弹窗 |

## 🎨 界面优化待办

| # | 优化项 | 说明 |
|---|-------|------|
| 1 | 提交图行高/字体微调 | 参考 Fork 精确对齐 |
| 2 | 暗色主题配色精调 | 对标 Fork 的配色一致性 |
| 3 | 空状态引导优化 | 首次打开/无仓库时的引导体验 |
| 4 | 分支标签显示优化 | 远程分支灰色淡化+当前分支白点标记（✅ 已完成） |
| 5 | 节点分层渲染 | HEAD实心大圆+外环/分支实心中圆/普通空心小点（✅ 已完成） |
| 6 | 当前分支最左列 | 当前分支始终在 column 0，main 在 column 1（✅ 已完成） |
