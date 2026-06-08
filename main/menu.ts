/**
 * 应用菜单配置
 * 参考 Fork 的菜单结构，适配 Majie 已有功能
 */
export {};

const { Menu, app, shell, dialog } = require('electron');

let mainWindow = null;

function setMainWindow(win) {
  mainWindow = win;
}

function createAppMenu() {
  const template = [
    // 文件
    {
      label: '文件',
      submenu: [
        {
          label: '打开仓库...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:openRepo'),
        },
        {
          label: '克隆仓库...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => mainWindow?.webContents.send('menu:cloneRepo'),
        },
        {
          label: '初始化新仓库...',
          click: () => mainWindow?.webContents.send('menu:initRepo'),
        },
        { type: 'separator' },
        {
          label: '关闭仓库',
          accelerator: 'CmdOrCtrl+W',
          click: () => mainWindow?.webContents.send('menu:closeRepo'),
        },
        { type: 'separator' },
        {
          label: '最近打开',
          submenu: [], // 动态填充
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },

    // 编辑
    {
      label: '编辑',
      submenu: [
        {
          label: '撤销',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow?.webContents.send('menu:undo'),
        },
        {
          label: '重做',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => mainWindow?.webContents.send('menu:redo'),
        },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
        { type: 'separator' },
        {
          label: '查找...',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow?.webContents.send('menu:find'),
        },
      ],
    },

    // 查看
    {
      label: '查看',
      submenu: [
        {
          label: '刷新',
          accelerator: 'F5',
          click: () => mainWindow?.webContents.send('menu:refresh'),
        },
        { type: 'separator' },
        {
          label: '切换侧边栏',
          accelerator: 'CmdOrCtrl+B',
          click: () => mainWindow?.webContents.send('menu:toggleSidebar'),
        },
        { type: 'separator' },
        {
          label: '提交历史',
          click: () => mainWindow?.webContents.send('menu:showCommits'),
        },
        {
          label: '文件状态',
          click: () => mainWindow?.webContents.send('menu:showStatus'),
        },
        {
          label: '差异查看',
          click: () => mainWindow?.webContents.send('menu:showDiff'),
        },
        { type: 'separator' },
        {
          label: 'Quick Launch',
          accelerator: 'CmdOrCtrl+K',
          click: () => mainWindow?.webContents.send('menu:quickLaunch'),
        },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { role: 'togglefullscreen', label: '全屏' },
        {
          label: '放大',
          accelerator: 'CmdOrCtrl+=',
          role: 'zoomIn',
        },
        {
          label: '缩小',
          accelerator: 'CmdOrCtrl+-',
          role: 'zoomOut',
        },
        {
          label: '重置缩放',
          accelerator: 'CmdOrCtrl+0',
          role: 'resetZoom',
        },
      ],
    },

    // 仓库
    {
      label: '仓库',
      submenu: [
        {
          label: '获取',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => mainWindow?.webContents.send('menu:fetch'),
        },
        {
          label: '拉取',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => mainWindow?.webContents.send('menu:pull'),
        },
        {
          label: '推送',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow?.webContents.send('menu:push'),
        },
        { type: 'separator' },
        {
          label: '暂存更改 (Stash)',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu:stash'),
        },
        {
          label: '恢复暂存 (Stash Pop)',
          click: () => mainWindow?.webContents.send('menu:stashPop'),
        },
        { type: 'separator' },
        {
          label: '编辑 .gitignore',
          click: () => mainWindow?.webContents.send('menu:editGitignore'),
        },
        {
          label: '管理远程仓库...',
          click: () => mainWindow?.webContents.send('menu:manageRemotes'),
        },
        {
          label: '子模块...',
          click: () => mainWindow?.webContents.send('menu:submodules'),
        },
        { type: 'separator' },
        {
          label: 'Reflog 查看',
          click: () => mainWindow?.webContents.send('menu:reflog'),
        },
        {
          label: '内置终端',
          accelerator: 'CmdOrCtrl+`',
          click: () => mainWindow?.webContents.send('menu:toggleTerminal'),
        },
        {
          label: '在外部终端中打开',
          click: () => mainWindow?.webContents.send('menu:openTerminal'),
        },
        {
          label: '在资源管理器中打开',
          click: () => mainWindow?.webContents.send('menu:openInExplorer'),
        },
      ],
    },

    // 分支
    {
      label: '分支',
      submenu: [
        {
          label: '新建分支...',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => mainWindow?.webContents.send('menu:newBranch'),
        },
        {
          label: '切换分支...',
          click: () => mainWindow?.webContents.send('menu:switchBranch'),
        },
        { type: 'separator' },
        {
          label: '合并到当前分支...',
          click: () => mainWindow?.webContents.send('menu:merge'),
        },
        {
          label: '交互式 Rebase...',
          click: () => mainWindow?.webContents.send('menu:interactiveRebase'),
        },
        { type: 'separator' },
        {
          label: '重命名分支...',
          click: () => mainWindow?.webContents.send('menu:renameBranch'),
        },
        {
          label: '删除分支...',
          click: () => mainWindow?.webContents.send('menu:deleteBranch'),
        },
      ],
    },

    // 标签
    {
      label: '标签',
      submenu: [
        {
          label: '新建标签...',
          click: () => mainWindow?.webContents.send('menu:newTag'),
        },
        {
          label: '删除标签...',
          click: () => mainWindow?.webContents.send('menu:deleteTag'),
        },
        {
          label: '推送标签',
          click: () => mainWindow?.webContents.send('menu:pushTag'),
        },
      ],
    },

    // 帮助
    {
      label: '帮助',
      submenu: [
        {
          label: 'Majie 官网',
          click: () => shell.openExternal('https://github.com/zhouqinglong520/Majie'),
        },
        {
          label: '查看文档',
          click: () => shell.openExternal('https://github.com/zhouqinglong520/Majie/blob/main/README.md'),
        },
        { type: 'separator' },
        {
          label: '报告问题',
          click: () => shell.openExternal('https://github.com/zhouqinglong520/Majie/issues'),
        },
        { type: 'separator' },
        {
          label: '键盘快捷键',
          accelerator: 'CmdOrCtrl+Shift+/',
          click: () => mainWindow?.webContents.send('menu:shortcuts'),
        },
        { type: 'separator' },
        {
          label: '关于 Majie',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 Majie',
              message: 'Majie 码界',
              detail: `版本: ${app.getVersion()}\n面向国内开发者的现代 Git 图形化客户端\n\nElectron + React + TypeScript\nhttps://github.com/zhouqinglong520/Majie`,
              buttons: ['确定'],
            });
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

module.exports = { createAppMenu, setMainWindow };
