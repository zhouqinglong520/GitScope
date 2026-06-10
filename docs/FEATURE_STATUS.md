# Majie 码界 — 功能现状清单

> 更新时间：2026-06-10 (v1.1)

## ✅ 已完成功能（48 项）

### 基础操作（17 项）

| # | 功能 | 后端 API | IPC | Preload | 前端 UI | 备注 |
|---|------|---------|-----|---------|--------|------|
| 1 | 打开仓库 | ✅ | ✅ | ✅ | ✅ | 资源管理器/复制路径/移除 |
| 2 | 提交历史（log） | ✅ | ✅ | ✅ | ✅ CommitGraph | SourceGit Path-based 算法 + 颜色回收 + Bezier 曲线 |
| 3 | 分支列表+右键 | ✅ | ✅ | ✅ | ✅ Sidebar | 切换/合并/重命名/删除/着色/时间戳排序/相对时间 |
| 4 | 当前分支切换 | ✅ checkout | ✅ | ✅ | ✅ | |
| 5 | 创建分支 | ✅ | ✅ | ✅ | ✅ 专业弹窗 | |
| 6 | 文件状态（status） | ✅ | ✅ | ✅ | ✅ StatusPanel | |
| 7 | Diff 查看 | ✅ | ✅ | ✅ | ✅ DiffView | 词级高亮+行级暂存+minimap+段落标记+合并提交first-parent |
| 8 | 暂存/取消暂存 | ✅ add/reset | ✅ | ✅ stage/unstage | ✅ | 行级+文件级 |
| 9 | 提交（commit） | ✅ | ✅ | ✅ | ✅ CommitBar | Conventional Commits + Amend |
| 10 | 标签列表+右键 | ✅ tags | ✅ | ✅ | ✅ Sidebar | 检出/推送/删除/Pin |
| 11 | Stash | ✅ stash/stashPop | ✅ | ✅ | ✅ Sidebar + 弹窗 | Pop/Apply/Drop/Branch + 部分 Stash |
| 12 | Push/Pull/Fetch | ✅ | ✅ | ✅ | ✅ 工具栏 | ahead/behind 显示 |
| 13 | Quick Launch (Ctrl+K) | — | — | — | ✅ | |
| 14 | 远程仓库管理 | ✅ addRemote/removeRemote | ✅ | ✅ | ✅ 专业弹窗 | |
| 15 | Reflog 查看 | ✅ reflog | ✅ | ✅ | ✅ 弹窗 | Reset/Detach 恢复 |
| 16 | 克隆仓库 | ✅ clone | ✅ | ✅ | ✅ 专业弹窗 | Fork 风格增强 |
| 17 | 最近打开 | ✅ | ✅ | ✅ | ✅ 菜单 | 动态列表 |

### 高级 Git 操作（11 项）

| # | 功能 | 后端 API | IPC | Preload | 前端 UI | 备注 |
|---|------|---------|-----|---------|--------|------|
| 18 | 交互式 Rebase | ✅ rebaseInteractive | ✅ | ✅ | ✅ 弹窗 | pick/squash/reword/edit/drop |
| 19 | `--update-refs` | ✅ rebaseWithUpdateRefs | ✅ | ✅ | ✅ 弹窗 | |
| 20 | 三窗格冲突解决 | ✅ merge冲突检测 | ✅ | ✅ | ✅ | THEIRS/MERGED/YOURS |
| 21 | 冲突预判 | ✅ predictConflict | ✅ | ✅ | ✅ | rebase/cherry-pick/revert |
| 22 | Cherry-pick / Revert | ✅ | ✅ | ✅ | ✅ 右键菜单 | |
| 23 | Undo/Redo | ✅ | ✅ | ✅ | ✅ | 14种可撤销操作 |
| 24 | Blame 视图 | ✅ blame | ✅ | ✅ | ✅ DiffView内 | |
| 25 | GPG 签名 | ✅ | ✅ | ✅ | ✅ | |
| 26 | Bisect | ✅ | ✅ | ✅ | ✅ | |
| 27 | Worktree | ✅ | ✅ | ✅ | ✅ | |
| 28 | 拖拽分支操作 | — | — | — | ✅ | 拖拽=合并/Cherry-pick |

### 可视化与工具（12 项）

| # | 功能 | 后端 API | IPC | Preload | 前端 UI | 备注 |
|---|------|---------|-----|---------|--------|------|
| 29 | Diff minimap | — | — | — | ✅ Canvas | 点击跳转+颜色标识 |
| 30 | 滚动条冲突标记 | — | — | — | ✅ | 6px 窄条按 hunk 着色 |
| 31 | 分支标签着色 | — | — | — | ✅ | 匹配提交图颜色 |
| 32 | ↩︎ 段落标记 | — | — | — | ✅ | modify group 自动标记 |
| 33 | Treemap | ✅ getRepoDiskUsage | ✅ | ✅ | ✅ 弹窗 | SVG Slice-and-Dice |
| 34 | Activity Manager | ✅ activityLog 全套 | ✅ | ✅ | ✅ 弹窗 | 状态筛选+清空 |
| 35 | 粘贴 Patch | ✅ applyPatchFromContent | ✅ | ✅ | ✅ 弹窗 | --cached/--check |
| 36 | 外部 Diff/Merge | ✅ | ✅ | ✅ | ✅ 弹窗 | 12种工具配置 |
| 37 | 自定义命令 | ✅ | ✅ | ✅ | ✅ | checkbox + input 参数 |
| 38 | .gitignore 编辑 | ✅ fs读写 | ✅ | ✅ | ✅ 弹窗 | 快捷规则 |
| 39 | 快捷键速查 | — | — | — | ✅ | |
| 40 | 内置终端 | ✅ | ✅ | ✅ | ✅ | |

### 远程与集成（8 项）

| # | 功能 | 后端 API | IPC | Preload | 前端 UI | 备注 |
|---|------|---------|-----|---------|--------|------|
| 41 | GitHub 通知 | ✅ | ✅ | ✅ | ✅ 面板 | Token + 未读列表 |
| 42 | Git Flow | ✅ | ✅ | ✅ | ✅ 弹窗 | Feature/Release/Hotfix |
| 43 | 陈旧分支批量删除 | ✅ | ✅ | ✅ | ✅ 弹窗 | 已合并分支一键清理 |
| 44 | Gitee 集成 | ✅ OAuth + API | ✅ | ✅ | ✅ | OAuth + PR 管理 |
| 45 | AI 集成 | ✅ OpenAI + Ollama | ✅ | ✅ | ✅ | 生成提交消息 + 代码审查 |
| 46 | 子模块管理 | ✅ 5方法 | ✅ | ✅ | ✅ | 初始化/更新/删除 |
| 47 | 多仓库 Tab | — | — | — | ✅ | |
| 48 | 中英文 i18n | — | — | — | ✅ | 默认中文 |

## 🔲 待实现（P3 — 4 项）

| # | 功能 | 优先级 | 说明 |
|---|------|-------|------|
| 1 | Claude AI Code Review | P3 | 集成 Claude 代码审查 |
| 2 | Codex | P3 | AI 代码生成/补全 |
| 3 | 多源码目录 | P3 | 一个仓库多个代码目录 |
| 4 | Hunk 级文件历史 | P3 | 按代码块追溯历史 |

## 统计

- **已追平 Fork**：~48 项
- **码界独有**：Gitee 集成、AI 集成（Ollama 本地）
- **待实现 P3**：4 项
