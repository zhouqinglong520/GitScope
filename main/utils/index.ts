/**
 * 主进程工具函数
 */

/**
 * 获取应用资源路径
 */
export function getResourcePath(relativePath: string): string {
  if (process.env.NODE_ENV === 'development') {
    return relativePath;
  }
  return `${process.resourcesPath}/${relativePath}`;
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 安全执行异步函数
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('异步操作失败:', error);
    return fallback;
  }
}

/**
 * 检查是否为主进程
 */
export function isMain(): boolean {
  return typeof process !== 'undefined' && !!process.send;
}
