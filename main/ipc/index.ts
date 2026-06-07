/**
 * IPC 处理器注册
 * 将主进程的服务注册到 IPC 通道
 */
export {};

const { ipcMain, dialog, BrowserWindow, shell } = require('electron');
const { gitService } = require('../services/git/index');
const { credentialService } = require('../services/credential/index');

/**
 * 注册所有 IPC 处理器
 */
function registerIpcHandlers() {
  // ========== Git 服务 ==========

  /** 打开仓库 */
  ipcMain.handle('git:openRepository', async (_, repoPath: string) => {
    try {
      return await gitService.open(repoPath);
    } catch (error) {
      console.error('打开仓库失败:', error);
      return null;
    }
  });

  /** 关闭仓库 */
  ipcMain.handle('git:closeRepository', async () => {
    gitService.close();
  });

  /** 获取仓库信息 */
  ipcMain.handle('git:getRepositoryInfo', async () => {
    return await gitService.getInfo();
  });

  /** 获取提交历史 */
  ipcMain.handle('git:getLog', async (_, options?) => {
    return await gitService.log(options);
  });

  /** 获取分支列表 */
  ipcMain.handle('git:getBranches', async () => {
    return await gitService.branches();
  });

  /** 获取当前状态 */
  ipcMain.handle('git:getStatus', async () => {
    return await gitService.status();
  });

  /** 获取文件差异 */
  ipcMain.handle('git:getDiff', async (_, filePath?: string, commitOid?: string) => {
    return await gitService.diff(filePath, commitOid);
  });

  /** 获取暂存区差异 */
  ipcMain.handle('git:getStagedDiff', async (_, filePath?: string) => {
    return await gitService.stagedDiff(filePath);
  });

  /** 暂存文件 */
  ipcMain.handle('git:add', async (_, files: string[]) => {
    await gitService.add(files);
  });

  /** 暂存所有文件 */
  ipcMain.handle('git:addAll', async () => {
    await gitService.addAll();
  });

  /** 取消暂存 */
  ipcMain.handle('git:reset', async (_, files: string[]) => {
    await gitService.reset(files);
  });

  /** 暂存文件（stage） */
  ipcMain.handle('git:stage', async (_, files: string[]) => {
    await gitService.stage(files);
  });

  /** 暂存所有（stageAll） */
  ipcMain.handle('git:stageAll', async () => {
    await gitService.stageAll();
  });

  /** 取消暂存（unstage） */
  ipcMain.handle('git:unstage', async (_, files: string[]) => {
    await gitService.unstage(files);
  });

  /** 取消暂存所有（unstageAll） */
  ipcMain.handle('git:unstageAll', async () => {
    await gitService.unstageAll();
  });

  /** 提交 */
  ipcMain.handle('git:commit', async (_, message: string, options?: { amend?: boolean; author?: { name: string; email: string } }) => {
    if (options?.amend) {
      // amend 提交
      return await gitService.commit({
        message,
        author: options.author,
      });
    }
    return await gitService.commit({ message, author: options?.author });
  });

  /** 推送 */
  ipcMain.handle('git:push', async (_, options?) => {
    await gitService.push(options?.remote, options?.branch);
  });

  /** 拉取 */
  ipcMain.handle('git:pull', async (_, options?) => {
    await gitService.pull(options?.remote, options?.branch);
  });

  /** 获取远程更新 */
  ipcMain.handle('git:fetch', async (_, options?) => {
    await gitService.fetch(options?.remote, options?.branch);
  });

  /** 克隆仓库 */
  ipcMain.handle('git:clone', async (_, options) => {
    await gitService.clone(options);
  });

  /** 获取远程列表 */
  ipcMain.handle('git:getRemotes', async () => {
    return await gitService.remotes();
  });

  /** 创建分支 */
  ipcMain.handle('git:createBranch', async (_, name: string, startPoint?: string) => {
    await gitService.createBranch(name, startPoint);
  });

  /** 切换分支 */
  ipcMain.handle('git:checkout', async (_, ref: string) => {
    await gitService.checkout(ref);
  });

  /** 删除分支 */
  ipcMain.handle('git:deleteBranch', async (_, name: string, force?: boolean) => {
    await gitService.deleteBranch(name, force);
  });

  /** 合并分支 */
  ipcMain.handle('git:merge', async (_, branch: string) => {
    return await gitService.merge(branch);
  });

  /** 获取标签列表 */
  ipcMain.handle('git:getTags', async () => {
    return await gitService.tags();
  });

  /** 创建标签 */
  ipcMain.handle('git:createTag', async (_, name: string, oid?: string) => {
    await gitService.createTag(name, oid);
  });

  /** Stash 暂存 */
  ipcMain.handle('git:stash', async (_, message?: string) => {
    await gitService.stash(message);
  });

  /** Stash pop */
  ipcMain.handle('git:stashPop', async (_, index?: number) => {
    await gitService.stashPop(index);
  });

  /** Stash apply */
  ipcMain.handle('git:stashApply', async (_, index?: number) => {
    await gitService.stashApply(index);
  });

  /** Stash drop */
  ipcMain.handle('git:stashDrop', async (_, index?: number) => {
    await gitService.stashDrop(index);
  });

  /** 获取 Stash 列表 */
  ipcMain.handle('git:getStashes', async () => {
    return await gitService.getStashes();
  });

  /** 获取当前分支与上游分支的 ahead/behind 数量 */
  ipcMain.handle('git:getAheadBehind', async () => {
    return await gitService.getAheadBehind();
  });

  /** 删除标签 */
  ipcMain.handle('git:deleteTag', async (_, name: string) => {
    await gitService.deleteTag(name);
  });

  /** 重命名分支 */
  ipcMain.handle('git:renameBranch', async (_, oldName: string, newName: string) => {
    await gitService.renameBranch(oldName, newName);
  });

  /** 撤销提交 (revert) */
  ipcMain.handle('git:revert', async (_, oid: string) => {
    await gitService.revert(oid);
  });

  /** Cherry-pick 提交 */
  ipcMain.handle('git:cherryPick', async (_, oid: string) => {
    await gitService.cherryPick(oid);
  });

  /** 添加远程仓库 */
  ipcMain.handle('git:addRemote', async (_, name: string, url: string) => {
    await gitService.addRemote(name, url);
  });

  /** 删除远程仓库 */
  ipcMain.handle('git:removeRemote', async (_, name: string) => {
    await gitService.removeRemote(name);
  });

  /** 修改远程仓库 URL */
  ipcMain.handle('git:setRemoteUrl', async (_, name: string, url: string) => {
    await gitService.setRemoteUrl(name, url);
  });

  /** 获取 reflog */
  ipcMain.handle('git:reflog', async () => {
    return await gitService.reflog();
  });

  /** 获取提交详情 */
  ipcMain.handle('git:getCommitDetail', async (_, oid: string) => {
    return await gitService.getCommitDetail(oid);
  });

  /** 获取文件提交历史 */
  ipcMain.handle('git:getFileHistory', async (_, filePath: string) => {
    return await gitService.getFileHistory(filePath);
  });

  /** 获取文件提交历史（别名） */
  ipcMain.handle('git:getFileLog', async (_, filePath: string, options?: { depth?: number }) => {
    return await gitService.getFileHistory(filePath);
  });

  /** 获取作者统计 */
  ipcMain.handle('git:getAuthorStats', async () => {
    return await gitService.getAuthorStats();
  });

  /** 刷新仓库状态 */
  ipcMain.handle('git:refresh', async () => {
    await gitService.refresh();
  });

  // ========== 凭证服务 ==========

  /** 保存凭证 */
  ipcMain.handle('credential:save', async (_, credential) => {
    await credentialService.save(credential);
  });

  /** 获取凭证 */
  ipcMain.handle('credential:get', async (_, protocol: string, host: string) => {
    return await credentialService.get(protocol as 'http' | 'https', host);
  });

  /** 删除凭证 */
  ipcMain.handle('credential:delete', async (_, protocol: string, host: string) => {
    await credentialService.delete(protocol as 'http' | 'https', host);
  });

  // ========== 文件系统服务 ==========

  /** 选择文件夹 */
  ipcMain.handle('fs:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择 Git 仓库',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  /** 输入框（自定义 BrowserWindow 弹窗，支持文本输入） */
  ipcMain.handle('fs:showInputBox', async (_, options: { title?: string; prompt?: string; defaultValue?: string }) => {
    const parentWin = BrowserWindow.getFocusedWindow();
    if (!parentWin) return null;

    return new Promise<string | null>((resolve) => {
      const inputWin = new BrowserWindow({
        width: 420,
        height: 200,
        parent: parentWin,
        modal: true,
        show: false,
        resizable: false,
        frame: false,
        backgroundColor: '#2d2d30',
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
      });

      const title = options.title || '输入';
      const prompt = options.prompt || '';
      const defaultValue = options.defaultValue || '';

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #2d2d30;
      color: #cccccc;
      padding: 20px;
      -webkit-app-region: drag;
      user-select: none;
    }
    h3 { font-size: 14px; font-weight: 600; margin-bottom: 6px; color: #fff; }
    p { font-size: 12px; color: #999; margin-bottom: 14px; }
    input {
      -webkit-app-region: no-drag;
      width: 100%;
      padding: 7px 10px;
      border: 1px solid #3c3c3c;
      border-radius: 4px;
      background: #1e1e1e;
      color: #ddd;
      font-size: 13px;
      outline: none;
    }
    input:focus { border-color: #0078d4; }
    .buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; -webkit-app-region: no-drag; }
    button {
      padding: 6px 16px;
      border-radius: 4px;
      border: none;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-ok { background: #0078d4; color: #fff; }
    .btn-ok:hover { background: #1a8ae8; }
    .btn-cancel { background: #3c3c3c; color: #ccc; }
    .btn-cancel:hover { background: #4f4f4f; }
  </style>
</head>
<body>
  <h3>${title.replace(/</g, '&lt;')}</h3>
  ${prompt ? `<p>${prompt.replace(/</g, '&lt;')}</p>` : ''}
  <input id="input" type="text" value="${defaultValue.replace(/"/g, '&quot;').replace(/</g, '&lt;')}" autofocus />
  <div class="buttons">
    <button class="btn-cancel" id="cancel">取消</button>
    <button class="btn-ok" id="ok">确定</button>
  </div>
  <script>
    const input = document.getElementById('input');
    input.focus();
    input.select();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('ok').click();
      if (e.key === 'Escape') document.getElementById('cancel').click();
    });
    document.getElementById('ok').addEventListener('click', () => {
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('input-result', input.value);
    });
    document.getElementById('cancel').addEventListener('click', () => {
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('input-result', null);
    });
  </script>
</body>
</html>`;

      inputWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      inputWin.once('ready-to-show', () => {
        inputWin.show();
      });

      ipcMain.once('input-result', (_event, value: string | null) => {
        inputWin.close();
        resolve(value);
      });

      inputWin.on('closed', () => {
        ipcMain.removeAllListeners('input-result');
        resolve(null);
      });
    });
  });

  /** 读取文件 */
  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    const fs = await import('fs/promises');
    return await fs.readFile(filePath, 'utf-8');
  });

  /** 写入文件 */
  ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, content, 'utf-8');
  });

  /** 检查路径是否存在 */
  ipcMain.handle('fs:exists', async (_, filePath: string) => {
    const fs = await import('fs/promises');
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  // ========== Shell 服务 ==========

  /** 打开外部链接 */
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    await shell.openExternal(url);
  });

  /** 在文件管理器中打开路径 */
  ipcMain.handle('shell:openPath', async (_, path: string) => {
    await shell.showItemInFolder(path);
  });

  /** 在终端中打开 */
  ipcMain.handle('shell:openTerminal', async (_, cwd: string) => {
    // Windows: 打开 cmd，macOS/Linux: 打开 terminal
    const platform = process.platform;
    if (platform === 'win32') {
      const { exec } = await import('child_process');
      exec('start cmd', { cwd });
    } else if (platform === 'darwin') {
      const { exec } = await import('child_process');
      exec('open -a Terminal .', { cwd });
    } else {
      const { exec } = await import('child_process');
      exec('x-terminal-emulator .', { cwd });
    }
  });

  // ========== 窗口服务 ==========

  /** 最小化窗口 */
  ipcMain.on('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  /** 最大化/还原窗口 */
  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) {
      win.restore();
    } else {
      win?.maximize();
    }
  });

  /** 关闭窗口 */
  ipcMain.on('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });

  /** 获取最大化状态 */
  ipcMain.handle('window:isMaximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win?.isMaximized() ?? false;
  });

  console.log('[GitGUI] 所有 IPC 处理器已注册');
}

module.exports = { registerIpcHandlers };
