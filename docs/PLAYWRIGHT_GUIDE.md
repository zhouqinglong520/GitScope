# Playwright 自动化测试使用指南

## ✅ 已完成的设置

- ✅ Playwright 已安装 (`@playwright/test`)
- ✅ Chromium 浏览器已下载
- ✅ 测试用例已创建 (`tests/` 目录)
- ✅ 配置文件已设置 (`playwright.config.ts`)
- ✅ package.json 脚本已更新

---

## 📁 项目结构

```
d:\gitgui\
├── tests/                      # 测试目录
│   ├── p0-smoke-tests.spec.ts  # P0 冒烟测试
│   └── user-flow-tests.spec.ts # 用户流程模拟测试
├── playwright.config.ts        # Playwright 配置
├── package.json               # npm 脚本配置
└── docs/
    └── PLAYWRIGHT_GUIDE.md    # 本文档
```

---

## 🚀 快速开始

### 1. 确保 Vite 开发服务器正在运行

```bash
npm run dev:renderer
```

### 2. 运行所有测试

```bash
npm run test
```

### 3. 运行测试并查看 UI 模式（推荐）

```bash
npm run test:ui
```

### 4. 调试模式运行测试

```bash
npm run test:debug
```

### 5. 查看测试报告

```bash
npm run test:report
```

---

## 🎯 可用的测试脚本

| 命令 | 说明 |
|------|------|
| `npm run test` | 运行所有测试（无头模式） |
| `npm run test:ui` | 运行测试并打开 UI 界面 |
| `npm run test:debug` | 调试模式运行测试 |
| `npm run test:report` | 查看 HTML 测试报告 |

---

## 🔍 测试用例说明

### tests/p0-smoke-tests.spec.ts
P0 冒烟测试，包含：
- 应用启动和基础UI检查
- Quick Launch 打开、搜索和关闭
- UI 交互元素点击测试
- 键盘快捷键响应测试
- 页面 DOM 结构完整性检查

### tests/user-flow-tests.spec.ts
用户流程模拟测试，包含：
- 应用界面探索（鼠标移动、滚动）
- 快捷键组合测试
- UI 元素点击探索
- 自动截图记录

---

## 💡 如何编写新的测试

### 基础测试模板

```typescript
import { test, expect } from '@playwright/test';

test.describe('测试组名称', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5177');
  });

  test('测试名称', async ({ page }) => {
    // 测试代码
    await expect(page.locator('selector')).toBeVisible();
  });

});
```

### 常用 Playwright API

```typescript
// 点击元素
await page.click('button');

// 填充输入框
await page.fill('input', 'text');

// 按下键盘
await page.keyboard.press('Control+K');

// 移动鼠标
await page.mouse.move(x, y);

// 截图
await page.screenshot({ path: 'screenshot.png' });

// 等待元素可见
await page.locator('selector').waitFor();

// 断言
await expect(page.locator('text=Hello')).toBeVisible();
```

---

## 📊 测试报告

测试运行后会生成 HTML 报告，包含：
- 测试通过/失败状态
- 失败截图
- 视频录制（失败时）
- 追踪信息（便于调试）

---

## 🔧 配置说明

### playwright.config.ts

- `baseURL`: 测试的基础 URL（当前：http://localhost:5177）
- `testDir`: 测试文件目录（`./tests`）
- `screenshot`: 截图策略（`only-on-failure`）
- `video`: 视频录制策略（`retain-on-failure`）
- `projects`: 测试的浏览器（仅 Chromium）

---

## 🐛 常见问题

### 问题 1: 端口被占用

如果 Vite 启动在其他端口，更新：
- `playwright.config.ts` 中的 `baseURL`
- 测试文件中的 `page.goto()` URL

### 问题 2: 浏览器未安装

```bash
npx playwright install chromium
```

### 问题 3: 测试超时

在 `playwright.config.ts` 中增加超时时间：

```typescript
use: {
  actionTimeout: 10000,
  navigationTimeout: 30000,
}
```

---

## 🎓 进阶：Electron 集成测试

对于完整的 Electron 应用测试（包括主进程），可以使用：

```bash
npm install -D electron-playwright
```

参考：https://playwright.dev/docs/api/class-electron

---

## 📚 更多资源

- Playwright 官方文档：https://playwright.dev
- Playwright 测试编写：https://playwright.dev/docs/writing-tests
- Playwright API 参考：https://playwright.dev/docs/api/class-playwright
