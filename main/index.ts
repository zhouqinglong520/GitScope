/**
 * Electron 主进程入口
 * 负责创建窗口、初始化服务、注册 IPC 处理器、设置菜单
 */
export {};

const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const { registerIpcHandlers } = require('./ipc/index');
const { createAppMenu, setMainWindow, addRecentRepo, rebuildMenu } = require('./menu');

// 开发模式标志
const isDev = !app.isPackaged;

// 主窗口实例
let mainWindow = null;

/**
 * 创建主窗口
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Majie',
    backgroundColor: '#10141a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // 设置菜单引用
  setMainWindow(mainWindow);

  // 创建并设置应用菜单
  const menu = createAppMenu();
  Menu.setApplicationMenu(menu);

  // 加载页面
  if (isDev) {
    // 开发模式：加载 Vite 开发服务器
          mainWindow.loadURL('http://localhost:5174');
    // 开发模式打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：加载构建后的文件
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 窗口关闭时
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 发送最大化状态变化给渲染进程（两种格式兼容）
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximizeChange', true);
    mainWindow?.webContents.send('window:maximize-changed', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximizeChange', false);
    mainWindow?.webContents.send('window:maximize-changed', false);
  });

  console.log('[GitGUI] 主窗口已创建');
}

// 应用准备就绪
app.whenReady().then(() => {
  console.log('[GitGUI] 应用准备就绪');

  // 注册 IPC 处理器
  registerIpcHandlers();
  console.log('[GitGUI] IPC 处理器已注册');

  // 创建主窗口
  createWindow();

  // macOS：点击 Dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前
app.on('before-quit', () => {
  console.log('[GitGUI] 应用即将退出');
});

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  console.error('[GitGUI] 未捕获的异常:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[GitGUI] 未处理的 Promise 拒绝:', reason);
});
