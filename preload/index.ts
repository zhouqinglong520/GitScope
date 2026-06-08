/**
 * Preload 脚本
 * 在渲染进程和主进程之间建立安全的通信桥梁
 * 使用 contextBridge 暴露安全的 API 给渲染进程
 */
export {};

const { contextBridge, ipcRenderer } = require('electron');

/**
 * 暴露给渲染进程的 API
 * 使用 contextBridge 实现安全隔离
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ========== Git 服务 ==========
  git: {
    openRepository: (path: string) => ipcRenderer.invoke('git:openRepository', path),
    closeRepository: () => ipcRenderer.invoke('git:closeRepository'),
    getRepositoryInfo: () => ipcRenderer.invoke('git:getRepositoryInfo'),
    getLog: (options?: { ref?: string; depth?: number }) => ipcRenderer.invoke('git:getLog', options),
    getBranches: () => ipcRenderer.invoke('git:getBranches'),
    getStatus: () => ipcRenderer.invoke('git:getStatus'),
    getDiff: (filePath?: string, commitOid?: string) => ipcRenderer.invoke('git:getDiff', filePath, commitOid),
    getStagedDiff: (filePath?: string, options?: { ignoreWhitespace?: boolean }) => ipcRenderer.invoke('git:getStagedDiff', filePath, options),

    add: (files: string[]) => ipcRenderer.invoke('git:add', files),
    addAll: () => ipcRenderer.invoke('git:addAll'),
    stage: (files: string[]) => ipcRenderer.invoke('git:stage', files),
    stageAll: () => ipcRenderer.invoke('git:stageAll'),
    unstage: (files: string[]) => ipcRenderer.invoke('git:unstage', files),
    unstageAll: () => ipcRenderer.invoke('git:unstageAll'),
    reset: (files: string[]) => ipcRenderer.invoke('git:reset', files),

    commit: (message: string, options?: { amend?: boolean; sign?: boolean }) => ipcRenderer.invoke('git:commit', message, options),
    push: (options?: { remote?: string; branch?: string; force?: boolean; forceWithLease?: boolean; setUpstream?: boolean }) => ipcRenderer.invoke('git:push', options),
    pull: (options?: { remote?: string; branch?: string; rebase?: boolean }) => ipcRenderer.invoke('git:pull', options),
    fetch: (options?: { remote?: string; prune?: boolean }) => ipcRenderer.invoke('git:fetch', options),
    clone: (options: { url: string; dir: string }) => ipcRenderer.invoke('git:clone', options),

    getRemotes: () => ipcRenderer.invoke('git:getRemotes'),
    addRemote: (name: string, url: string) => ipcRenderer.invoke('git:addRemote', name, url),
    removeRemote: (name: string, url: string) => ipcRenderer.invoke('git:removeRemote', name, url),
    setRemoteUrl: (name: string, url: string) => ipcRenderer.invoke('git:setRemoteUrl', name, url),

    resetTo: (ref: string, mode?: 'soft' | 'mixed' | 'hard') => ipcRenderer.invoke('git:resetTo', ref, mode),
    rebaseInteractive: (onto: string, todoContent: string) => ipcRenderer.invoke('git:rebaseInteractive', onto, todoContent),
    createBranch: (name: string, startPoint?: string) => ipcRenderer.invoke('git:createBranch', name, startPoint),
    checkout: (ref: string) => ipcRenderer.invoke('git:checkout', ref),
    deleteBranch: (name: string, force?: boolean) => ipcRenderer.invoke('git:deleteBranch', name, force),
    renameBranch: (oldName: string, newName: string) => ipcRenderer.invoke('git:renameBranch', oldName, newName),
    merge: (branch: string) => ipcRenderer.invoke('git:merge', branch),
    revert: (oid: string) => ipcRenderer.invoke('git:revert', oid),
    cherryPick: (oid: string) => ipcRenderer.invoke('git:cherryPick', oid),

    listSubmodules: () => ipcRenderer.invoke('git:listSubmodules'),
    addSubmodule: (url: string, subPath: string) => ipcRenderer.invoke('git:addSubmodule', url, subPath),
    initSubmodule: (subPath: string) => ipcRenderer.invoke('git:initSubmodule', subPath),
    updateSubmodule: (subPath: string) => ipcRenderer.invoke('git:updateSubmodule', subPath),
    removeSubmodule: (subPath: string) => ipcRenderer.invoke('git:removeSubmodule', subPath),

    blame: (filePath: string) => ipcRenderer.invoke('git:blame', filePath),

    reflog: (maxCount?: number) => ipcRenderer.invoke('git:reflog', maxCount),
    getReflog: () => ipcRenderer.invoke('git:getReflog'),

    getTags: () => ipcRenderer.invoke('git:getTags'),
    createTag: (name: string, ref?: string, message?: string) => ipcRenderer.invoke('git:createTag', name, ref, message),
    deleteTag: (name: string) => ipcRenderer.invoke('git:deleteTag', name),
    pushTag: (name: string, remote?: string) => ipcRenderer.invoke('git:pushTag', name, remote),
    pushAllTags: (remote?: string) => ipcRenderer.invoke('git:pushAllTags', remote),

    getStashes: () => ipcRenderer.invoke('git:getStashes'),
    stash: (options?: { message?: string }) => ipcRenderer.invoke('git:stash', options),
    stashPop: (index?: number) => ipcRenderer.invoke('git:stashPop', index),
    stashApply: (index?: number) => ipcRenderer.invoke('git:stashApply', index),
    stashDrop: (index?: number) => ipcRenderer.invoke('git:stashDrop', index),

    refresh: () => ipcRenderer.invoke('git:refresh'),

    getFileLog: (filePath: string, options?: { depth?: number }) => ipcRenderer.invoke('git:getFileHistory', filePath, options),
    getFileHistory: (filePath: string) => ipcRenderer.invoke('git:getFileHistory', filePath),
    getCommitDetail: (oid: string) => ipcRenderer.invoke('git:getCommitDetail', oid),
    getAuthorStats: () => ipcRenderer.invoke('git:getAuthorStats'),
    getFileDiff: (oid: string, filePath: string) => ipcRenderer.invoke('git:getFileDiff', oid, filePath),
    getAheadBehind: () => ipcRenderer.invoke('git:getAheadBehind'),

    // ========== 冲突解决 ==========
    abortMerge: () => ipcRenderer.invoke('git:abortMerge'),
    continueMerge: () => ipcRenderer.invoke('git:continueMerge'),
    abortRebase: () => ipcRenderer.invoke('git:abortRebase'),
    continueRebase: () => ipcRenderer.invoke('git:continueRebase'),
    abortCherryPick: () => ipcRenderer.invoke('git:abortCherryPick'),
    continueCherryPick: () => ipcRenderer.invoke('git:continueCherryPick'),
    getConflictedFiles: () => ipcRenderer.invoke('git:getConflictedFiles'),
    resolveConflictUseOurs: (filePath: string) => ipcRenderer.invoke('git:resolveConflictUseOurs', filePath),
    resolveConflictUseTheirs: (filePath: string) => ipcRenderer.invoke('git:resolveConflictUseTheirs', filePath),
    resolveAllConflicts: (strategy: 'ours' | 'theirs') => ipcRenderer.invoke('git:resolveAllConflicts', strategy),
    checkMergeConflict: (branch: string) => ipcRenderer.invoke('git:checkMergeConflict', branch),
    checkRebaseConflict: (onto: string) => ipcRenderer.invoke('git:checkRebaseConflict', onto),
    checkCherryPickConflict: (oid: string) => ipcRenderer.invoke('git:checkCherryPickConflict', oid),

    // ========== Bisect ==========
    bisectStart: (goodRef: string, badRef: string) => ipcRenderer.invoke('git:bisectStart', goodRef, badRef),
    bisectMark: (ref: string, kind: 'good' | 'bad' | 'skip') => ipcRenderer.invoke('git:bisectMark', ref, kind),
    bisectSkip: () => ipcRenderer.invoke('git:bisectSkip'),
    bisectReset: () => ipcRenderer.invoke('git:bisectReset'),
    getBisectState: () => ipcRenderer.invoke('git:getBisectState'),

    // ========== LFS ==========
    getLfsStatus: () => ipcRenderer.invoke('git:getLfsStatus'),
    installLfs: () => ipcRenderer.invoke('git:installLfs'),
    lfsTrack: (pattern: string) => ipcRenderer.invoke('git:lfsTrack', pattern),
    lfsUntrack: (pattern: string) => ipcRenderer.invoke('git:lfsUntrack', pattern),
    lfsLock: (filePath: string) => ipcRenderer.invoke('git:lfsLock', filePath),
    lfsUnlock: (filePath: string, force?: boolean) => ipcRenderer.invoke('git:lfsUnlock', filePath, force),
    lfsPull: () => ipcRenderer.invoke('git:lfsPull'),
    lfsPush: () => ipcRenderer.invoke('git:lfsPush'),
    lfsPrune: () => ipcRenderer.invoke('git:lfsPrune'),

    // ========== 交互式变基 ==========
    getRebaseActions: (onto: string) => ipcRenderer.invoke('git:getRebaseActions', onto),
    executeRebasePlan: (plan: any, onto: string) => ipcRenderer.invoke('git:executeRebasePlan', plan, onto),

    // ========== Worktree ==========
    listWorktrees: () => ipcRenderer.invoke('git:listWorktrees'),
    createWorktree: (path: string, ref: string, newBranch?: boolean) => ipcRenderer.invoke('git:createWorktree', path, ref, newBranch),
    removeWorktree: (path: string, force?: boolean) => ipcRenderer.invoke('git:removeWorktree', path, force),

    // ========== Patch ==========
    createPatch: (oids: string[], outputPath?: string) => ipcRenderer.invoke('git:createPatch', oids, outputPath),
    applyPatch: (patchPath: string, options?: { check?: boolean; reject?: boolean }) => ipcRenderer.invoke('git:applyPatch', patchPath, options),
    applyPatchReverse: (patchPath: string) => ipcRenderer.invoke('git:applyPatchReverse', patchPath),
    applyPatchCached: (patchPath: string) => ipcRenderer.invoke('git:applyPatchCached', patchPath),
    listPatches: (dir?: string) => ipcRenderer.invoke('git:listPatches', dir),

    // ========== 设置 ==========
    getPreferences: () => ipcRenderer.invoke('git:getPreferences'),
    savePreferences: (prefs: any) => ipcRenderer.invoke('git:savePreferences', prefs),

    // ========== 自定义操作 ==========
    listCustomActions: () => ipcRenderer.invoke('git:listCustomActions'),
    saveCustomAction: (action: any) => ipcRenderer.invoke('git:saveCustomAction', action),
    deleteCustomAction: (id: string) => ipcRenderer.invoke('git:deleteCustomAction', id),
    executeCustomAction: (id: string) => ipcRenderer.invoke('git:executeCustomAction', id),

    // ========== 高级功能 ==========
    getFileHistoryEnhanced: (filePath: string, options?: any) => ipcRenderer.invoke('git:getFileHistoryEnhanced', filePath, options),
    openInDiffTool: (filePath?: string, oldOid?: string, newOid?: string) => ipcRenderer.invoke('git:openInDiffTool', filePath, oldOid, newOid),
    getRepoStats: () => ipcRenderer.invoke('git:getRepoStats'),
    getPullRequests: (remote?: string) => ipcRenderer.invoke('git:getPullRequests', remote),
    verifyCommitSignature: (oid: string) => ipcRenderer.invoke('git:verifyCommitSignature', oid),
    deleteUntrackedFile: (filePath: string) => ipcRenderer.invoke('git:deleteUntrackedFile', filePath),
    discardChanges: (filePath: string) => ipcRenderer.invoke('git:discardChanges', filePath),
    getCommitTemplate: () => ipcRenderer.invoke('git:getCommitTemplate'),
    listSubmodulesEnhanced: () => ipcRenderer.invoke('git:listSubmodulesEnhanced'),
    syncSubmodule: (subPath: string) => ipcRenderer.invoke('git:syncSubmodule', subPath),
    getImageDiff: (filePath: string, oldOid?: string, newOid?: string) => ipcRenderer.invoke('git:getImageDiff', filePath, oldOid, newOid),
    getFileContent: (filePath: string, oid: string) => ipcRenderer.invoke('git:getFileContent', filePath, oid),
    getCodeHistory: (filePath: string, options: { lineStart: number; lineEnd: number; mode: 'line' | 'string'; search?: string }) => ipcRenderer.invoke('git:getCodeHistory', filePath, options),
    blamePreviousRevision: (filePath: string, line: number) => ipcRenderer.invoke('git:blamePreviousRevision', filePath, line),
    setAutoFetch: (intervalMinutes: number) => ipcRenderer.invoke('git:setAutoFetch', intervalMinutes),

    // ========== P1: 新增功能 ==========
    // P1-8: 陈旧分支
    getMergedBranches: (targetBranch?: string) => ipcRenderer.invoke('git:getMergedBranches', targetBranch),
    batchDeleteBranches: (names: string[], force?: boolean) => ipcRenderer.invoke('git:batchDeleteBranches', names, force),

    // P1-7: Git Flow
    gitflowInit: (options?: any) => ipcRenderer.invoke('git:gitflowInit', options),
    gitflowIsInitialized: () => ipcRenderer.invoke('git:gitflowIsInitialized'),
    gitflowStartFeature: (name: string, base?: string) => ipcRenderer.invoke('git:gitflowStartFeature', name, base),
    gitflowFinishFeature: (name: string, options?: any) => ipcRenderer.invoke('git:gitflowFinishFeature', name, options),
    gitflowStartRelease: (version: string) => ipcRenderer.invoke('git:gitflowStartRelease', version),
    gitflowFinishRelease: (version: string, options?: any) => ipcRenderer.invoke('git:gitflowFinishRelease', version, options),
    gitflowStartHotfix: (version: string) => ipcRenderer.invoke('git:gitflowStartHotfix', version),
    gitflowFinishHotfix: (version: string, options?: any) => ipcRenderer.invoke('git:gitflowFinishHotfix', version, options),
    gitflowGetConfig: () => ipcRenderer.invoke('git:gitflowGetConfig'),

    // P1-9: 外部 Diff/Merge 工具
    openInMergeTool: (filePath: string) => ipcRenderer.invoke('git:openInMergeTool', filePath),
    getDiffToolConfig: () => ipcRenderer.invoke('git:getDiffToolConfig'),
    setDiffTool: (tool: string) => ipcRenderer.invoke('git:setDiffTool', tool),
    getMergeToolConfig: () => ipcRenderer.invoke('git:getMergeToolConfig'),
    setMergeTool: (tool: string) => ipcRenderer.invoke('git:setMergeTool', tool),

    // P1-6: GitHub 通知
    getGitHubNotifications: (token: string) => ipcRenderer.invoke('git:getGitHubNotifications', token),
  },

  // ========== 凭证服务 ==========
  credential: {
    saveCredential: (credential: any) => ipcRenderer.invoke('credential:save', credential),
    getCredential: (protocol: string, host: string) => ipcRenderer.invoke('credential:get', protocol, host),
    deleteCredential: (protocol: string, host: string) => ipcRenderer.invoke('credential:delete', protocol, host),
  },

  // ========== 文件系统服务 ==========
  fs: {
    selectFolder: () => ipcRenderer.invoke('fs:selectFolder'),
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
    exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
    showInputBox: (options?: { title?: string; prompt?: string; defaultValue?: string }) => ipcRenderer.invoke('fs:showInputBox', options),
  },

  // ========== Shell 服务 ==========
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
    openTerminal: (path: string) => ipcRenderer.invoke('shell:openTerminal', path),
  },

  // ========== AI 服务 ==========
  ai: {
    generateCommitMessage: (diff: string, language?: string) => ipcRenderer.invoke('ai:generateCommitMessage', diff, language),
    reviewCode: (diff: string, language?: string) => ipcRenderer.invoke('ai:reviewCode', diff, language),
    explainCode: (code: string, language?: string) => ipcRenderer.invoke('ai:explainCode', code, language),
    getConfig: () => ipcRenderer.invoke('ai:getConfig'),
    setConfig: (config: any) => ipcRenderer.invoke('ai:setConfig', config),
    useOllama: (model?: string) => ipcRenderer.invoke('ai:useOllama', model),
    isConfigured: () => ipcRenderer.invoke('ai:isConfigured'),
    testConnection: () => ipcRenderer.invoke('ai:testConnection'),
  },

  // ========== Gitee 集成 ==========
  gitee: {
    login: () => ipcRenderer.invoke('gitee:login'),
    logout: () => ipcRenderer.invoke('gitee:logout'),
    isLoggedIn: () => ipcRenderer.invoke('gitee:isLoggedIn'),
    getCurrentUser: () => ipcRenderer.invoke('gitee:getCurrentUser'),
    listPullRequests: (owner: string, repo: string, state?: string) => ipcRenderer.invoke('gitee:listPullRequests', owner, repo, state),
    getPullRequest: (owner: string, repo: string, number: number) => ipcRenderer.invoke('gitee:getPullRequest', owner, repo, number),
    createPullRequest: (owner: string, repo: string, title: string, body: string, head: string, base: string) => ipcRenderer.invoke('gitee:createPullRequest', owner, repo, title, body, head, base),
    mergePullRequest: (owner: string, repo: string, number: number) => ipcRenderer.invoke('gitee:mergePullRequest', owner, repo, number),
    listRepos: (page?: number, perPage?: number) => ipcRenderer.invoke('gitee:listRepos', page, perPage),
    parseRepoFromRemote: (remoteUrl: string) => ipcRenderer.invoke('gitee:parseRepoFromRemote', remoteUrl),
    setOAuthConfig: (clientId: string, clientSecret: string) => ipcRenderer.invoke('gitee:setOAuthConfig', clientId, clientSecret),
  },

  // ========== 终端服务 ==========
  terminal: {
    create: (id: string, cwd?: string) => ipcRenderer.invoke('terminal:create', id, cwd),
    write: (id: string, data: string) => ipcRenderer.send('terminal:write', id, data),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.send('terminal:resize', id, cols, rows),
    kill: (id: string) => ipcRenderer.send('terminal:kill', id),
    getDefaultShell: () => ipcRenderer.invoke('terminal:getDefaultShell'),
    onData: (callback: (id: string, data: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, data: string) => callback(id, data);
      ipcRenderer.on('terminal:data', handler);
      return () => { ipcRenderer.removeListener('terminal:data', handler); };
    },
    onExit: (callback: (id: string, exitCode: number) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, exitCode: number) => callback(id, exitCode);
      ipcRenderer.on('terminal:exit', handler);
      return () => { ipcRenderer.removeListener('terminal:exit', handler); };
    },
  },

  // ========== 窗口服务 ==========
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized);
      ipcRenderer.on('window:maximizeChange', handler);
      ipcRenderer.on('window:maximize-changed', handler);
      return () => {
        ipcRenderer.removeListener('window:maximizeChange', handler);
        ipcRenderer.removeListener('window:maximize-changed', handler);
      };
    },
  },

  // ========== IPC 事件监听 ==========
  ipc: {
    on: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args));
    },
    removeListener: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, callback);
    },
  },
});

console.log('[Preload] Electron API 已暴露');
