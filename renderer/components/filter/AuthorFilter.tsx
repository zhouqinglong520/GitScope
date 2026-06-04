/**
 * 作者筛选器组件
 * 在提交图工具栏添加作者筛选器
 * 支持搜索、多选，选中的作者高亮，未选中的提交灰显
 */

import React, { useState, useRef, useEffect } from 'react';
import type { AuthorStats } from '@shared/types/git';
import { useI18 } from '../../i18n';

interface AuthorFilterProps {
  /** 作者统计列表 */
  authors: AuthorStats[];
  /** 当前选中的作者 */
  selectedAuthors: string[];
  /** 选择作者回调 */
  onAuthorsChange: (authors: string[]) => void;
}

function AuthorFilter({ authors, selectedAuthors, onAuthorsChange }: AuthorFilterProps) {
  const { t } = useI18();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // 自动聚焦搜索框
      setTimeout(() => inputRef.current?.focus(), 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 过滤作者
  const filteredAuthors = authors.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
  );

  // 切换作者选择
  const toggleAuthor = (email: string) => {
    if (selectedAuthors.includes(email)) {
      onAuthorsChange(selectedAuthors.filter((e) => e !== email));
    } else {
      onAuthorsChange([...selectedAuthors, email]);
    }
  };

  // 全选
  const selectAll = () => {
    onAuthorsChange([]);
  };

  // 全不选
  const selectNone = () => {
    onAuthorsChange([]);
  };

  // 切换全部选择
  const toggleAll = () => {
    if (selectedAuthors.length === 0) {
      // 全部选中
      selectAll();
    } else {
      // 全部取消
      selectNone();
    }
  };

  const isAllSelected = selectedAuthors.length === 0;
  const selectedCount = selectedAuthors.length > 0 ? selectedAuthors.length : authors.length;

  return (
    <div ref={containerRef} className="relative">
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors
          ${selectedAuthors.length > 0 
            ? 'bg-[#094771] text-white' 
            : 'bg-[#3c3c3c] text-gray-300 hover:bg-[#4c4c4c]'
          }
        `}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span>{t('authorFilter.title')}</span>
        {selectedAuthors.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[10px]">
            {selectedAuthors.length}
          </span>
        )}
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-[#2d2d30] border border-[#3c3c3c] rounded-lg shadow-xl z-50">
          {/* 搜索框 */}
          <div className="p-2 border-b border-[#3c3c3c]">
            <div className="relative">
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('authorFilter.search')}
                className="w-full pl-8 pr-3 py-1.5 bg-[#3c3c3c] border border-[#4c4c4c] rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#094771]"
              />
            </div>
          </div>

          {/* 全选/取消全选 */}
          <div className="px-2 py-1.5 border-b border-[#3c3c3c] flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {selectedCount} / {authors.length} {t('authorFilter.selected')}
            </span>
            <button
              onClick={toggleAll}
              className="text-xs text-[#5799da] hover:text-[#7bb3eb] transition-colors"
            >
              {isAllSelected ? t('authorFilter.selectNone') : t('authorFilter.selectAll')}
            </button>
          </div>

          {/* 作者列表 */}
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredAuthors.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-500">
                {t('authorFilter.noResults')}
              </div>
            ) : (
              filteredAuthors.map((author) => {
                const isSelected = selectedAuthors.includes(author.email) || isAllSelected;
                return (
                  <div
                    key={author.email}
                    onClick={() => toggleAuthor(author.email)}
                    className={`
                      flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors
                      ${isSelected ? 'bg-transparent' : 'bg-[#3c3c3c]/50'}
                      hover:bg-[#094771]/50
                    `}
                  >
                    {/* 复选框 */}
                    <div
                      className={`
                        w-4 h-4 rounded flex items-center justify-center flex-shrink-0
                        ${isSelected ? 'bg-[#5799da]' : 'border border-[#5c5c5c]'}
                      `}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    {/* 头像 */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                      style={{ backgroundColor: getAvatarColor(author.email) }}
                    >
                      {author.name.charAt(0).toUpperCase()}
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-200 truncate">
                        {author.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {author.email}
                      </div>
                    </div>

                    {/* 提交数量 */}
                    <div className="text-xs text-gray-500 flex-shrink-0">
                      {author.commitCount}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 底部操作 */}
          <div className="px-2 py-2 border-t border-[#3c3c3c] flex justify-end gap-2">
            <button
              onClick={() => {
                onAuthorsChange([]);
                setIsOpen(false);
              }}
              className="px-3 py-1 text-xs text-gray-300 hover:text-white hover:bg-[#3c3c3c] rounded transition-colors"
            >
              {t('common.reset')}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 text-xs bg-[#5799da] text-white hover:bg-[#4a8ac7] rounded transition-colors"
            >
              {t('common.ok')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 获取头像背景色
 */
function getAvatarColor(email: string): string {
  const colors = [
    '#5799da', '#7dce82', '#e2a855', '#b47ccf',
    '#52c4e8', '#e85d75', '#72d6c9', '#f0c674',
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default AuthorFilter;
