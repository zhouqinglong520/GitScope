/**
 * 共享工具函数
 * 主进程和渲染进程都可以使用
 */

/**
 * 格式化时间戳为可读日期
 * @param timestamp Unix 时间戳（秒）
 * @returns 格式化的日期字符串
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化相对时间
 * @param timestamp Unix 时间戳（秒）
 * @returns 相对时间字符串（如"2小时前"）
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} 周前`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} 个月前`;
  return `${Math.floor(diff / 31536000)} 年前`;
}

/**
 * 截断字符串
 * @param str 原字符串
 * @param maxLength 最大长度
 * @returns 截断后的字符串
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * SHA 缩短显示
 * @param oid 完整的 SHA 哈希
 * @param length 截取长度（默认 7）
 * @returns 缩短的 SHA
 */
export function shortOid(oid: string, length = 7): string {
  return oid.slice(0, length);
}

/**
 * 检查是否为 Git 仓库
 * @param path 目录路径
 * @returns 是否为 Git 仓库
 */
export function isGitRepository(path: string): boolean {
  return path.includes('.git') || path.endsWith('/.git');
}

/**
 * 从 URL 提取主机名
 * @param url Git 仓库 URL
 * @returns 主机名
 */
export function extractHost(url: string): string {
  try {
    const match = url.match(/https?:\/\/([^/]+)/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

/**
 * 深拷贝对象
 * @param obj 原对象
 * @returns 深拷贝后的对象
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
