/**
 * Electron IPC 类型定义
 * 定义主进程和渲染进程之间的通信协议
 */

import type { GitCommit, GitBranch, GitStatus, GitDiff, RepositoryInfo, GitTag, CommitDetail, AuthorStats, FileCommitHistory, BranchTrackingStatus, GitStashEntry, BlameResult, StashOptions, ImageDiffInfo, FileHistoryEntry } from './git.js';

/** 冲突检测结果 */
export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingFiles?: string[];
}

/** Diff 选项参数 */
export interface DiffOptions {
  /** 忽略空白差异 */
  ignoreWhitespace?: boolean;
}

/** Git 服务 IPC 调用接口 */
export interface IpcGitApi {
  openRepository: (path: string) => Promise<RepositoryInfo | null>;
  closeRepository: () => Promise<void>;
  getRepositoryInfo: () => Promise<RepositoryInfo | null>;
  getLog: (options?: { ref?: string; depth?: number }) => Promise<GitCommit[]>;
  getBranches: () => Promise<GitBranch[]>;
  getStatus: () => Promise<GitStatus | null>;
  getDiff: (filePath?: string, commitOid?: string) => Promise<GitDiff[]>;
  add: (files: string[]) => Promise<void>;
  addAll: () => Promise<void>;
  stage: (files: string[]) => Promise<void>;
  stageAll: () => Promise<void>;
  unstage: (files: string[]) => Promise<void>;
  unstageAll: () => Promise<void>;
  reset: (files: string[]) => Promise<void>;
  commit: (message: string, options?: { amend?: boolean; sign?: boolean }) => Promise<string>;
  push: (options?: { remote?: string; branch?: string; force?: boolean; forceWithLease?: boolean; setUpstream?: boolean }) => Promise<void>;
  pull: (options?: { remote?: string; branch?: string; rebase?: boolean }) => Promise<void>;
  fetch: (options?: { remote?: string; prune?: boolean }) => Promise<void>;
  createBranch: (name: string, startPoint?: string) => Promise<void>;
  checkout: (ref: string) => Promise<void>;
  deleteBranch: (name: string, force?: boolean) => Promise<void>;
  renameBranch: (oldName: string, newName: string) => Promise<void>;
  merge: (branch: string) => Promise<{ success: boolean; conflict?: boolean }>;
  getTags: () => Promise<GitTag[]>;
  createTag: (name: string, ref?: string, message?: string) => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
  pushTag: (name: string, remote?: string) => Promise<void>;
  pushAllTags: (remote?: string) => Promise<void>;
  getStashes: () => Promise<GitStashEntry[]>;
  stash: (options?: StashOptions) => Promise<void>;
  stashPop: (index?: number) => Promise<void>;
  stashApply: (index?: number) => Promise<void>;
  stashDrop: (index?: number) => Promise<void>;
  stashBranch: (index: number, branchName: string) => Promise<void>;
  refresh: () => Promise<void>;
  getFileLog: (filePath: string, options?: { depth?: number }) => Promise<GitCommit[]>;
  getCommitDetail: (oid: string) => Promise<CommitDetail | null>;
  getAuthorStats: () => Promise<AuthorStats[]>;
  getFileDiff: (oid: string, filePath: string) => Promise<GitDiff[]>;
  clone: (url: string, dir: string) => Promise<void>;
  getStagedDiff: (filePath?: string, options?: DiffOptions) => Promise<GitDiff[]>;
  getRemotes: () => Promise<Array<{ name: string; url: string; type: string }>>;
  addRemote: (name: string, url: string) => Promise<void>;
  removeRemote: (name: string, url: string) => Promise<void>;
  setRemoteUrl: (name: string, url: string) => Promise<void>;
  fetchAll: (options?: { prune?: boolean }) => Promise<void>;
  getUpstream: (branch?: string) => Promise<string | null>;
  reflog: () => Promise<Array<{ hash: string; action: string; ref: string; message: string; date: string }>>;
  blame: (filePath: string) => Promise<BlameResult | null>;
  revert: (oid: string) => Promise<void>;
  cherryPick: (oid: string) => Promise<void>;
  resetTo: (ref: string, mode?: 'soft' | 'mixed' | 'hard') => Promise<void>;
  rebaseInteractive: (upstream: string, actions: Array<{ action: string; oid: string }>) => Promise<void>;
  listSubmodules: () => Promise<Array<{ name: string; path: string; url: string; status: string }>>;
  addSubmodule: (url: string, path: string) => Promise<void>;
  initSubmodule: (path: string) => Promise<void>;
  updateSubmodule: (path: string) => Promise<void>;
  removeSubmodule: (path: string) => Promise<void>;
  // ========== 冲突预判 API ==========
  checkMergeConflict: (branch: string) => Promise<ConflictCheckResult>;
  checkRebaseConflict: (upstream: string) => Promise<ConflictCheckResult>;
  checkCherryPickConflict: (oid: string) => Promise<ConflictCheckResult>;
  // ========== 外部 Diff 工具 ==========
  openInDiffTool: (filePath?: string) => Promise<boolean>;
  // ========== 分支跟踪状态 ==========
  getBranchTrackingStatus: () => Promise<Record<string, BranchTrackingStatus>>;
  getAheadBehind: () => Promise<{ ahead: number; behind: number }>;
  // ========== 提交模板 ==========
  getCommitTemplate: () => Promise<string | null>;
  // ========== 文件操作 ==========
  discardChanges: (paths: string[]) => Promise<void>;
  deleteUntrackedFile: (path: string) => Promise<void>;
  // ========== 冲突解决 ==========
  getConflictedFiles: () => Promise<Array<{ path: string; conflictCount: number }>>;
  resolveConflictUseOurs: (path: string) => Promise<void>;
  resolveConflictUseTheirs: (path: string) => Promise<void>;
  resolveAllConflicts: (strategy: 'ours' | 'theirs') => Promise<void>;
  continueMerge: () => Promise<void>;
  abortMerge: () => Promise<void>;
  continueRebase: () => Promise<void>;
  abortRebase: () => Promise<void>;
  continueCherryPick: () => Promise<void>;
  abortCherryPick: () => Promise<void>;

  /** 获取图片Diff */
  getImageDiff: (filePath: string, oldOid?: string, newOid?: string) =>
    Promise<ImageDiffInfo | null>;
  /** 获取文件历史（增强版） */
  getFileHistoryEnhanced: (filePath: string) =>
    Promise<FileHistoryEntry[]>;
  /** 获取文件在指定提交的内容(base64) */
  getFileContent: (filePath: string, oid: string) =>
    Promise<string | null>;
  /** 选中代码的历史追溯 */
  getCodeHistory: (filePath: string, options: { lineStart: number; lineEnd: number; mode: 'line' | 'string'; search?: string }) =>
    Promise<Array<{ oid: string; message: string; author: string; date: string }>>;
  /** Blame 上一版本 */
  blamePreviousRevision: (filePath: string, line: number) =>
    Promise<{ oid: string; commit: string; author: string; date: string } | null>;

  // ========== P2 新增 IPC 方法 ==========

  /** 交互式 Rebase：获取待操作提交列表 */
  getRebaseActions: (upstream: string) =>
    Promise<Array<{ oid: string; shortOid: string; message: string; author: string }>>;

  /** 交互式 Rebase：执行 Rebase 计划 */
  executeRebasePlan: (plan: import('./git').RebasePlan) =>
    Promise<void>;

  /** 子模块：列出子模块（增强版） */
  listSubmodulesEnhanced: () =>
    Promise<import('./git').SubmoduleInfo[]>;

  /** 子模块：同步子模块 */
  syncSubmodule: (path: string) =>
    Promise<void>;

  /** Worktree：列出 Worktree */
  listWorktrees: () =>
    Promise<import('./git').WorktreeInfo[]>;

  /** Worktree：创建 Worktree */
  createWorktree: (path: string, ref: string) =>
    Promise<void>;

  /** Worktree：删除 Worktree */
  removeWorktree: (path: string, force?: boolean) =>
    Promise<void>;

  /** LFS：获取 LFS 状态 */
  getLfsStatus: () =>
    Promise<import('./git').LfsStatus | null>;

  /** LFS：安装 LFS */
  installLfs: () =>
    Promise<void>;

  /** LFS：追踪模式 */
  lfsTrack: (pattern: string) =>
    Promise<void>;

  /** LFS：取消追踪 */
  lfsUntrack: (pattern: string) =>
    Promise<void>;

  /** LFS：锁定文件 */
  lfsLock: (path: string) =>
    Promise<void>;

  /** LFS：解锁文件 */
  lfsUnlock: (path: string, force?: boolean) =>
    Promise<void>;

  /** LFS：拉取 LFS 对象 */
  lfsPull: () =>
    Promise<void>;

  /** LFS：推送 LFS 对象 */
  lfsPush: () =>
    Promise<void>;

  /** LFS：修剪本地 LFS 缓存 */
  lfsPrune: () =>
    Promise<void>;

  /** Reflog：获取完整 Reflog（增强版） */
  getReflog: () =>
    Promise<import('./git').ReflogEntry[]>;

  /** 仓库统计 */
  getRepoStats: () =>
    Promise<import('./git').RepoStats | null>;

  /** 自定义操作：列出 */
  listCustomActions: () =>
    Promise<import('./git').CustomAction[]>;

  /** 自定义操作：保存 */
  saveCustomAction: (action: import('./git').CustomAction) =>
    Promise<void>;

  /** 自定义操作：删除 */
  deleteCustomAction: (id: string) =>
    Promise<void>;

  /** 自定义操作：执行 */
  executeCustomAction: (id: string, context?: { filePath?: string; ref?: string }) =>
    Promise<{ exitCode: number; stdout: string; stderr: string }>;

  /** 偏好设置：获取 */
  getPreferences: () =>
    Promise<import('./git').AppPreferences>;

  /** 偏好设置：保存 */
  savePreferences: (prefs: Partial<import('./git').AppPreferences>) =>
    Promise<void>;

  /** Bisect：开始 */
  bisectStart: (badRef: string, goodRef: string) =>
    Promise<void>;

  /** Bisect：标记 */
  bisectMark: (ref: string, result: 'good' | 'bad' | 'skip') =>
    Promise<import('./git').BisectState | null>;

  /** Bisect：跳过 */
  bisectSkip: () =>
    Promise<import('./git').BisectState | null>;

  /** Bisect：重置 */
  bisectReset: () =>
    Promise<void>;

  /** Bisect：获取状态 */
  getBisectState: () =>
    Promise<import('./git').BisectState | null>;

  /** Patch：创建 */
  createPatch: (refs: string[], outputPath?: string) =>
    Promise<string>;

  /** Patch：应用 */
  applyPatch: (patchPath: string, options?: { check?: boolean; reject?: boolean }) =>
    Promise<void>;

  /** Patch：反向应用 */
  applyPatchReverse: (patchPath: string) =>
    Promise<void>;

  /** Patch：应用并暂存 */
  applyPatchCached: (patchPath: string) =>
    Promise<void>;

  /** Patch：列出 */
  listPatches: (dir?: string) =>
    Promise<import('./git').PatchInfo[]>;

  /** 自动 Fetch 设置 */
  setAutoFetch: (intervalMinutes: number) =>
    Promise<void>;

  /** 获取合并请求列表（Gitee/GitHub） */
  getPullRequests: (remote?: string) =>
    Promise<Array<{ id: number; title: string; state: string; url: string; author: string }>>;

  /** GPG 签名验证 */
  verifyCommitSignature: (oid: string) =>
    Promise<{ valid: boolean; key: string; signer: string } | null>;

}

export interface CredentialInfo {
  username: string;
  password: string;
}

export interface IpcCredentialApi {
  saveCredential: (credential: CredentialInfo & { protocol: string; host: string }) => Promise<void>;
  getCredential: (protocol: string, host: string) => Promise<CredentialInfo | null>;
  deleteCredential: (protocol: string, host: string) => Promise<void>;
}

export interface IpcFsApi {
  selectFolder: () => Promise<string | null>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  showInputBox: (options?: { title?: string; prompt?: string; defaultValue?: string }) => Promise<string | null>;
}

export interface IpcShellApi {
  openExternal: (url: string) => Promise<void>;
  openPath: (path: string) => Promise<void>;
}

export interface IpcTerminalApi {
  create: (id: string, cwd?: string) => Promise<void>;
  write: (id: string, data: string) => void;
  resize: (id: string, cols: number, rows: number) => void;
  kill: (id: string) => void;
  getDefaultShell: () => Promise<string>;
  onData: (callback: (id: string, data: string) => void) => () => void;
  onExit: (callback: (id: string, exitCode: number) => void) => () => void;
}

export interface IpcWindowApi {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void;
}

export interface IpcApi {
  on: (channel: string, callback: (...args: any[]) => void) => void;
  removeListener: (channel: string, callback: (...args: any[]) => void) => void;
}
