# GitScope 码界 — 功能测试执行指南

> 测试日期：2026-06-05
> 测试环境：Windows + Electron Dev Mode

---

## 🎯 测试方案说明

我们提供两种测试方式：
1. **手动测试指导**（推荐先执行）- 详细的操作步骤清单
2. **自动化测试框架**（Playwright）- 模拟点击操作的自动化脚本

---

## 📋 方案一：P0 冒烟测试 - 详细手动指导

### 测试前提
- [ ] 应用已启动（`npm run dev`）
- [ ] 准备一个有提交历史的测试仓库

---

### ✅ P0-1: 打开仓库测试

| 步骤 | 操作 | 预期结果 | 实际结果 | 状态 |
|------|------|---------|---------|------|
| 1 | 点击顶部工具栏「Open Repo」按钮 | 弹出文件选择对话框 |  | ❌/✅ |
| 2 | 选择一个 Git 仓库目录 | 对话框关闭，开始加载 |  | ❌/✅ |
| 3 | 等待加载完成 | 左侧侧边栏显示分支/标签/Stash |  | ❌/✅ |
| 4 | 检查主区域 | 提交图渲染成功，显示提交历史 |  | ❌/✅ |
| 5 | 检查状态栏 | 显示当前分支名、ahead/behind 计数 |  | ❌/✅ |

**截图记录位置：** `docs/screenshots/p0-1-open-repo/`

---

### ✅ P0-2: 提交图渲染测试

| 步骤 | 操作 | 预期结果 | 实际结果 | 状态 |
|------|------|---------|---------|------|
| 1 | 打开有多个分支的仓库 | 提交图显示彩色分支线 |  | ❌/✅ |
| 2 | 观察节点样式 | HEAD: 实心大圆 + 外环；当前分支: 实心圆；普通: 空心圆点 |  | ❌/✅ |
| 3 | 滚动提交图 | 流畅滚动，无明显卡顿 |  | ❌/✅ |
| 4 | 检查分支线样式 | S 曲线连接，当前分支在最左列 |  | ❌/✅ |

**截图记录位置：** `docs/screenshots/p0-2-commit-graph/`

---

### ✅ P0-3: Stage/Unstage 测试

| 步骤 | 操作 | 预期结果 | 实际结果 | 状态 |
|------|------|---------|---------|------|
| 1 | 修改仓库中的一个文件 | StatusPanel 显示该文件在 Unstaged 区 |  | ❌/✅ |
| 2 | 点击文件旁的复选框 Stage | 文件移到 Staged 区，DiffView 显示暂存区差异 |  | ❌/✅ |
| 3 | 再次点击复选框 Unstage | 文件移回 Unstaged 区 |  | ❌/✅ |
| 4 | 点击「Stage All」按钮 | 所有 Unstaged 文件移到 Staged 区 |  | ❌/✅ |
| 5 | 点击「Unstage All」按钮 | 所有 Staged 文件移回 Unstaged 区 |  | ❌/✅ |

**截图记录位置：** `docs/screenshots/p0-3-stage-unstage/`

---

### ✅ P0-4: 提交测试

| 步骤 | 操作 | 预期结果 | 实际结果 | 状态 |
|------|------|---------|---------|------|
| 1 | Stage 至少一个文件 | Commit Bar 显示「Stage X files」 |  | ❌/✅ |
| 2 | 在 Commit Bar 输入提交消息 | 输入正常，Conventional Commits 提示（如适用） |  | ❌/✅ |
| 3 | 点击「Commit」按钮 | 提交成功，提交图顶部新增提交 |  | ❌/✅ |
| 4 | 检查状态栏 | ahead 计数增加（如有远程仓库） |  | ❌/✅ |

**截图记录位置：** `docs/screenshots/p0-4-commit/`

---

### ✅ P0-5: Push/Pull/Fetch 测试

| 步骤 | 操作 | 预期结果 | 实际结果 | 状态 |
|------|------|---------|---------|------|
| 1 | 点击工具栏「Fetch」按钮 | 显示 Loading 状态，完成后提示成功 |  | ❌/✅ |
| 2 | 点击「Pull」按钮 | 拉取成功，提交图更新（如有新提交） |  | ❌/✅ |
| 3 | 点击「Push」按钮 | 推送成功，状态栏 ahead 计数归零 |  | ❌/✅ |

**截图记录位置：** `docs/screenshots/p0-5-push-pull-fetch/`

---

### ✅ P0-6: 分支操作测试

| 步骤 | 操作 | 预期结果 | 实际结果 | 状态 |
|------|------|---------|---------|------|
| 1 | 在左侧侧边栏点击「Branches」展开 | 显示所有分支列表 |  | ❌/✅ |
| 2 | 点击非当前分支名 | 切换分支成功，提交图更新 |  | ❌/✅ |
| 3 | 右键分支 →「Create Branch」 | 弹出输入框，输入名称后创建成功 |  | ❌/✅ |
| 4 | 右键新分支 →「Rename」 | 弹出输入框，重命名成功 |  | ❌/✅ |
| 5 | 右键新分支 →「Delete」 | 确认后删除成功 |  | ❌/✅ |

**截图记录位置：** `docs/screenshots/p0-6-branch-operations/`

---

### ✅ P0-7: 标签操作测试

| 步骤 | 操作 | 预期结果 | 实际结果 | 状态 |
|------|------|---------|---------|------|
| 1 | 在侧边栏点击「Tags」展开 | 显示所有标签列表 |  | ❌/✅ |
| 2 | 右键某个提交 →「Create Tag」 | 弹出输入框，创建标签成功 |  | ❌/✅ |
| 3 | 检查侧边栏 | 新标签出现在 Tags 列表 |  | ❌/✅ |
| 4 | 右键标签 →「Delete」 | 确认后删除成功 |  | ❌/✅ |

**截图记录位置：** `docs/screenshots/p0-7-tag-operations/`

---

### ✅ P0-8: Stash 操作测试

| 步骤 | 操作 | 预期结果 | 实际结果 | 状态 |
|------|------|---------|---------|------|
| 1 | 修改一些文件（不提交） | StatusPanel 显示 Unstaged 文件 |  | ❌/✅ |
| 2 | 点击工具栏「Stash」按钮 | 弹出输入框（可选备注），Stash 成功 |  | ❌/✅ |
| 3 | 检查侧边栏 Stash 列表 | 新 Stash 项出现 |  | ❌/✅ |
| 4 | 检查工作区 | 修改的文件恢复原状 |  | ❌/✅ |
| 5 | 右键 Stash →「Stash Pop」 | 恢复修改，Stash 移除 |  | ❌/✅ |

**截图记录位置：** `docs/screenshots/p0-8-stash-operations/`

---

### ✅ P0-9: Diff 查看测试

| 步骤 | 操作 | 预期结果 | 实际结果 | 状态 |
|------|------|---------|---------|------|
| 1 | 点击 StatusPanel 中的一个文件 | DiffView 显示该文件的差异 |  | ❌/✅ |
| 2 | 检查 Diff 样式 | 红色删除行、绿色新增行、统计条 |  | ❌/✅ |
| 3 | 点击提交图中的一个提交 | DiffView 显示该提交的所有变更 |  | ❌/✅ |
| 4 | 点击提交详情面板中的文件 | DiffView 更新显示该文件变更 |  | ❌/✅ |

**截图记录位置：** `docs/screenshots/p0-9-diff-view/`

---

### ✅ P0-10: Quick Launch 测试

| 步骤 | 操作 | 预期结果 | 实际结果 | 状态 |
|------|------|---------|---------|------|
| 1 | 按 `Ctrl+K` 或点击「Quick Launch」按钮 | 命令面板弹出 |  | ❌/✅ |
| 2 | 输入「branch」搜索 | 过滤显示分支相关命令 |  | ❌/✅ |
| 3 | 选择一个命令（如「Create Branch」） | 执行相应操作或弹出输入框 |  | ❌/✅ |
| 4 | 按 `Esc` | 命令面板关闭 |  | ❌/✅ |

**截图记录位置：** `docs/screenshots/p0-10-quick-launch/`

---

## 🤖 方案二：Playwright 自动化测试框架设置

### 步骤 1: 安装 Playwright 依赖

```bash
npm install -D @playwright/test
npx playwright install chromium
```

### 步骤 2: 创建 Playwright 配置

创建 `playwright.config.ts`：

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### 步骤 3: 创建 P0 测试用例

创建 `tests/p0-smoke-tests.spec.ts`：

```typescript
import { test, expect } from '@playwright/test';

test.describe('P0 冒烟测试', () => {
  
  test('P0-1: 应用启动正常', async ({ page }) => {
    await page.goto('http://localhost:5175');
    await expect(page.locator('text=GitScope')).toBeVisible();
  });

  test('P0-10: Quick Launch 打开和关闭', async ({ page }) => {
    await page.goto('http://localhost:5175');
    
    // 测试 Ctrl+K 打开
    await page.keyboard.press('Control+k');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // 测试 Esc 关闭
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).toBeHidden();
  });
});
```

### 步骤 4: Electron 专用测试（使用 electron-playwright）

对于完整的 Electron 测试，需要安装额外依赖：

```bash
npm install -D electron-playwright
```

创建 `tests/electron-p0.spec.ts` 专门测试 Electron 功能。

---

## 📊 测试结果汇总

测试完成后，请在此处填写结果：

| P0 用例 # | 状态 | 问题描述（如失败） |
|----------|------|------------------|
| P0-1 | ❌/✅ | |
| P0-2 | ❌/✅ | |
| P0-3 | ❌/✅ | |
| P0-4 | ❌/✅ | |
| P0-5 | ❌/✅ | |
| P0-6 | ❌/✅ | |
| P0-7 | ❌/✅ | |
| P0-8 | ❌/✅ | |
| P0-9 | ❌/✅ | |
| P0-10 | ❌/✅ | |

---

## 🐛 问题记录

测试中发现的问题请记录到：`docs/BUG_TRACKER.md`

---

## 🚀 下一步

- P0 全通过 → 执行 P1/P2 测试
- 发现 bug → 修复后重测
- 测试完成 → 进入阶段二优化
