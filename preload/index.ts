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

    /** 获取 ahead/behind 数量 */
    getAheadBehind: () => ipcRenderer.invoke('git:getAheadBehind'),

    // ========== 冲突解决 ==========
    abortMerge: () => ipcRenderer.invoke('git:abortMerge'),
    continueMerge: () => ipcRenderer.invoke('git:continueMerge'),
    abortRebase: () => ipcRenderer.invoke('git:abortRebase'),
    continueRebase: () => ipcRenderer.invoke('git:continueRebase'),
    abortCherryPick: () => ipcRenderer.invoke('git:abortCherryPick'),
    continueCherryPick: () => ipcRenderer.invoke('git:continueCherryPick'),
    getConflictedFiles: () => ipcRenderer.invoke('git:getConflictedFiles'),
    resolveConflictUseOurs: (filePath) => ipcRenderer.invoke('git:resolveConflictUseOurs', filePath),
    resolveConflictUseTheirs: (filePath) => ipcRenderer.invoke('git:resolveConflictUseTheirs', filePath),
    resolveAllConflicts: (strategy) => ipcRenderer.invoke('git:resolveAllConflicts', strategy),
    checkMergeConflict: (branch) => ipcRenderer.invoke('git:checkMergeConflict', branch),
    checkRebaseConflict: (onto) => ipcRenderer.invoke('git:checkRebaseConflict', onto),
    checkCherryPickConflict: (oid) => ipcRenderer.invoke('git:checkCherryPickConflict', oid),

    // ========== Bisect ==========
    bisectStart: (goodRef, badRef) => ipcRenderer.invoke('git:bisectStart', goodRef, badRef),
    bisectMark: (ref, kind) => ipcRenderer.invoke('git:bisectMark', ref, kind),
    bisectSkip: () => ipcRenderer.invoke('git:bisectSkip'),
    bisectReset: () => ipcRenderer.invoke('git:bisectReset'),
    getBisectState: () => ipcRenderer.invoke('git:getBisectState'),

    // ========== LFS ==========
    getLfsStatus: () => ipcRenderer.invoke('git:getLfsStatus'),
    installLfs: () => ipcRenderer.invoke('git:installLfs'),
    lfsTrack: (pattern) => ipcRenderer.invoke('git:lfsTrack', pattern),
    lfsUntrack: (pattern) => ipcRenderer.invoke('git:lfsUntrack', pattern),
    lfsLock: (filePath) => ipcRenderer.invoke('git:lfsLock', filePath),
    lfsUnlock: (filePath) => ipcRenderer.invoke('git:lfsUnlock', filePath),
    lfsPull: () => ipcRenderer.invoke('git:lfsPull'),
    lfsPush: () => ipcRenderer.invoke('git:lfsPush'),
    lfsPrune: () => ipcRenderer.invoke('git:lfsPrune'),

    // ========== 交互式变基 ==========
    getRebaseActions: (onto) => ipcRenderer.invoke('git:getRebaseActions', onto),
    executeRebasePlan: (plan, onto) => ipcRenderer.invoke('git:executeRebasePlan', plan, onto),

    // ========== Worktree ==========
    listWorktrees: () => ipcRenderer.invoke('git:listWorktrees'),
    createWorktree: (path, ref, newBranch) => ipcRenderer.invoke('git:createWorktree', path, ref, newBranch),
    removeWorktree: (path, force) => ipcRenderer.invoke('git:removeWorktree', path, force),

    // ========== Patch ==========
    createPatch: (oids, outputPath) => ipcRenderer.invoke('git:createPatch', oids, outputPath),
    applyPatch: (patchPath) => ipcRenderer.invoke('git:applyPatch', patchPath),
    listPatches: () => ipcRenderer.invoke('git:listPatches'),

    // ========== 设置 ==========
    getPreferences: () => ipcRenderer.invoke('git:getPreferences'),
    savePreferences: (prefs) => ipcRenderer.invoke('git:savePreferences', prefs),

    // ========== 自定义操作 ==========
    listCustomActions: () => ipcRenderer.invoke('git:listCustomActions'),
    saveCustomAction: (action) => ipcRenderer.invoke('git:saveCustomAction', action),
    deleteCustomAction: (id) => ipcRenderer.invoke('git:deleteCustomAction', id),
    executeCustomAction: (id) => ipcRenderer.invoke('git:executeCustomAction', id),

    // ========== 其他 ==========
    getFileDiff: (oid, filePath) => ipcRenderer.invoke('git:getFileDiff', oid, filePath),
    getFileHistoryEnhanced: (filePath, options) => ipcRenderer.invoke('git:getFileHistoryEnhanced', filePath, options),
    openInDiffTool: (filePath, oldOid, newOid) => ipcRenderer.invoke('git:openInDiffTool', filePath, oldOid, newOid),
    getRepoStats: () => ipcRenderer.invoke('git:getRepoStats'),
    getPullRequests: (remote) => ipcRenderer.invoke('git:getPullRequests', remote),
    verifyCommitSignature: (oid) => ipcRenderer.invoke('git:verifyCommitSignature', oid),
    deleteUntrackedFile: (filePath) => ipcRenderer.invoke('git:deleteUntrackedFile', filePath),
    discardChanges: (filePath) => ipcRenderer.invoke('git:discardChanges', filePath),
    getCommitTemplate: () => ipcRenderer.invoke('git:getCommitTemplate'),
    pushTag: (name, remote) => ipcRenderer.invoke('git:pushTag', name, remote),
    pushAllTags: (remote) => ipcRenderer.invoke('git:pushAllTags', remote),
    listSubmodulesEnhanced: () => ipcRenderer.invoke('git:listSubmodulesEnhanced'),
    syncSubmodule: (subPath) => ipcRenderer.invoke('git:syncSubmodule', subPath),
    getReflog: () => ipcRenderer.invoke('git:getReflog'),
    stage: (files) => ipcRenderer.invoke('git:stage', files),
    stageAll: () => ipcRenderer.invoke('git:stageAll'),
    unstage: (files) => ipcRenderer.invoke('git:unstage', files),
    unstageAll: () => ipcRenderer.invoke('git:unstageAll'),
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

  // ========== AI 服务 ==========
  ai: {
    /** 生成 Commit Message */
    generateCommitMessage: (diff: string, language?: string) =>
      ipcRenderer.invoke('ai:generateCommitMessage', diff, language),
    /** 代码审查 */
    reviewCode: (diff: string, language?: string) =>
      ipcRenderer.invoke('ai:reviewCode', diff, language),
    /** 解释代码 */
    explainCode: (code: string, language?: string) =>
      ipcRenderer.invoke('ai:explainCode', code, language),
    /** 获取配置 */
    getConfig: () => ipcRenderer.invoke('ai:getConfig'),
    /** 设置配置 */
    setConfig: (config: any) => ipcRenderer.invoke('ai:setConfig', config),
    /** 切换 Ollama */
    useOllama: (model?: string) => ipcRenderer.invoke('ai:useOllama', model),
    /** 是否已配置 */
    isConfigured: () => ipcRenderer.invoke('ai:isConfigured'),
    /** 测试连接 */
    testConnection: () => ipcRenderer.invoke('ai:testConnection'),
  },

  // ========== Gitee 集成 ==========
  gitee: {
    /** OAuth 登录 */
    login: () => ipcRenderer.invoke('gitee:login'),
    /** 登出 */
    logout: () => ipcRenderer.invoke('gitee:logout'),
    /** 检查登录状态 */
    isLoggedIn: () => ipcRenderer.invoke('gitee:isLoggedIn'),
    /** 获取当前用户 */
    getCurrentUser: () => ipcRenderer.invoke('gitee:getCurrentUser'),
    /** 获取 PR/MR 列表 */
    listPullRequests: (owner: string, repo: string, state?: string) =>
      ipcRenderer.invoke('gitee:listPullRequests', owner, repo, state),
    /** 获取 PR 详情 */
    getPullRequest: (owner: string, repo: string, number: number) =>
      ipcRenderer.invoke('gitee:getPullRequest', owner, repo, number),
    /** 创建 PR */
    createPullRequest: (owner: string, repo: string, title: string, body: string, head: string, base: string) =>
      ipcRenderer.invoke('gitee:createPullRequest', owner, repo, title, body, head, base),
    /** 合并 PR */
    mergePullRequest: (owner: string, repo: string, number: number) =>
      ipcRenderer.invoke('gitee:mergePullRequest', owner, repo, number),
    /** 获取仓库列表 */
    listRepos: (page?: number, perPage?: number) =>
      ipcRenderer.invoke('gitee:listRepos', page, perPage),
    /** 从 remote URL 解析 owner/repo */
    parseRepoFromRemote: (remoteUrl: string) =>
      ipcRenderer.invoke('gitee:parseRepoFromRemote', remoteUrl),
    /** 设置 OAuth 配置 */
    setOAuthConfig: (clientId: string, clientSecret: string) =>
      ipcRenderer.invoke('gitee:setOAuthConfig', clientId, clientSecret),
  },

  // ========== 终端服务 ==========
  terminal: {
    /** 创建终端 */
    create: (id: string, cwd?: string) =>
      ipcRenderer.invoke("terminal:create", id, cwd),

    /** 写入数据 */
    write: (id: string, data: string) =>
      ipcRenderer.send("terminal:write", id, data),

    /** 调整尺寸 */
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send("terminal:resize", id, cols, rows),

    /** 关闭终端 */
    kill: (id: string) =>
      ipcRenderer.send("terminal:kill", id),

    /** 获取默认 shell */
    getDefaultShell: () =>
      ipcRenderer.invoke("terminal:getDefaultShell"),

    /** 监听终端输出 */
    onData: (callback: (id: string, data: string) => void) => {
      const handler = (_event: any, id: string, data: string) => callback(id, data);
      ipcRenderer.on("terminal:data", handler);
      return () => ipcRenderer.removeListener("terminal:data", handler);
    },

    /** 监听终端退出 */
    onExit: (callback: (id: string, exitCode: number) => void) => {
      const handler = (_event: any, id: string, exitCode: number) => callback(id, exitCode);
      ipcRenderer.on("terminal:exit", handler);
      return () => ipcRenderer.removeListener("terminal:exit", handler);
    },
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
