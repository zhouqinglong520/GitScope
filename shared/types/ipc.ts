/**
 * Electron IPC 类型定义
 * 定义主进程和渲染进程之间的通信协议
 */

import type { GitCommit, GitBranch, GitStatus, GitDiff, RepositoryInfo, GitTag, CommitDetail, AuthorStats, FileCommitHistory } from './git.js';

/** Git 服务 IPC 调用接口 */
export interface IpcGitApi {
  /** 打开仓库 */
  openRepository: (path: string) => Promise<RepositoryInfo | null>;
  /** 关闭当前仓库 */
  closeRepository: () => Promise<void>;
  /** 获取仓库信息 */
  getRepositoryInfo: () => Promise<RepositoryInfo | null>;
  /** 获取提交历史 */
  getLog: (options?: { ref?: string; depth?: number }) => Promise<GitCommit[]>;
  /** 获取分支列表 */
  getBranches: () => Promise<GitBranch[]>;
  /** 获取当前状态 */
  getStatus: () => Promise<GitStatus | null>;
  /** 获取文件差异 */
  getDiff: (filePath?: string) => Promise<GitDiff[]>;
  /** 暂存文件 */
  stage: (files: string[]) => Promise<void>;
  /** 暂存所有 */
  stageAll: () => Promise<void>;
  /** 取消暂存 */
  unstage: (files: string[]) => Promise<void>;
  /** 取消暂存所有 */
  unstageAll: () => Promise<void>;
  /** 提交 */
  commit: (message: string, options?: { amend?: boolean }) => Promise<string>;
  /** 推送 */
  push: (options?: { remote?: string; branch?: string; force?: boolean }) => Promise<void>;
  /** 拉取 */
  pull: (options?: { remote?: string; branch?: string }) => Promise<void>;
  /** 获取远程更新 */
  fetch: (options?: { remote?: string }) => Promise<void>;
  /** 创建分支 */
  createBranch: (name: string, startPoint?: string) => Promise<void>;
  /** 切换分支 */
  checkout: (ref: string) => Promise<void>;
  /** 删除分支 */
  deleteBranch: (name: string, force?: boolean) => Promise<void>;
  /** 合并分支 */
  merge: (branch: string) => Promise<{ success: boolean; conflict?: boolean }>;
  /** 获取标签列表 */
  getTags: () => Promise<GitTag[]>;
  /** 创建标签 */
  createTag: (name: string, ref?: string, message?: string) => Promise<void>;
  /** 删除标签 */
  deleteTag: (name: string) => Promise<void>;
  /** 获取 stash 列表 */
  getStashes: () => Promise<Array<{ id: string; message: string; date?: string }>>;
  /** 创建 stash */
  stash: (message?: string) => Promise<void>;
  /** 恢复并删除 stash */
  stashPop: (index?: number) => Promise<void>;
  /** 应用 stash */
  stashApply: (index?: number) => Promise<void>;
  /** 删除 stash */
  stashDrop: (index?: number) => Promise<void>;
  /** 刷新仓库数据 */
  refresh: () => Promise<void>;
  
  // ========== 新增的文件和提交详情 API ==========
  /** 获取文件的提交历史 */
  getFileLog: (filePath: string, options?: { depth?: number }) => Promise<GitCommit[]>;
  /** 获取指定提交的详细信息（含文件列表） */
  getCommitDetail: (oid: string) => Promise<CommitDetail | null>;
  /** 获取作者统计 */
  getAuthorStats: () => Promise<AuthorStats[]>;
  /** 获取某文件的指定提交中的 diff */
  getFileDiff: (oid: string, filePath: string) => Promise<GitDiff[]>;
}

/** 凭证服务 IPC 调用接口 */
export interface IpcCredentialApi {
  /** 保存凭证 */
  saveCredential: (credential: { protocol: string; host: string; username: string; password: string }) => Promise<void>;
  /** 获取凭证 */
  getCredential: (protocol: string, host: string) => Promise<{ username: string; password: string } | null>;
  /** 删除凭证 */
  deleteCredential: (protocol: string, host: string) => Promise<void>;
}

/** 文件系统服务 IPC 调用接口 */
export interface IpcFsApi {
  /** 选择文件夹 */
  selectFolder: () => Promise<string | null>;
  /** 读取文件 */
  readFile: (path: string) => Promise<string>;
  /** 写入文件 */
  writeFile: (path: string, content: string) => Promise<void>;
  /** 检查路径是否存在 */
  exists: (path: string) => Promise<boolean>;
  /** 显示输入框 */
  showInputBox: (options?: { title?: string; prompt?: string; defaultValue?: string }) => Promise<string | null>;
}

/** Shell 服务 IPC 调用接口 */
export interface IpcShellApi {
  /** 在文件管理器中打开路径 */
  openPath: (path: string) => Promise<void>;
  /** 在终端中打开路径 */
  openTerminal: (path: string) => Promise<void>;
}

/** 窗口服务 IPC 调用接口 */
export interface IpcWindowApi {
  /** 最小化窗口 */
  minimize: () => void;
  /** 最大化/还原窗口 */
  maximize: () => void;
  /** 关闭窗口 */
  close: () => void;
  /** 是否最大化 */
  isMaximized: () => Promise<boolean>;
  /** 监听最大化状态变化 */
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void;
}

/** 暴露给渲染进程的 API */
export interface ElectronApi {
  git: IpcGitApi;
  credential: IpcCredentialApi;
  fs: IpcFsApi;
  shell: IpcShellApi;
  window: IpcWindowApi;
}

/** 声明全局 window 对象类型 */
declare global {
  interface Window {
    electronAPI: ElectronApi;
  }
}
