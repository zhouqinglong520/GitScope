/**
 * 提交筛选工具栏组件
 * 在提交图上方添加筛选工具栏
 * 包含：搜索框、作者筛选、日期范围筛选、分支筛选、清除按钮
 */

import React, { useState, useRef, useEffect } from 'react';
import type { AuthorStats, GitBranch, CommitFilter } from '@shared/types/git';
import { useI18 } from '../../i18n';
import AuthorFilter from './AuthorFilter';

interface CommitFilterBarProps {
  /** 作者统计列表 */
  authors: AuthorStats[];
  /** 分支列表 */
  branches: GitBranch[];
  /** 当前筛选条件 */
  filter: CommitFilter;
  /** 更新筛选条件回调 */
  onFilterChange: (filter: Partial<CommitFilter>) => void;
  /** 清除筛选回调 */
  onClearFilter: () => void;
}

function CommitFilterBar({
  authors,
  branches,
  filter,
  onFilterChange,
  onClearFilter,
}: CommitFilterBarProps) {
  const { t } = useI18();
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [showDateMenu, setShowDateMenu] = useState(false);
  const branchMenuRef = useRef<HTMLDivElement>(null);
  const dateMenuRef = useRef<HTMLDivElement>(null);

  // 日期快捷选项
  const dateOptions = [
    { label: t('filter.today'), days: 1 },
    { label: t('filter.lastWeek'), days: 7 },
    { label: t('filter.lastMonth'), days: 30 },
    { label: t('filter.last3Months'), days: 90 },
    { label: t('filter.lastYear'), days: 365 },
    { label: t('filter.allTime'), days: 0 },
  ];

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (branchMenuRef.current && !branchMenuRef.current.contains(e.target as Node)) {
        setShowBranchMenu(false);
      }
      if (dateMenuRef.current && !dateMenuRef.current.contains(e.target as Node)) {
        setShowDateMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 设置日期范围
  const setDateRange = (days: number) => {
    if (days === 0) {
      onFilterChange({ startDate: undefined, endDate: undefined });
    } else {
      const endDate = Date.now();
      const startDate = endDate - days * 24 * 60 * 60 * 1000;
      onFilterChange({
        startDate: Math.floor(startDate / 1000),
        endDate: Math.floor(endDate / 1000),
      });
    }
    setShowDateMenu(false);
  };

  // 检查是否有筛选条件
  const hasFilter = 
    filter.search || 
    (filter.authors && filter.authors.length > 0) ||
    filter.startDate ||
    filter.endDate ||
    filter.branch;

  // 获取当前日期筛选文本
  const getDateFilterText = (): string => {
    if (!filter.startDate && !filter.endDate) {
      return t('filter.dateRange');
    }
    const start = filter.startDate ? new Date(filter.startDate * 1000) : null;
    const end = filter.endDate ? new Date(filter.endDate * 1000) : null;
    
    if (start && end) {
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    } else if (start) {
      return `${t('filter.since')} ${start.toLocaleDateString()}`;
    }
    return t('filter.until') + ' ' + (end?.toLocaleDateString() || '');
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#252526] border-b border-[#3c3c3c]">
      {/* 搜索框 */}
      <div className="relative flex-1 max-w-[300px]">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={filter.search || ''}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          placeholder={t('filter.searchPlaceholder')}
          className="w-full pl-8 pr-3 py-1.5 bg-[#3c3c3c] border border-[#4c4c4c] rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#094771]"
        />
        {filter.search && (
          <button
            onClick={() => onFilterChange({ search: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 hover:text-gray-300"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 作者筛选 */}
      <AuthorFilter
        authors={authors}
        selectedAuthors={filter.authors || []}
        onAuthorsChange={(authors) => onFilterChange({ authors })}
      />

      {/* 日期范围筛选 */}
      <div ref={dateMenuRef} className="relative">
        <button
          onClick={() => setShowDateMenu(!showDateMenu)}
          className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors
            ${filter.startDate || filter.endDate
              ? 'bg-[#094771] text-white'
              : 'bg-[#3c3c3c] text-gray-300 hover:bg-[#4c4c4c]'
            }
          `}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="max-w-[120px] truncate">{getDateFilterText()}</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 日期下拉菜单 */}
        {showDateMenu && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-[#2d2d30] border border-[#3c3c3c] rounded-lg shadow-xl z-50 py-1">
            {dateOptions.map((option) => (
              <button
                key={option.days}
                onClick={() => setDateRange(option.days)}
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-[#094771] transition-colors"
              >
                {option.label}
              </button>
            ))}
            
            {/* 自定义日期范围 */}
            <div className="border-t border-[#3c3c3c] mt-1 pt-1">
              <div className="px-3 py-2">
                <label className="text-xs text-gray-500 block mb-1">{t('filter.customRange')}</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      if (date) {
                        onFilterChange({ startDate: Math.floor(date.getTime() / 1000) });
                      }
                    }}
                    className="flex-1 px-2 py-1 bg-[#3c3c3c] border border-[#4c4c4c] rounded text-xs text-gray-200"
                  />
                  <input
                    type="date"
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      if (date) {
                        onFilterChange({ endDate: Math.floor(date.getTime() / 1000) + 86400 });
                      }
                    }}
                    className="flex-1 px-2 py-1 bg-[#3c3c3c] border border-[#4c4c4c] rounded text-xs text-gray-200"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 分支筛选 */}
      <div ref={branchMenuRef} className="relative">
        <button
          onClick={() => setShowBranchMenu(!showBranchMenu)}
          className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors
            ${filter.branch
              ? 'bg-[#094771] text-white'
              : 'bg-[#3c3c3c] text-gray-300 hover:bg-[#4c4c4c]'
            }
          `}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="max-w-[100px] truncate">
            {filter.branch || t('filter.branch')}
          </span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 分支下拉菜单 */}
        {showBranchMenu && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-[#2d2d30] border border-[#3c3c3c] rounded-lg shadow-xl z-50 py-1 max-h-64 overflow-y-auto">
            <button
              onClick={() => {
                onFilterChange({ branch: undefined });
                setShowBranchMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-[#094771] transition-colors"
            >
              {t('filter.allBranches')}
            </button>
            <div className="border-t border-[#3c3c3c] my-1" />
            {branches.filter((b) => !b.remote).map((branch) => (
              <button
                key={branch.name}
                onClick={() => {
                  onFilterChange({ branch: branch.name });
                  setShowBranchMenu(false);
                }}
                className={`
                  w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2
                  ${filter.branch === branch.name
                    ? 'bg-[#094771] text-white'
                    : 'text-gray-300 hover:bg-[#3c3c3c]'
                  }
                `}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {branch.name}
                {branch.current && (
                  <span className="ml-auto text-[10px] text-gray-400">({t('filter.current')})</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 清除筛选 */}
      {hasFilter && (
        <button
          onClick={onClearFilter}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#3c3c3c] transition-colors"
          title={t('filter.clear')}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>{t('filter.clear')}</span>
        </button>
      )}

      {/* 右侧统计 */}
      <div className="ml-auto text-xs text-gray-500">
        {t('filter.showing')} <span className="text-gray-300">-</span> / <span className="text-gray-300">-</span>
      </div>
    </div>
  );
}

export default CommitFilterBar;
