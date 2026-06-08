# Majie 码界 — 更新日志

## 2026-06-08 — P2 功能全面补齐 + 弹窗系统 + 布局重构

### 新增功能

**P2 可视化与工具（10 项）**
- Diff minimap：右侧 Canvas 迷你地图，颜色标识 add/delete/conflict/modify，点击跳转，工具栏开关
- 滚动条冲突标记：左侧 6px 窄条按 hunk 着色（绿=add / 红=delete / 橙=conflict）
- 分支标签着色：侧边栏分支/标签图标颜色与提交图一致
- ↩︎ 段落标记：modify 类型 group 自动标记段落换行
- `--update-refs`：Rebase 更新引用弹窗（分支 datalist + 命令预览）
- 粘贴 Patch：自动读剪贴板 + `--cached`/`--check` 选项 + 命令预览
- Treemap：仓库磁盘占用可视化（SVG Slice-and-Dice + Top20 列表 + 扩展名分组）
- Activity Manager：操作活动管理器（状态筛选 + 颜色边框 + 清空）
- 自定义命令 checkbox：CustomAction 支持 checkbox + input 参数
- 部分 Stash：`git stash push -p` 弹窗 + 命令预览

**P1 功能（4 项）**
- GitHub 通知面板
- Git Flow（Feature / Release / Hotfix 三阶段工作流）
- 陈旧分支批量删除
- 外部 Diff / Merge 工具配置

**P0 功能补齐（4 项）**
- 最近提交消息选择器
- Pin 分支/标签
- Stash 在提交图中显示
- 冲突预判联动

### 架构改进

- 三栏布局重构：侧边栏 + 提交图 + 提交详情
- 专业弹窗系统全面替换：21 个 Fork 风格弹窗（替换 10 个 showInputBox）
- Fork 风格直线分支算法重写
- 弹窗设计令牌体系统一
- GitService 修复重复导出 bug

### 后端新增方法

- `rebaseWithUpdateRefs()` / `applyPatchFromContent()` / `getRepoDiskUsage()`
- `logActivity()` / `updateActivity()` / `getActivityLog()` / `clearActivityLog()`
- `stashPartial()` / `gitCliExecWithInput()`

## 2026-06-07 — 冲突解决增强 + Stash/Blame

- 内联冲突解决（Ours/Theirs/Manual 三选一）
- 合并策略选择（Merge/Rebase/Squash/Fast-forward）
- Stash 管理增强（Pop/Apply/Drop/Branch）
- Blame 注释面板
- 词级 Diff 高亮

## 2026-06-05 — 品牌 + 竞品缺口 + UX 增强

- 品牌重命名：GitScope → Majie 码界
- 全局品牌视觉令牌替换
- 交互式 Rebase
- Worktree + 子模块支持
- Gitee 集成
- AI 服务集成
- 内置终端
- 5 大 UX 功能：Undo-Redo / 拖拽分支 / 快捷键速查 / Quick Launch / 多仓库 Tab
