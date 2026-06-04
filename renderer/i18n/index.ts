/**
 * i18n 国际化 hook
 */

import { useCallback } from 'react';
import { zhCN, type I18nKeys } from './zh-CN';
import { enUS } from './en-US';

// 当前语言
let currentLocale = 'zh-CN';

const messages: Record<string, I18nKeys> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

/**
 * 获取当前语言
 */
export function getLocale(): string {
  return currentLocale;
}

/**
 * 设置当前语言
 */
export function setLocale(locale: string) {
  if (messages[locale]) {
    currentLocale = locale;
  }
}

/**
 * 获取翻译文本
 */
export function t(key: string): string {
  const keys = key.split('.');
  let value: unknown = messages[currentLocale];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }
  
  return typeof value === 'string' ? value : key;
}

/**
 * 获取翻译文本（带默认值）
 */
export function tWithDefault(key: string, defaultValue: string): string {
  const result = t(key);
  return result === key ? defaultValue : result;
}

/**
 * React Hook: 使用国际化
 */
export function useI18() {
  const translate = useCallback((key: string): string => {
    return t(key);
  }, []);

  const translateWithDefault = useCallback((key: string, defaultValue: string): string => {
    return tWithDefault(key, defaultValue);
  }, []);

  return {
    t: translate,
    tWithDefault,
    locale: currentLocale,
    messages: messages[currentLocale],
  };
}

/**
 * 格式化日期
 */
export function formatDate(timestamp: number, locale?: string): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(locale || currentLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}
