/**
 * Preload 脚本
 * 在渲染进程和主进程之间建立安全的通信桥梁
 * 使用 contextBridge 暴露安全的 API 给渲染进程
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronApi, DiffOptions } from '../shared/types/ipc.js';

/**
 * 暴露给渲染进程的 API
 * 使用 contextBridge 实现安全隔离
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ========== Git 服务 ==========
  git: {
    /** 打开仓库 */
    openRepository: (path: string) => ipcRenderer.invoke('git:openRepository', path),

    /** 关闭仓库 */
    closeRepository: () => ipcRenderer.invoke('git:closeRepository'),

    /** 获取仓库信息 */
    getRepositoryInfo: () => ipcRenderer.invoke('git:getRepositoryInfo'),

    /** 获取提交历史 */
    getLog: (options?: { ref?: string; depth?: number }) =>
      ipcRenderer.invoke('git:getLog', options),

    /** 获取分支列表 */
    getBranches: () => ipcRenderer.invoke('git:getBranches'),

    /** 获取当前状态 */
    getStatus: () => ipcRenderer.invoke('git:getStatus'),

    /** 获取文件差异 */
    getDiff: (filePath?: string, options?: DiffOptions) => ipcRenderer.invoke('git:getDiff', filePath, options),

    /** 暂存文件 */
    stage: (files: string[]) => ipcRenderer.invoke('git:add', files),

    /** 暂存所有 */
    stageAll: () => ipcRenderer.invoke('git:addAll'),

    /** 取消暂存 */
    unstage: (files: string[]) => ipcRenderer.invoke('git:reset', files),

    /** 取消暂存所有 */
    unstageAll: () => ipcRenderer.invoke('git:reset', ['.']),

    /** 提交 */
    commit: (message: string, options?: { amend?: boolean }) =>
      ipcRenderer.invoke('git:commit', message, options),

    /** 推送 */
    push: (options?: { remote?: string; branch?: string; force?: boolean; forceWithLease?: boolean; setUpstream?: boolean }) =>
      ipcRenderer.invoke('git:push', options),

    /** 拉取 */
    pull: (options?: { remote?: string; branch?: string; rebase?: boolean }) =>
      ipcRenderer.invoke('git:pull', options),

    /** 获取远程更新 */
    fetch: (options?: { remote?: string; prune?: boolean }) => ipcRenderer.invoke('git:fetch', options),

    /** 创建分支 */
    createBranch: (name: string, startPoint?: string) =>
      ipcRenderer.invoke('git:createBranch', name, startPoint),

    /** 切换分支 */
    checkout: (ref: string) => ipcRenderer.invoke('git:checkout', ref),

    /** 删除分支 */
    deleteBranch: (name: string, force?: boolean) =>
      ipcRenderer.invoke('git:deleteBranch', name, force),

    /** 合并分支 */
    merge: (branch: string) => ipcRenderer.invoke('git:merge', branch),

    /** 获取标签列表 */
    getTags: () => ipcRenderer.invoke('git:getTags'),

    /** 创建标签 */
    createTag: (name: string, ref?: string, message?: string) =>
      ipcRenderer.invoke('git:createTag', name, ref, message),

    /** 删除标签 */
    deleteTag: (name: string) => ipcRenderer.invoke('git:deleteTag', name),

    /** 获取 stash 列表 */
    getStashes: () => ipcRenderer.invoke('git:getStashes'),

    /** 创建 stash */
    stash: (options?: { message?: string; includeUntracked?: boolean; keepIndex?: boolean }) => 
      ipcRenderer.invoke('git:stash', options),

    /** 恢复并删除 stash */
    stashPop: (index?: number) => ipcRenderer.invoke('git:stashPop', index),

    /** 获取 stash 列表 */
    getStashes: () => ipcRenderer.invoke('git:getStashes'),

    /** 应用 stash（不弹出） */
    stashApply: (index?: number) => ipcRenderer.invoke('git:stashApply', index),

    /** 删除 stash */
    stashDrop: (index?: number) => ipcRenderer.invoke('git:stashDrop', index),

    /** 从 stash 创建分支 */
    stashBranch: (index: number, branchName: string) => 
      ipcRenderer.invoke('git:stashBranch', index, branchName),

    /** Blame */
    blame: (filePath: string) => ipcRenderer.invoke('git:blame', filePath),

    /** 刷新仓库数据 */
    refresh: () => ipcRenderer.invoke('git:refresh'),

    // ========== 新增的文件和提交详情 API ==========
    /** 获取文件的提交历史 */
    getFileLog: (filePath: string, options?: { depth?: number }) =>
      ipcRenderer.invoke('git:getFileHistory', filePath),

    /** 获取指定提交的详细信息（含文件列表） */
    getCommitDetail: (oid: string) =>
      ipcRenderer.invoke('git:getCommitDetail', oid),

    /** 获取作者统计 */
    getAuthorStats: () => ipcRenderer.invoke('git:getAuthorStats'),

    /** 获取某文件的指定提交中的 diff */
    getFileDiff: (oid: string, filePath: string) =>
      ipcRenderer.invoke('git:getFileDiff', oid, filePath),

    /** 获取暂存区差异 */
    getStagedDiff: (filePath?: string, options?: DiffOptions) =>
      ipcRenderer.invoke('git:getStagedDiff', filePath, options),

    // ========== 冲突预判 API ==========
    /** 检测合并是否会产生冲突 */
    checkMergeConflict: (branch: string) =>
      ipcRenderer.invoke('git:checkMergeConflict', branch),

    /** 检测变基是否会产生冲突 */
    checkRebaseConflict: (upstream: string) =>
      ipcRenderer.invoke('git:checkRebaseConflict', upstream),

    /** 检测 cherry-pick 是否会产生冲突 */
    checkCherryPickConflict: (oid: string) =>
      ipcRenderer.invoke('git:checkCherryPickConflict', oid),

    // ========== 外部 Diff 工具 ==========
    // ========== 远程仓库管理 ==========
    /** Fetch 所有远程仓库 */
    fetchAll: (options?: { prune?: boolean }) =>
      ipcRenderer.invoke('git:fetchAll', options),

    /** 添加远程仓库 */
    addRemote: (name: string, url: string) =>
      ipcRenderer.invoke('git:addRemote', name, url),

    /** 移除远程仓库 */
    removeRemote: (name: string) =>
      ipcRenderer.invoke('git:removeRemote', name),

    /** 设置远程仓库 URL */
    setRemoteUrl: (name: string, url: string) =>
      ipcRenderer.invoke('git:setRemoteUrl', name, url),

    /** 获取分支上游信息 */
    getUpstream: (branch?: string) =>
      ipcRenderer.invoke('git:getUpstream', branch),

    /** 在外部工具中打开 diff */
    openInDiffTool: (filePath?: string) =>
      ipcRenderer.invoke('git:openInDiffTool', filePath),
  },

  // ========== 凭证服务 ==========
  credential: {
    /** 保存凭证 */
    saveCredential: (credential: { protocol: string; host: string; username: string; password: string }) =>
      ipcRenderer.invoke('credential:save', credential),

    /** 获取凭证 */
    getCredential: (protocol: string, host: string) =>
      ipcRenderer.invoke('credential:get', protocol, host),

    /** 删除凭证 */
    deleteCredential: (protocol: string, host: string) =>
      ipcRenderer.invoke('credential:delete', protocol, host),
  },

  // ========== 文件系统服务 ==========
  fs: {
    /** 选择文件夹 */
    selectFolder: () => ipcRenderer.invoke('fs:selectFolder'),

    /** 读取文件 */
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),

    /** 写入文件 */
    writeFile: (path: string, content: string) =>
      ipcRenderer.invoke('fs:writeFile', path, content),

    /** 检查路径是否存在 */
    exists: (path: string) => ipcRenderer.invoke('fs:exists', path),

    /** 显示输入框 */
    showInputBox: (options?: { title?: string; prompt?: string; defaultValue?: string }) =>
      ipcRenderer.invoke('fs:showInputBox', options),
  },

  // ========== Shell 服务 ==========
  shell: {
    /** 在文件管理器中打开路径 */
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),

    /** 在终端中打开路径 */
    openTerminal: (path: string) => ipcRenderer.invoke('shell:openTerminal', path),
  },

  // ========== 窗口服务 ==========
  window: {
    /** 最小化 */
    minimize: () => ipcRenderer.send('window:minimize'),

    /** 最大化/还原 */
    maximize: () => ipcRenderer.send('window:maximize'),

    /** 关闭 */
    close: () => ipcRenderer.send('window:close'),

    /** 获取最大化状态 */
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

    /** 监听最大化状态变化 */
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
      const handler = (_: Electron.IpcRendererEvent, isMaximized: boolean) => {
        callback(isMaximized);
      };
      ipcRenderer.on('window:maximizeChange', handler);
      // 返回取消订阅函数
      return () => {
        ipcRenderer.removeListener('window:maximizeChange', handler);
      };
    },
  },
  // ========== IPC 事件监听 ==========
  ipc: {
    /** 监听主进程事件 */
    on: (channel: string, callback: (...args: unknown[]) => void) => {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    },
    /** 移除事件监听 */
    removeListener: (channel: string, callback: (...args: unknown[]) => void) => {
      ipcRenderer.removeListener(channel, callback as never);
    },
  },
} as ElectronApi);

console.log('[Preload] Electron API 已暴露');

    // ========== 分支跟踪状态 ==========
    /** 获取分支跟踪状态 */
    getBranchTrackingStatus: () => ipcRenderer.invoke('git:getBranchTrackingStatus'),
