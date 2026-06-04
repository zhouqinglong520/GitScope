import type { ImageDiffInfo, FileHistoryEntry } from '@shared/types/git';
/**
 * Electron IPC 类型定义
 * 定义主进程和渲染进程之间的通信协议
 */

import type { GitCommit, GitBranch, GitStatus, GitDiff, RepositoryInfo, GitTag, CommitDetail, AuthorStats, FileCommitHistory, BranchTrackingStatus, GitStashEntry, BlameResult, StashOptions } from './git.js';

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
  getDiff: (filePath?: string, options?: DiffOptions) => Promise<GitDiff[]>;
  stage: (files: string[]) => Promise<void>;
  stageAll: () => Promise<void>;
  unstage: (files: string[]) => Promise<void>;
  unstageAll: () => Promise<void>;
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
  removeRemote: (name: string) => Promise<void>;
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
  openPath: (path: string) => Promise<void>;
  openTerminal: (path: string) => Promise<void>;
}

export interface IpcWindowApi {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void;
}

export interface IpcEventsApi {
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;
}

export interface ElectronApi {
  git: IpcGitApi;
  credential: IpcCredentialApi;
  fs: IpcFsApi;
  shell: IpcShellApi;
  window: IpcWindowApi;
  ipc: IpcEventsApi;
}

declare global {
  interface Window {
    electronAPI: ElectronApi;
  }

}
