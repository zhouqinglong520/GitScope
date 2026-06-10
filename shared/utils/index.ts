/**
 * 共享工具函数
 * 主进程和渲染进程都可以使用
 * 参考 SourceGit 的 i18n-aware 格式化策略
 */

/** 语言类型 */
export type Locale = 'zh-CN' | 'en-US';

/** 当前语言（默认中文） */
let _locale: Locale = 'zh-CN';

/** 设置语言 */
export function setLocale(locale: Locale): void {
  _locale = locale;
}

/** 获取当前语言 */
export function getLocale(): Locale {
  return _locale;
}

// ========== i18n 文本映射 ==========
const RELATIVE_TIME_ZH = {
  justNow: '刚刚',
  minutesAgo: (n: number) => `${n} 分钟前`,
  hoursAgo: (n: number) => `${n} 小时前`,
  daysAgo: (n: number) => `${n} 天前`,
  weeksAgo: (n: number) => `${n} 周前`,
  monthsAgo: (n: number) => `${n} 个月前`,
  yearsAgo: (n: number) => `${n} 年前`,
};

const RELATIVE_TIME_EN = {
  justNow: 'just now',
  minutesAgo: (n: number) => `${n} min${n > 1 ? 's' : ''} ago`,
  hoursAgo: (n: number) => `${n} hr${n > 1 ? 's' : ''} ago`,
  daysAgo: (n: number) => `${n} day${n > 1 ? 's' : ''} ago`,
  weeksAgo: (n: number) => `${n} week${n > 1 ? 's' : ''} ago`,
  monthsAgo: (n: number) => `${n} month${n > 1 ? 's' : ''} ago`,
  yearsAgo: (n: number) => `${n} year${n > 1 ? 's' : ''} ago`,
};

function getRelativeTimeTexts() {
  return _locale === 'en-US' ? RELATIVE_TIME_EN : RELATIVE_TIME_ZH;
}

/**
 * 格式化时间戳为可读日期
 * @param timestamp Unix 时间戳（秒）
 * @returns 格式化的日期字符串
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(_locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化相对时间（i18n-aware）
 * @param timestamp Unix 时间戳（秒）
 * @returns 相对时间字符串
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  const t = getRelativeTimeTexts();

  if (diff < 60) return t.justNow;
  if (diff < 3600) return t.minutesAgo(Math.floor(diff / 60));
  if (diff < 86400) return t.hoursAgo(Math.floor(diff / 3600));
  if (diff < 604800) return t.daysAgo(Math.floor(diff / 86400));
  if (diff < 2592000) return t.weeksAgo(Math.floor(diff / 604800));
  if (diff < 31536000) return t.monthsAgo(Math.floor(diff / 2592000));
  return t.yearsAgo(Math.floor(diff / 31536000));
}

/**
 * 截断字符串
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * SHA 缩短显示
 */
export function shortOid(oid: string, length = 7): string {
  return oid.slice(0, length);
}

/**
 * 检查是否为 Git 仓库
 */
export function isGitRepository(path: string): boolean {
  return path.includes('.git') || path.endsWith('/.git');
}

/**
 * 从 URL 提取主机名
 */
export function extractHost(url: string): string {
  try {
    // 支持 SSH URL 格式：git@github.com:user/repo.git
    const sshMatch = url.match(/git@([^:]+):/);
    if (sshMatch) return sshMatch[1];
    const match = url.match(/https?:\/\/([^/]+)/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

/**
 * 深拷贝对象
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 格式化文件大小（i18n-aware）
 * @param bytes 字节数
 * @returns 格式化后的字符串，如 "1.5 KB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * 格式化变更统计（diff stats）
 * @param additions 新增行数
 * @param deletions 删除行数
 * @returns 格式化字符串，如 "+10 -5"
 */
export function formatDiffStats(additions: number, deletions: number): string {
  const parts: string[] = [];
  if (additions > 0) parts.push(`+${additions}`);
  if (deletions > 0) parts.push(`-${deletions}`);
  return parts.length > 0 ? parts.join(' ') : '0';
}

/**
 * 格式化数字（带千位分隔符）
 */
export function formatNumber(n: number): string {
  return n.toLocaleString(_locale);
}

/**
 * 从 ref 名称中提取分支名（去掉 remote 前缀和 tag: 前缀）
 */
export function extractBranchName(ref: string): string {
  // "tag: v1.0" → "v1.0"
  if (ref.startsWith('tag: ')) return ref.substring(5);
  // "origin/main" → "main"
  const slashIdx = ref.indexOf('/');
  if (slashIdx >= 0 && !ref.startsWith('/')) return ref.substring(slashIdx + 1);
  return ref;
}

/**
 * 判断 ref 名称是否为标签
 */
export function isTagRef(ref: string): boolean {
  return ref.startsWith('tag: ');
}

/**
 * 判断 ref 名称是否为远程分支
 */
export function isRemoteRef(ref: string): boolean {
  return ref.startsWith('origin/') || ref.includes('/');
}
