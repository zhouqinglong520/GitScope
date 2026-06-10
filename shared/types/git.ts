/**
 * Git 相关类型定义
 * 定义 Git 操作中使用的数据结构
 */

// ============= 分支颜色常量 =============

/**
 * 分支图默认颜色池（10 种颜色）
 * 参考 SourceGit 配色方案
 */
export const BRANCH_COLORS = [
  '#5b8def', // 蓝色 - 主分支
  '#e05673', // 红色
  '#68c263', // 绿色
  '#c9a73c', // 黄色
  '#a06cd5', // 紫色
  '#3eb4c6', // 青色
  '#d4844e', // 橙色
  '#e86580', // 粉色
  '#7ec8e3', // 浅蓝
  '#b5e48c', // 浅绿
];

/**
 * 根据分支名获取颜色
 * @param branchName 分支名称
 * @param isHead 是否为 HEAD 所在分支
 * @returns 颜色值
 */
export function getBranchColorByName(branchName: string, isHead: boolean = false): string {
  // HEAD 分支使用特殊颜色
  if (isHead) {
    return '#f0b429'; // 金色强调
  }
  
  // 主分支颜色
  if (branchName === 'main' || branchName === 'master') {
    return BRANCH_COLORS[0];
  }
  
  // 开发分支
  if (branchName === 'develop' || branchName === 'dev') {
    return BRANCH_COLORS[1];
  }
  
  // origin/HEAD 特殊处理
  if (branchName.startsWith('origin/HEAD')) {
    return '#9e9e9e';
  }
  
  // 远程分支
  if (branchName.startsWith('origin/')) {
    return '#00bcd4';
  }
  
  // 功能分支 - 紫色系
  if (branchName.startsWith('feature/') || branchName.startsWith('feat/')) {
    return BRANCH_COLORS[4];
  }
  
  // 修复分支 - 橙红色系
  if (branchName.startsWith('fix/') || branchName.startsWith('bugfix/')) {
    return BRANCH_COLORS[6];
  }
  
  // 热修复分支 - 红色系
  if (branchName.startsWith('hotfix/')) {
    return BRANCH_COLORS[1];
  }
  
  // 发布分支 - 橙色系
  if (branchName.startsWith('release/') || branchName.startsWith('rel/')) {
    return BRANCH_COLORS[6];
  }
  
  // 标签
  if (branchName.startsWith('tag:')) {
    return '#795548';
  }
  
  // 其他分支 - 使用哈希分配固定颜色
  let hash = 0;
  for (let i = 0; i < branchName.length; i++) {
    hash = ((hash << 5) - hash) + branchName.charCodeAt(i);
    hash = hash & hash;
  }
  const colorIndex = Math.abs(hash) % BRANCH_COLORS.length;
  return BRANCH_COLORS[colorIndex];
}

/**
 * 分支颜色回收池
 * 用于 Path-based 连续路径追踪中，路径结束时颜色回收再利用
 */
export class ColorPool {
  private usedColors: Set<string> = new Set();
  private recycledColors: string[] = [];
  
  /**
   * 获取下一个可用颜色
   */
  getNextColor(): string {
    // 优先使用回收的颜色
    if (this.recycledColors.length > 0) {
      const color = this.recycledColors.pop()!;
      this.usedColors.add(color);
      return color;
    }
    
    // 从颜色池中找一个未使用的颜色
    for (const color of BRANCH_COLORS) {
      if (!this.usedColors.has(color)) {
        this.usedColors.add(color);
        return color;
      }
    }
    
    // 所有颜色都用过了，返回第一个颜色
    return BRANCH_COLORS[0];
  }
  
  /**
   * 回收颜色（路径结束时调用）
   */
  recycleColor(color: string): void {
    this.usedColors.delete(color);
    if (!this.recycledColors.includes(color)) {
      this.recycledColors.push(color);
    }
  }
  
  /**
   * 重置颜色池
   */
  reset(): void {
    this.usedColors.clear();
    this.recycledColors = [];
  }
}

// ============= Git 类型定义 =============

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
  /** 指向该提交的引用名称（分支、标签等），用于图表装饰 */
  refs?: string[];
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
  /** 最新提交时间戳（秒） */
  timestamp?: number;
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
  type: 'text' | 'binary' | 'untracked' | 'deleted' | 'renamed';
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
  /** 重命名相似度百分比（0-100），仅 renamed 类型 */
  similarity?: number;
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
  /** 是否获取所有分支的提交（--all） */
  all?: boolean;
  /** 跳过前 N 条提交（用于增量加载） */
  skip?: number;
}

/** 仓库信息 */
export interface RepositoryInfo {
  /** 仓库路径 */
  path: string;
  /** 仓库名称（目录名） */
  name: string;
  /** 当前分支 */
  currentBranch: string | null;
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
  /** Lane 索引（Fork 风格直线分支算法） */
  lane: number;
  /** 颜色 */
  color: string;
  /** 行索引 */
  row: number;
  /** 是否属于主干分支 */
  isMainBranch: boolean;
  /** 所属分支名称列表 */
  branchNames: string[];
  /** 是否为合并提交 */
  isMergeCommit: boolean;
  /** 折叠的提交数量 */
  collapsedCommitCount: number;
  /** 是否被折叠 */
  isCollapsed: boolean;
  /** 折叠父提交 OID */
  collapseParentOid: string | null;
}

// ============= 新增：分支跟踪状态 =============

/**
 * 分支跟踪状态
 * 表示本地分支与上游分支的同步状态
 */
export interface BranchTrackingStatus {
  /** 分支名称（本地分支名，不含 remote 前缀） */
  branch: string;
  /** 上游分支名称（不含 refs/remotes/ 前缀），如 "origin/main" */
  upstream: string | null;
  /** 状态类型 */
  state: 'up-to-date' | 'ahead' | 'behind' | 'ahead-behind' | 'diverged' | 'no-upstream';
  /** 领先远程的提交数 */
  ahead: number;
  /** 落后远程的提交数 */
  behind: number;
}

/**
 * 所有分支的跟踪状态映射
 * key: 本地分支名（不含 origin/ 前缀）
 * value: 跟踪状态
 */
export type BranchTrackingMap = Record<string, BranchTrackingStatus>;



// ============= Stash 相关类型 =============

/**
 * Stash 条目信息
 */
export interface GitStashEntry {
  /** Stash 索引（如 stash@{0}） */
  index: number;
  /** Stash 引用（如 stash@{0}） */
  ref: string;
  /** Stash 消息 */
  message: string;
  /** 创建日期时间戳（秒） */
  date: number;
  /** 创建日期格式化字符串 */
  dateStr: string;
  /** 包含的文件列表 */
  files: StashFileChange[];
  /** 变更统计 */
  stats: {
    additions: number;
    deletions: number;
    filesChanged: number;
  };
}

/**
 * Stash 中的文件变更
 */
export interface StashFileChange {
  /** 文件路径 */
  path: string;
  /** 变更类型：added, modified, deleted */
  type: 'added' | 'modified' | 'deleted';
  /** 新增行数 */
  additions: number;
  /** 删除行数 */
  deletions: number;
}

/**
 * Stash 选项
 */
export interface StashOptions {
  /** Stash 消息 */
  message?: string;
  /** 是否包含未跟踪文件 */
  includeUntracked?: boolean;
  /** 是否保持暂存区状态 */
  keepIndex?: boolean;
}

// ============= Blame 相关类型 =============

/**
 * Blame 行信息
 */
export interface BlameLine {
  /** 行号 */
  lineNumber: number;
  /** 行内容 */
  content: string;
  /** 提交 SHA */
  commit: string;
  /** 短 SHA（7位） */
  shortCommit: string;
  /** 作者 */
  author: string;
  /** 作者邮箱 */
  authorEmail: string;
  /** 提交日期时间戳（秒） */
  date: number;
  /** 完整提交消息 */
  commitMessage: string;
  /** 行在提交中的原始行号 */
  originalLineNumber?: number;
  /** 是否为多人编辑（同一行被多人修改过） */
  isCoAuthored?: boolean;
}

/**
 * Blame 结果
 */
export interface BlameResult {
  /** 文件路径 */
  filePath: string;
  /** Blame 行列表 */
  lines: BlameLine[];
  /** 涉及的作者列表 */
  authors: string[];
  /** 日期范围 */
  dateRange: {
    oldest: number;
    newest: number;
  };
}

/**
 * Blame 过滤选项
 */
export interface BlameFilter {
  /** 按作者过滤 */
  authors?: string[];
  /** 开始日期（时间戳，秒） */
  startDate?: number;
  /** 结束日期（时间戳，秒） */
  endDate?: number;
}

/**
 * 热力图颜色配置
 */
export interface HeatmapColorConfig {
  /** 颜色值（如 rgba(255,0,0,0.3)） */
  color: string;
  /** 渐变起始值 */
  value: number;
}


/** 图片Diff模式 */
export type ImageDiffMode = 'side-by-side' | 'slider' | 'onion-skin';

/** 图片Diff信息 */
export interface ImageDiffInfo {
  /** 旧图片路径（空表示新增） */
  oldPath: string | null;
  /** 新图片路径（空表示删除） */
  newPath: string | null;
  /** 旧图片base64 */
  oldImage?: string;
  /** 新图片base64 */
  newImage?: string;
  /** 图片宽度 */
  width?: number;
  /** 图片高度 */
  height?: number;
  /** 是否为二进制文件 */
  isBinary: boolean;
}

/** 文件历史条目 */
export interface FileHistoryEntry {
  /** 提交SHA */
  oid: string;
  /** 提交消息 */
  message: string;
  /** 作者 */
  author: string;
  /** 日期 */
  date: string;
  /** 文件变更状态(M/A/D/R) */
  status: string;
}

// ============= P2 新增类型定义 =============

/** 交互式 Rebase 操作项 */
export interface RebaseAction {
  /** 提交 SHA */
  oid: string;
  /** 操作类型：pick/squash/fixup/reword/edit/drop */
  action: 'pick' | 'squash' | 'fixup' | 'reword' | 'edit' | 'drop';
  /** 提交消息 */
  message: string;
  /** 作者 */
  author: string;
  /** 短SHA */
  shortOid: string;
  /** 排序索引 */
  order: number;
}

/** Rebase 执行计划 */
export interface RebasePlan {
  /** 目标上游 */
  upstream: string;
  /** 操作列表（按顺序） */
  actions: RebaseAction[];
  /** 是否包含 --update-refs */
  updateRefs?: boolean;
}

/** 子模块信息（增强版） */
export interface SubmoduleInfo {
  /** 子模块名称 */
  name: string;
  /** 子模块路径 */
  path: string;
  /** 子模块 URL */
  url: string;
  /** 当前提交 SHA */
  currentOid?: string;
  /** 跟踪的提交 SHA */
  trackedOid?: string;
  /** 状态：unchanged/modified/out-of-date/initialized/uninitialized */
  status: 'unchanged' | 'modified' | 'out-of-date' | 'initialized' | 'uninitialized';
  /** 分支名 */
  branch?: string;
}

/** Worktree 信息 */
export interface WorktreeInfo {
  /** 工作目录路径 */
  path: string;
  /** 关联的分支或提交 */
  head: string;
  /** 是否为主工作区 */
  isMainWorktree: boolean;
  /** 检出的分支名 */
  branch?: string;
  /** 是否为干净状态 */
  isClean: boolean;
  /** 提交消息 */
  commitMessage?: string;
}

/** Git LFS 锁定信息 */
export interface LfsLock {
  /** 文件路径 */
  path: string;
  /** 锁定者 */
  owner: string;
  /** 锁定时间 */
  lockedAt: number;
  /** 锁定ID */
  id: string;
}

/** Git LFS 追踪模式 */
export interface LfsTrackPattern {
  /** 追踪模式（如 *.psd） */
  pattern: string;
  /** 锁定属性 */
  lockable: boolean;
  /** 文件总大小 */
  size?: number;
  /** 文件数量 */
  fileCount?: number;
}

/** Git LFS 状态 */
export interface LfsStatus {
  /** 是否安装了 LFS */
  isInstalled: boolean;
  /** LFS 版本 */
  version?: string;
  /** 追踪模式列表 */
  trackPatterns: LfsTrackPattern[];
  /** 锁定文件列表 */
  locks: LfsLock[];
  /** LFS 对象统计 */
  stats: {
    totalSize: number;
    totalFiles: number;
    localSize: number;
    localFiles: number;
  };
}

/** Reflog 条目 */
export interface ReflogEntry {
  /** 提交 SHA */
  oid: string;
  /** 短 SHA */
  shortOid: string;
  /** 操作描述 */
  action: string;
  /** 引用名 */
  ref: string;
  /** 消息 */
  message: string;
  /** 时间戳 */
  timestamp: number;
  /** 作者 */
  author: string;
}

/** 仓库统计 */
export interface RepoStats {
  /** 仓库路径 */
  path: string;
  /** 仓库大小（字节） */
  size: number;
  /** 提交数量 */
  commitCount: number;
  /** 分支数量 */
  branchCount: number;
  /** 标签数量 */
  tagCount: number;
  /** 贡献者数量 */
  contributorCount: number;
  /** 首次提交时间 */
  firstCommitDate: number;
  /** 最近提交时间 */
  lastCommitDate: number;
  /** 行数统计 */
  lineStats: {
    total: number;
    added: number;
    deleted: number;
  };
}

/** 自定义操作 */
export interface CustomAction {
  /** 操作ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 执行命令 */
  command: string;
  /** 工作目录（空=仓库根目录） */
  workingDir?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 图标 */
  icon?: string;
  /** 快捷键 */
  shortcut?: string;
  /** 适用的文件模式（如 *.js, *） */
  filePattern?: string;
  /** 是否显示在上下文菜单 */
  showInContextMenu: boolean;
  /** 是否显示在工具栏 */
  showInToolbar: boolean;
  /** P2-9: 自定义命令 checkbox — 执行前可选参数 */
  params?: Array<{ name: string; label: string; type: 'checkbox' | 'input'; defaultValue?: string | boolean; checked?: boolean }>;
}

/** 偏好设置 */
export interface AppPreferences {
  /** 通用 */
  general: {
    /** 默认克隆目录 */
    defaultCloneDir: string;
    /** 语言 */
    language: 'zh-CN' | 'en-US';
    /** 启动时检查更新 */
    checkUpdateOnStart: boolean;
    /** 最小化到托盘 */
    minimizeToTray: boolean;
    /** 自动 Fetch 间隔（分钟，0=禁用） */
    autoFetchInterval: number;
  };
  /** 外观 */
  appearance: {
    /** 主题 */
    theme: 'dark' | 'light' | 'system';
    /** 字体大小 */
    fontSize: number;
    /** Tab 宽度 */
    tabWidth: number;
    /** 显示空白字符 */
    showWhitespace: boolean;
    /** 色盲模式 */
    colorBlindMode: boolean;
    /** 提交图样式 */
    commitGraphStyle: 'curved' | 'straight';
  };
  /** Git */
  git: {
    /** 默认合并策略 */
    mergeStrategy: 'merge' | 'rebase' | 'squash';
    /** Pull 默认 Rebase */
    pullRebase: boolean;
    /** 推送时自动设置上游 */
    pushAutoSetUpstream: boolean;
    /** 提交后自动推送 */
    autoPushAfterCommit: boolean;
    /** GPG 签名 */
    gpgSign: boolean;
    /** 提交模板路径 */
    commitTemplatePath: string;
    /** 外部 Diff 工具 */
    externalDiffTool: string;
    /** 外部合并工具 */
    externalMergeTool: string;
  };
  /** 通知 */
  notifications: {
    /** 操作完成通知 */
    showOnComplete: boolean;
    /** 冲突通知 */
    showOnConflict: boolean;
    /** 通知声音 */
    soundEnabled: boolean;
  };
}

/** 通知项 */
export interface AppNotification {
  /** 通知ID */
  id: string;
  /** 通知类型 */
  type: 'success' | 'error' | 'warning' | 'info';
  /** 标题 */
  title: string;
  /** 消息 */
  message: string;
  /** 时间戳 */
  timestamp: number;
  /** 是否已读 */
  read: boolean;
  /** 关联的操作ID（可选） */
  actionId?: string;
}

/** Bisect 状态 */
export interface BisectState {
  /** 是否正在 Bisect */
  isActive: boolean;
  /** 好的提交 */
  goodRef?: string;
  /** 坏的提交 */
  badRef?: string;
  /** 当前测试提交 */
  currentRef?: string;
  /** 剩余步骤 */
  stepsRemaining?: number;
  /** 已标记的提交列表 */
  markedCommits: Array<{ ref: string; result: 'good' | 'bad' | 'skip' }>;
}

/** Patch 信息 */
export interface PatchInfo {
  /** Patch 文件名 */
  filename: string;
  /** Patch 路径 */
  path: string;
  /** 创建时间 */
  createdAt: number;
  /** 修改的文件数 */
  filesChanged: number;
  /** 新增行数 */
  additions: number;
  /** 删除行数 */
  deletions: number;
  /** 描述 */
  subject?: string;
}
