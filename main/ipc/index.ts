/**
 * IPC 处理器注册
 * 将主进程的服务注册到 IPC 通道
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { gitService } from '../services/git/index.js';

/**
 * 注册所有 IPC 处理器
 */
export function registerIpcHandlers(): void {
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
  ipcMain.handle('git:getDiff', async (_, filePath?: string, options?) => {
    return await gitService.diff(filePath, undefined, options);
  });

  /** 获取暂存区差异 */
  ipcMain.handle('git:getStagedDiff', async (_, filePath?: string, options?) => {
    return await gitService.stagedDiff(filePath, options);
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
  ipcMain.handle('git:stashPop', async () => {
    await gitService.stashPop();
  });

  /** 获取提交详情 */
  ipcMain.handle('git:getCommitDetail', async (_, oid: string) => {
    return await gitService.getCommitDetail(oid);
  });

  /** 获取文件提交历史 */
  ipcMain.handle('git:getFileHistory', async (_, filePath: string) => {
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

  // ========== 冲突预判 API ==========

  /** 检测合并冲突 */
  ipcMain.handle('git:checkMergeConflict', async (_, branch: string) => {
    try {
      return await gitService.checkMergeConflict(branch);
    } catch (error) {
      console.error('检测合并冲突失败:', error);
      return { hasConflict: false, conflictingFiles: [] };
    }
  });

  /** 检测变基冲突 */
  ipcMain.handle('git:checkRebaseConflict', async (_, upstream: string) => {
    try {
      return await gitService.checkRebaseConflict(upstream);
    } catch (error) {
      console.error('检测变基冲突失败:', error);
      return { hasConflict: false, conflictingFiles: [] };
    }
  });

  /** 检测 cherry-pick 冲突 */
  ipcMain.handle('git:checkCherryPickConflict', async (_, oid: string) => {
    try {
      return await gitService.checkCherryPickConflict(oid);
    } catch (error) {
      console.error('检测 Cherry-pick 冲突失败:', error);
      return { hasConflict: false, conflictingFiles: [] };
    }
  });

  // ========== 外部 Diff 工具 ==========

  /** 在外部 Diff 工具中打开 */
  ipcMain.handle('git:openInDiffTool', async (_, filePath?: string) => {
    try {
      return await gitService.openDiffTool(filePath);
    } catch (error) {
      console.error('打开 difftool 失败:', error);
      return false;
    }
  });

  // ========== 凭证服务 ==========

  /** 保存凭证 */
  ipcMain.handle('credential:save', async (_, credential) => {
    const { credentialService } = await import('../services/credential/index.js');
    await credentialService.save(credential);
  });

  /** 获取凭证 */
  ipcMain.handle('credential:get', async (_, protocol: string, host: string) => {
    const { credentialService } = await import('../services/credential/index.js');
    return await credentialService.get(protocol as 'http' | 'https', host);
  });

  /** 删除凭证 */
  ipcMain.handle('credential:delete', async (_, protocol: string, host: string) => {
    const { credentialService } = await import('../services/credential/index.js');
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

  /** 输入框 */
  ipcMain.handle('fs:showInputBox', async (_, options: { title: string; prompt: string; value?: string }) => {
    // 简单实现：通过 dialog 替代（Electron 没有原生输入框，实际项目中用 BrowserWindow 弹窗）
    const result = await dialog.showMessageBox({
      type: 'question',
      title: options.title,
      message: options.prompt,
      buttons: ['确定', '取消'],
      defaultId: 0,
    });

    // 注意：dialog.showMessageBox 无法输入文本，这里返回空字符串
    // 实际项目中应该创建一个自定义的输入弹窗
    return result.response === 0 ? '' : null;
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

  /** 在终端中打开 */
  ipcMain.handle('shell:openTerminal', async (_, cwd: string) => {
    const { shell } = await import('electron');
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

  // ========== 分支跟踪状态 ==========

  /** 获取分支跟踪状态 */
  ipcMain.handle('git:getBranchTrackingStatus', async () => {
    try {
      return await gitService.getBranchTrackingStatus();
    } catch (error) {
      console.error('获取分支跟踪状态失败:', error);
      return {};
    }
  });
