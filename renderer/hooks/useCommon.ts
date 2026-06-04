/**
 * 通用 hooks
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * useDebounce - 防抖 hook
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useLocalStorage - 本地存储 hook
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('读取 localStorage 失败:', error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('写入 localStorage 失败:', error);
    }
  }, [key]);

  return [storedValue, setValue];
}

/**
 * useKeyPress - 键盘快捷键 hook
 */
export function useKeyPress(
  targetKey: string,
  callback: () => void,
  modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}
) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const { ctrlKey, shiftKey, altKey } = event;

      // 检查修饰键
      if (modifiers.ctrl && !ctrlKey) return;
      if (modifiers.shift && !shiftKey) return;
      if (modifiers.alt && !altKey) return;

      // 检查目标键
      if (event.key === targetKey) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [targetKey, callback, modifiers.ctrl, modifiers.shift, modifiers.alt]);
}
