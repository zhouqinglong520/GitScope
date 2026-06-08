# Majie 码界 — 项目状态

> 最后更新：2026-06-08

## 产品概况

| 项目 | 说明 |
|------|------|
| 英文名 | Majie |
| 中文名 | 码界 |
| 定位 | 国产 Git 图形化客户端（对标 Fork / GitKraken） |
| 平台 | Windows 优先 |
| 商业模式 | 个人永久免费，增值付费面向团队/企业 |
| 技术栈 | Electron + Vite + React + TypeScript + isomorphic-git |
| 核心差异化 | 原生中文 + Gitee 深度集成 |

## 品牌视觉

| 令牌 | 值 | 用途 |
|------|-----|------|
| 签名色 | `#00d4aa` | 翠绿青，品牌主色 |
| 画布色 | `#0a0e14` | 近黑微蓝，深色背景 |
| Stash 节点色 | `#e8c547` | 金色 |
| 冲突预判色 | `#e8a847` | 警告橙 |

## 功能进展

### ✅ P0 — 核心体验（已完成）

- 词级 Diff 高亮
- 行级暂存（Stage Lines）
- 内联冲突解决
- Diff 双模式（Unified / Split）
- 冲突预判（rebase/cherry-pick/revert 前预警）
- 分支管理增强
- 最近提交消息选择器
- Pin 分支/标签
- Stash 在提交图中显示

### ✅ P1 — 高频使用（已完成）

- GitHub / GitLab 通知
- Git Flow（Feature / Release / Hotfix）
- 陈旧分支批量删除
- 外部 Diff / Merge 工具

### ✅ P2 — 锦上添花（已完成）

1. Diff minimap（右侧 Canvas 迷你地图 + 点击跳转）
2. 滚动条冲突标记（左侧 6px 窄条按 hunk 着色）
3. 分支标签着色匹配提交图颜色
4. ↩︎ 段落标记（modify group 自动标记）
5. `--update-refs`（Rebase 更新引用弹窗）
6. 粘贴 Patch（自动读剪贴板 + 命令预览）
7. Treemap（仓库磁盘占用可视化）
8. Activity Manager（操作活动管理器）
9. 自定义命令 checkbox 参数
10. 部分 Stash（`git stash push -p`）

### 🔲 P3 — 新版特性（待实现）

1. Claude AI Code Review（集成 Claude 代码审查）
2. Codex（AI 代码生成/补全）
3. 多源码目录（一个仓库多个代码目录）
4. Hunk 级文件历史（按代码块追溯历史）

### 竞品 5 大缺口（已关闭）

- 交互式 Rebase
- Worktree + 子模块
- Gitee 集成
- AI 集成
- Undo-Redo

## 架构亮点

- **三栏布局**：侧边栏（分支/标签/远程/子模块）+ 提交图 + 提交详情
- **专业弹窗系统**：21 个 Fork 风格弹窗，统一设计令牌
- **Fork 风格直线分支算法**：Lane-based 提交图渲染
- **Git 服务层**：isomorphic-git 优先 + git CLI 降级兜底

## 待办

- [ ] GitHub 仓库改名：`GitScope` → `Majie`
- [ ] GitHub Actions workflow（需 Token 添加 `workflow` scope）
- [ ] Gitee OAuth 配置
- [ ] AI API Key 配置
