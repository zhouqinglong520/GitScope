# Majie 码界 — 产品需求文档 (PRD)

> 最后更新：2026-06-08

## 1. 产品定位

**一句话**：面向国内开发者的现代 Git 图形化客户端，原生中文、深度集成国内平台。

**目标用户**：
- 核心用户：1-5 年经验的国内开发者，日常使用 Git 但不熟悉 CLI
- 扩展用户：团队技术负责人，需要管理多个仓库和 Code Review

**竞品差异化**：

| 维度 | Fork | GitKraken | Sourcetree | 码界 |
|------|------|-----------|------------|------|
| 中文体验 | 无 | 机器翻译 | 无 | 原生中文设计 |
| 国内平台 | 无 | 无 | 无 | Gitee/Coding 深度集成 |
| AI 能力 | Claude 集成 | 有限 | 无 | 国产模型 + Ollama 本地 |
| 价格 | $49.99 | $4.95/月 | 免费 | 个人永久免费 |
| 平台 | macOS | 全平台 | Win/Mac | Windows 优先 |

**商业模式**：个人永久免费，增值付费面向团队/企业（高级协作、CI/CD 集成、企业 SSO）。

## 2. 技术方案

**核心栈**：Electron + Vite + React + TypeScript + isomorphic-git

| 层次 | 技术 | 说明 |
|------|------|------|
| 框架 | Electron 33+ | 成熟稳定，GitKraken 验证 |
| 前端 | React 19 + TypeScript | 组件化、类型安全 |
| 构建 | Vite | 快速 HMR + 构建 |
| 状态管理 | Zustand | 轻量、支持异步 |
| UI | Tailwind CSS + 自研组件 | 深色主题、Fork 风格设计令牌 |
| Git 操作 | isomorphic-git + git CLI | 轻量操作用 iso，复杂操作降级 CLI |
| 提交图 | 自绘 Canvas（Lane-based） | Fork 风格直线分支算法 |
| 凭证存储 | Electron safeStorage | 系统原生加密 |
| 打包 | electron-builder | 多平台打包 |

## 3. 功能范围

### 3.1 核心体验（P0 — ✅ 已完成）

- 仓库管理：打开 / 克隆 / 初始化 / 最近打开
- 提交操作：Commit / Amend / Undo / 最近提交消息选择
- 暂存区管理：文件级 + 行级 + 词级 Diff 高亮
- 分支管理：创建 / 切换 / 删除 / 重命名 / Pin / 拖拽操作
- 标签管理：创建 / 删除 / 推送 / Pin
- 提交图：Fork 风格直线分支算法 + 分支着色 + Stash 节点
- Diff 查看：Unified / Split 双模式 + 词级高亮 + 行级暂存
- 冲突处理：三窗格解决器 + 冲突预判 + 内联 Ours/Theirs
- 远程同步：Push / Pull / Fetch + ahead/behind 显示
- Quick Launch：Ctrl+K 命令面板

### 3.2 高频使用（P1 — ✅ 已完成）

- 交互式 Rebase：pick/squash/reword/edit/drop + 拖拽排序
- GitHub 通知：Token 配置 + 未读列表 + 跳转浏览器
- Git Flow：Feature / Release / Hotfix 三阶段工作流
- 陈旧分支批量删除：已合并分支一键清理
- 外部 Diff/Merge 工具：12 种工具配置 + VSCode 深度适配
- Stash 增强：Stash/Pop/Apply/Drop/Branch + 提交图中显示

### 3.3 锦上添花（P2 — ✅ 已完成）

- Diff minimap：Canvas 迷你地图 + 点击跳转
- 滚动条冲突标记：6px 窄条按 hunk 着色
- 分支标签着色匹配提交图颜色
- ↩︎ 段落标记
- `--update-refs`：Rebase 更新引用
- 粘贴 Patch：剪贴板 → `git apply`
- Treemap：仓库磁盘占用可视化
- Activity Manager：操作活动日志管理
- 自定义命令 checkbox 参数
- 部分 Stash（`-p` 模式）

### 3.4 新版特性（P3 — 🔲 待实现）

- Claude AI Code Review：集成 Claude 代码审查
- Codex：AI 代码生成/补全
- 多源码目录：一个仓库多个代码目录
- Hunk 级文件历史：按代码块追溯历史

### 3.5 其他已完成功能

- Blame 视图 / Reflog / 子模块管理 / Worktree
- Undo-Redo 安全网（14 种可撤销操作）
- 快捷键速查 / 多仓库 Tab / 拖拽分支
- .gitignore 编辑器 / 远程仓库管理
- AI 集成（生成提交消息 + 代码审查 + Ollama 本地模型）
- Gitee 深度集成（OAuth + PR 管理）
- 内置终端 / GPG 签名 / Bisect
- 中英文 i18n（默认中文）

## 4. 设计规范

- 深色主题为主，Fork 风格设计令牌
- 签名色 `#00d4aa`（翠绿青），画布色 `#0a0e14`
- 21 个专业弹窗，统一设计令牌体系
- 操作可预见 / 反馈即时 / 错误可逆 / 精度可调 / 键盘优先

详见 `doc/DESIGN_TOKENS.md`。
