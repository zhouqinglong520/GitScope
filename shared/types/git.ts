/**
 * Git 相关类型定义
 * 定义 Git 操作中使用的数据结构
 */

/** Git 提交对象 */
export interface GitCommit {
  /** 提交的 SHA 哈希值（完整 40 位） */
  oid: string;
  /** 简短的 SHA（7 位） */
  shortOid: string;
  /** 提交消息第一行（标题） */
  message: string;
  /** 完整提交消息 */
  fullMessage: string;
  /** 作者名字 */
  authorName: string;
  /** 作者邮箱 */
  authorEmail: string;
  /** 作者时间戳（Unix 时间戳，秒） */
  authorTimestamp: number;
  /** 提交者名字 */
  committerName: string;
  /** 提交者邮箱 */
  committerEmail: string;
  /** 提交时间戳 */
  committerTimestamp: number;
  /** 父提交 SHA 列表 */
  parentIds: string[];
}

/** Git 分支对象 */
export interface GitBranch {
  /** 分支名称 */
  name: string;
  /** 是否为当前分支 */
  current: boolean;
  /** 是否为远程分支 */
  remote?: string;
  /** 指向的提交 SHA */
  oid?: string;
}

/** Git 仓库状态 */
export interface GitStatus {
  /** 当前分支名称 */
  current: string | null;
  /** 是否有未提交的更改 */
  isClean: boolean;
  /** 暂存区中的文件 */
  staged: GitFileStatus[];
  /** 未暂存的文件 */
  unstaged: GitFileStatus[];
  /** 未跟踪的文件 */
  untracked: GitFileStatus[];
}

/** Git 文件状态 */
export interface GitFileStatus {
  /** 文件路径（相对于仓库根目录） */
  path: string;
  /** 文件状态：
   * - 'added': 新增文件
   * - 'modified': 已修改
   * - 'deleted': 已删除
   * - 'renamed': 已重命名
   * - 'copied': 已复制
   * - 'unchanged': 未变更
   */
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'unchanged';
  /** 如果是重命名，显示原始路径 */
  originalPath?: string;
}

/** Git 差异信息 */
export interface GitDiff {
  /** 差异类型 */
  type: 'text' | 'binary' | 'untracked' | 'deleted';
  /** 旧文件路径 */
  oldPath?: string;
  /** 新文件路径 */
  newPath?: string;
  /** 文件 hunks（差异块） */
  hunks: GitDiffHunk[];
  /** 旧文件模式 */
  oldMode?: string;
  /** 新文件模式 */
  newMode?: string;
}

/** Git 差异块 */
export interface GitDiffHunk {
  /** 旧文件起始行 */
  oldStart: number;
  /** 旧文件行数 */
  oldLines: number;
  /** 新文件起始行 */
  newStart: number;
  /** 新文件行数 */
  newLines: number;
  /** 差异行 */
  lines: GitDiffLine[];
}

/** Git 差异行 */
export interface GitDiffLine {
  /** 行类型：
   * - 'context': 上下文行（未变更）
   * - 'add': 新增行
   * - 'delete': 删除行
   */
  type: 'context' | 'add' | 'delete';
  /** 行内容 */
  content: string;
  /** 行号（旧文件） */
  oldLineNumber?: number;
  /** 行号（新文件） */
  newLineNumber?: number;
}

/** Git 远程仓库 */
export interface GitRemote {
  /** 远程名称（如 origin） */
  name: string;
  /** 远程 URL */
  url: string;
}

/** Git 标签 */
export interface GitTag {
  /** 标签名称 */
  name: string;
  /** 指向的提交 SHA */
  oid: string;
  /** 标签消息 */
  message?: string;
  /** 标签创建者 */
  tagger?: {
    name: string;
    email: string;
    timestamp: number;
  };
}

/** Git 凭证信息 */
export interface GitCredential {
  /** 协议（http 或 https） */
  protocol: 'http' | 'https';
  /** 主机名 */
  host: string;
  /** 用户名 */
  username?: string;
  /** 密码/令牌 */
  password?: string;
  /** 是否存储凭证 */
  store?: boolean;
}

/** 克隆选项 */
export interface CloneOptions {
  /** 仓库 URL */
  url: string;
  /** 本地路径 */
  path: string;
  /** 克隆深度 */
  depth?: number;
  /** 单分支克隆 */
  singleBranch?: boolean;
  /** 要克隆的分支 */
  branch?: string;
  /** 是否包含子模块 */
  recursive?: boolean;
}

/** 提交选项 */
export interface CommitOptions {
  /** 提交消息 */
  message: string;
  /** 作者信息 */
  author?: {
    name: string;
    email: string;
    timestamp?: number;
  };
}

/** 推送/拉取选项 */
export interface PushPullOptions {
  /** 远程名称 */
  remote?: string;
  /** 分支名称 */
  branch?: string;
  /** 是否强制推送 */
  force?: boolean;
  /** 认证信息 */
  credential?: GitCredential;
}

/** 日志选项 */
export interface LogOptions {
  /** 起始提交（默认为 HEAD） */
  ref?: string;
  /** 最大数量 */
  depth?: number;
  /** 是否跳过合并提交 */
  skipMerges?: boolean;
}

/** 仓库信息 */
export interface RepositoryInfo {
  /** 仓库路径 */
  path: string;
  /** 仓库名称（目录名） */
  name: string;
  /** 当前分支 */
  currentBranch: string;
  /** 是否为 git 仓库 */
  isGitRepo: boolean;
  /** 远程仓库列表 */
  remotes: GitRemote[];
}

// ============= 新增类型定义 =============

/** 文件提交历史记录 */
export interface FileCommitHistory {
  /** 文件路径 */
  filePath: string;
  /** 提交列表 */
  commits: GitCommit[];
  /** 每个提交的变更统计 */
  stats: Record<string, { additions: number; deletions: number }>;
}

/** 作者统计信息 */
export interface AuthorStats {
  /** 作者名字 */
  name: string;
  /** 作者邮箱 */
  email: string;
  /** 提交数量 */
  commitCount: number;
  /** 首次提交时间 */
  firstCommitDate: number;
  /** 最近提交时间 */
  lastCommitDate: number;
}

/** 提交筛选条件 */
export interface CommitFilter {
  /** 搜索关键词（消息/SHA/作者） */
  search?: string;
  /** 作者邮箱列表 */
  authors?: string[];
  /** 开始日期 */
  startDate?: number;
  /** 结束日期 */
  endDate?: number;
  /** 分支名称 */
  branch?: string;
}

/** 提交详情（包含文件列表） */
export interface CommitDetail {
  /** 提交信息 */
  commit: GitCommit;
  /** 修改的文件列表 */
  files: CommitFileChange[];
}

/** 提交中的文件变更 */
export interface CommitFileChange {
  /** 文件路径 */
  path: string;
  /** 变更类型 */
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'unchanged';
  /** 简写（M/A/D/R） */
  shortStatus: 'M' | 'A' | 'D' | 'R' | 'C';
  /** 新增行数 */
  additions: number;
  /** 删除行数 */
  deletions: number;
  /** 旧路径（如果是重命名） */
  oldPath?: string;
}

/** 提交图节点 */
export interface GraphNode {
  /** 提交对象 */
  commit: GitCommit;
  /** 列索引 */
  column: number;
  /** 颜色 */
  color: string;
  /** 行索引 */
  row: number;
  /** 父节点列索引列表 */
  parentColumns: number[];
  /** 该提交所在的分支名称 */
  branchName?: string;
  /** 该提交的 refs 标签 */
  refs: string[];
}
