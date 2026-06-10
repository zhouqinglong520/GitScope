# Majie 码界 — 更新日志

## 2026-06-10 — Diff 渲染修复 + 分支排序 + 图形优化

### 关键修复

**gitCliExec 返回值修复（根因）**
- `gitCliExec` 原返回 `Promise<string>`，但 15 处调用方均以 `const { stdout } = await ...` 解构
- 导致 `stdout` 始终为 `undefined` → `parseDiffOutput(undefined)` 抛异常 → 全部显示 "No changes"
- 修正返回类型为 `Promise<{ stdout: string; stderr: string }>`
- 同步修复 `gitCliExecWithInput` 保持一致性

**合并提交 diff 格式修复**
- 合并提交使用 `-m` 标志产生 combined diff 格式（`++`/`--` 多列前缀），解析器无法处理
- 改用 `--first-parent` + 显式第一父 SHA，输出标准 unified diff 格式

### 分支管理增强

**远程分支按最新提交排序**
- `GitBranch` 类型新增 `timestamp` 字段（最新提交时间戳，秒级）
- `branches()` 方法为每个分支执行 `git log -1 --format=%ct` 获取时间戳
- 远程分支按最新提交时间降序排列（最近活跃的排最前）
- 本地分支在 pinned/current 优先级之后按时间降序
- 远程分支旁显示相对时间标签（如 "3天前"、"2小时前"）

### 提交图优化

**Canvas 定位与渲染**
- Canvas 从 `position: sticky` 改为 `position: absolute`，修复滚动时图形消失问题
- Canvas 覆盖层添加 `pointerEvents: 'none'`，点击事件穿透到提交行

**分支线条与标签**
- `LANE_WIDTH` 从 16 增加到 24 像素，分支线间距更清晰
- `GRAPH_MIN_WIDTH` 从 120 增加到 160 像素
- 远程分支标签显示短名称（去除 `origin/` 前缀），加 ◯ 标识
- 本地分支加 ● 标识当前分支
- 每行最多显示 3 个分支标签，超出显示 `+N`
- 分支标签添加 `max-width: 140px` + 截断 + tooltip 防止溢出

### 侧边栏
- 分支区域展开时 `overflowY: auto`，支持内容超出 `maxHeight` 时滚动
- 远程分支区域显示相对时间标签

---

## 2026-06-10 — CommitGraph 重写 + 类型系统治理

### 核心改进

**CommitGraph 提交图重写（参考 SourceGit 开源算法）**
- Path-based 连续路径追踪：每个分支是一条连续 Path，不是独立 edge
- ColorPicker 颜色回收池：路径结束时回收颜色，避免颜色浪费
- Quadratic/Cubic Bezier 统一曲线风格，告别直线+贝塞尔混搭
- 分支高亮模式：新增"全部/仅当前分支"切换，非高亮路径灰化显示
- 合并提交十字标记（SourceGit 风格）+ HEAD 双圈，视觉区分度更高
- 选中提交高亮环

**类型系统治理**
- BRANCH_COLORS 提升为 shared/constants 共享常量，CommitGraph/Sidebar 统一色板
- 消除 CommitGraph 和 Sidebar 各自定义 BRANCH_COLORS 的重复问题
- 新增 `getBranchColorByName()` 共享函数

**根因反思：为什么构建总是异常**
1. 无类型校验的开发闭环 — 沙箱无法 npm install/tsc，类型错误累积到用户本地才暴露
2. 类型定义分散 — 组件各自定义本地接口与 shared/types 冲突
3. 巨型单文件 — DiffView 超 1200 行，CommitGraph 算法+渲染混在一起

### 参考的开源项目
- SourceGit (sourcegit-scm/sourcegit)：Path-based 分支算法、ColorPicker 颜色回收、十字合并标记
- GitAhead (gitahead/gitahead)：Segment-based 图渲染
- GitExtensions (gitextensions/gitextensions)：RevWalk 提交遍历

## 2026-06-09 — TypeScript 类型冲突修复 + 文档更新

### 修复
- 12 处本地接口与 shared/types 重复定义 → 统一从 shared 导入
- GraphNode 接口更新为 Fork 风格（lane/isMainBranch/branchNames 等）
- CustomAction 添加 params 字段、LfsTrackPattern 添加 size/fileCount
- 修复 CustomActionsPanel/SettingsDialog 残留代码

### 文档
- GitHub About 更新：双语描述 + 13 个 Topics
- docs/ 目录 PRD/TECH_DESIGN/FEATURE_STATUS 全面重写
- 删除旧 .docx 文件

## 2026-06-08 — P2 功能全面补齐 + 弹窗系统 + 布局重构

### 新增功能

**P2 可视化与工具（10 项）**
- Diff minimap / 滚动条冲突标记 / 分支标签着色 / ↩︎段落标记
- --update-refs / 粘贴 Patch / Treemap / Activity Manager / 自定义命令 checkbox / 部分 Stash

**P1 功能（4 项）**
- GitHub 通知 / Git Flow / 陈旧分支批量删除 / 外部 Diff/Merge 工具

**P0 功能补齐（4 项）**
- 最近提交消息选择器 / Pin 分支标签 / Stash 在提交图中 / 冲突预判联动

### 架构改进
- 三栏布局重构 / 专业弹窗系统 / Fork 风格直线分支算法 / 弹窗设计令牌体系统一
