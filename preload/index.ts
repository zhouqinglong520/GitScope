/**
 * Preload 脚本
 * 在渲染进程和主进程之间建立安全的通信桥梁
 * 使用 contextBridge 暴露安全的 API 给渲染进程
 */
// @ts-nocheck
export {};

const { contextBridge, ipcRenderer } = require('electron');

/**
 * 暴露给渲染进程的 API
 * 使用 contextBridge 实现安全隔离
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ========== Git 服务 ==========
  git: {
    /** 打开仓库 */
    openRepository: (path) => ipcRenderer.invoke('git:openRepository', path),

    /** 关闭仓库 */
    closeRepository: () => ipcRenderer.invoke('git:closeRepository'),

    /** 获取仓库信息 */
    getRepositoryInfo: () => ipcRenderer.invoke('git:getRepositoryInfo'),

    /** 获取提交历史 */
    getLog: (options) =>
      ipcRenderer.invoke('git:getLog', options),

    /** 获取分支列表 */
    getBranches: () => ipcRenderer.invoke('git:getBranches'),

    /** 获取当前状态 */
    getStatus: () => ipcRenderer.invoke('git:getStatus'),

    /** 获取文件差异 */
    getDiff: (filePath, commitOid) => ipcRenderer.invoke('git:getDiff', filePath, commitOid),

    /** 获取暂存区差异 */
    getStagedDiff: (filePath) => ipcRenderer.invoke('git:getStagedDiff', filePath),

    /** 暂存文件 */
    add: (files) => ipcRenderer.invoke('git:add', files),

    /** 暂存所有 */
    addAll: () => ipcRenderer.invoke('git:addAll'),

    /** 暂存所有（别名） */
    stageAll: () => ipcRenderer.invoke('git:addAll'),

    /** 取消暂存 */
    reset: (files) => ipcRenderer.invoke('git:reset', files),

    /** 提交 */
    commit: (message, options) =>
      ipcRenderer.invoke('git:commit', message, options),

    /** 推送 */
    push: (options) =>
      ipcRenderer.invoke('git:push', options),

    /** 拉取 */
    pull: (options) =>
      ipcRenderer.invoke('git:pull', options),

    /** 获取远程更新 */
    fetch: (options) => ipcRenderer.invoke('git:fetch', options),

    /** 克隆仓库 */
    clone: (options) => ipcRenderer.invoke('git:clone', options),

    /** 获取远程列表 */
    getRemotes: () => ipcRenderer.invoke('git:getRemotes'),

    /** 重置分支 */
    resetTo: (ref, mode) => ipcRenderer.invoke('git:resetTo', ref, mode),

    /** 变基交互式 */
    rebaseInteractive: (onto, todoContent) => ipcRenderer.invoke('git:rebaseInteractive', onto, todoContent),

    /** 创建分支 */
    createBranch: (name, startPoint) =>
      ipcRenderer.invoke('git:createBranch', name, startPoint),

    /** 切换分支 */
    checkout: (ref) => ipcRenderer.invoke('git:checkout', ref),

    /** 删除分支 */
    deleteBranch: (name, force) =>
      ipcRenderer.invoke('git:deleteBranch', name, force),

    /** 重命名分支 */
    renameBranch: (oldName, newName) => ipcRenderer.invoke('git:renameBranch', oldName, newName),

    /** 合并分支 */
    merge: (branch) => ipcRenderer.invoke('git:merge', branch),

    /** 恢复提交 */
    revert: (oid) => ipcRenderer.invoke('git:revert', oid),

    /** Cherry-pick 提交 */
    cherryPick: (oid) => ipcRenderer.invoke('git:cherryPick', oid),

    /** 子模块列表 */
    listSubmodules: () => ipcRenderer.invoke('git:listSubmodules'),

    /** 添加子模块 */
    addSubmodule: (url, subPath) => ipcRenderer.invoke('git:addSubmodule', url, subPath),

    /** 初始化子模块 */
    initSubmodule: (subPath) => ipcRenderer.invoke('git:initSubmodule', subPath),

    /** 更新子模块 */
    updateSubmodule: (subPath) => ipcRenderer.invoke('git:updateSubmodule', subPath),

    /** 删除子模块 */
    removeSubmodule: (subPath) => ipcRenderer.invoke('git:removeSubmodule', subPath),

    /** 责备信息 */
    blame: (filePath) => ipcRenderer.invoke('git:blame', filePath),

    /** 添加远程仓库 */
    addRemote: (name, url) => ipcRenderer.invoke('git:addRemote', name, url),

    /** 删除远程仓库 */
    removeRemote: (name) => ipcRenderer.invoke('git:removeRemote', name),

    /** 修改远程仓库 URL */
    setRemoteUrl: (name, url) => ipcRenderer.invoke('git:setRemoteUrl', name, url),

    /** 获取 Reflog */
    reflog: (maxCount) => ipcRenderer.invoke('git:reflog', maxCount),

    /** 获取标签列表 */
    getTags: () => ipcRenderer.invoke('git:getTags'),

    /** 创建标签 */
    createTag: (name, ref, message) =>
      ipcRenderer.invoke('git:createTag', name, ref, message),

    /** 删除标签 */
    deleteTag: (name) => ipcRenderer.invoke('git:deleteTag', name),

    /** 获取 stash 列表 */
    getStashes: () => ipcRenderer.invoke('git:getStashes'),

    /** 创建 stash */
    stash: (message) => ipcRenderer.invoke('git:stash', message),

    /** 恢复并删除 stash */
    stashPop: (index) => ipcRenderer.invoke('git:stashPop', index),

    /** 应用 stash */
    stashApply: (index) => ipcRenderer.invoke('git:stashApply', index),

    /** 删除 stash */
    stashDrop: (index) => ipcRenderer.invoke('git:stashDrop', index),

    /** 刷新仓库数据 */
    refresh: () => ipcRenderer.invoke('git:refresh'),

    /** 获取文件的提交历史 */
    getFileLog: (filePath, options) =>
      ipcRenderer.invoke('git:getFileHistory', filePath, options),

    /** 获取文件的提交历史（别名） */
    getFileHistory: (filePath) => ipcRenderer.invoke('git:getFileHistory', filePath),

    /** 获取指定提交的详细信息（含文件列表） */
    getCommitDetail: (oid) =>
      ipcRenderer.invoke('git:getCommitDetail', oid),

    /** 获取作者统计 */
    getAuthorStats: () => ipcRenderer.invoke('git:getAuthorStats'),

    /** 获取某文件的指定提交中的 diff */
    getFileDiff: (oid, filePath) =>
      ipcRenderer.invoke('git:getFileDiff', oid, filePath),
  },

  // ========== 凭证服务 ==========
  credential: {
    /** 保存凭证 */
    saveCredential: (credential) =>
      ipcRenderer.invoke('credential:save', credential),

    /** 获取凭证 */
    getCredential: (protocol, host) =>
      ipcRenderer.invoke('credential:get', protocol, host),

    /** 删除凭证 */
    deleteCredential: (protocol, host) =>
      ipcRenderer.invoke('credential:delete', protocol, host),
  },

  // ========== 文件系统服务 ==========
  fs: {
    /** 选择文件夹 */
    selectFolder: () => ipcRenderer.invoke('fs:selectFolder'),

    /** 读取文件 */
    readFile: (path) => ipcRenderer.invoke('fs:readFile', path),

    /** 写入文件 */
    writeFile: (path, content) =>
      ipcRenderer.invoke('fs:writeFile', path, content),

    /** 检查路径是否存在 */
    exists: (path) => ipcRenderer.invoke('fs:exists', path),

    /** 显示输入框 */
    showInputBox: (options) =>
      ipcRenderer.invoke('fs:showInputBox', options),
  },

  // ========== Shell 服务 ==========
  shell: {
    /** 打开外部链接 */
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

    /** 在文件管理器中打开路径 */
    openPath: (path) => ipcRenderer.invoke('shell:openPath', path),

    /** 在终端中打开路径 */
    openTerminal: (path) => ipcRenderer.invoke('shell:openTerminal', path),
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
    onMaximizeChange: (callback) => {
      const handler = (_event, isMaximized) => {
        callback(isMaximized);
      };
      ipcRenderer.on('window:maximizeChange', handler);
      ipcRenderer.on('window:maximize-changed', handler);
      // 返回取消订阅函数
      return () => {
        ipcRenderer.removeListener('window:maximizeChange', handler);
        ipcRenderer.removeListener('window:maximize-changed', handler);
      };
    },
  },

  // ========== IPC 事件监听 ==========
  ipc: {
    /** 监听主进程事件 */
    on: (channel, callback) => {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    },
    /** 移除事件监听 */
    removeListener: (channel, callback) => {
      ipcRenderer.removeListener(channel, callback);
    },
  },
});

console.log('[Preload] Electron API 已暴露');
