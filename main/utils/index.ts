/**
 * 主进程工具函数
 */
// @ts-nocheck
export {};

/**
 * 获取应用资源路径
 */
function getResourcePath(relativePath: string): string {
  if (process.env.NODE_ENV === 'development') {
    return relativePath;
  }
  return `${process.resourcesPath}/${relativePath}`;
}

/**
 * 延迟执行
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 安全执行异步函数
 */
async function safeAsync<T>(
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
function isMain(): boolean {
  return typeof process !== 'undefined' && !!process.send;
}

module.exports = { getResourcePath, delay, safeAsync, isMain };
