/**
 * 分支选择器组件
 */

import React, { useState } from 'react';
import type { GitBranch } from '@shared/types/git';
import { zhCN } from '../../i18n/zh-CN';

interface BranchSelectorProps {
  /** 分支列表 */
  branches: GitBranch[];
  /** 当前分支 */
  currentBranch: GitBranch | null;
  /** 选择分支回调 */
  onSelect: (branchName: string) => void;
}

function BranchSelector({ branches, currentBranch, onSelect }: BranchSelectorProps) {
  const i18n = zhCN;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const localBranches = filteredBranches.filter((b) => !b.remote);
  const remoteBranches = filteredBranches.filter((b) => b.remote);

  return (
    <div className="relative">
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#3c3c3c] rounded hover:bg-[#4f4f4f] transition-colors"
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="text-sm">{currentBranch?.name || '无分支'}</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* 菜单内容 */}
          <div className="absolute top-full left-0 mt-1 w-64 bg-panel-bg border border-panel-border rounded shadow-lg z-20">
            {/* 搜索框 */}
            <div className="p-2 border-b border-panel-border">
              <input
                type="text"
                placeholder={i18n.common.search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input w-full text-sm"
                autoFocus
              />
            </div>

            {/* 分支列表 */}
            <div className="max-h-64 overflow-auto py-1">
              {/* 新建分支 */}
              <button
                onClick={() => {
                  const name = prompt(i18n.branch.newBranch);
                  if (name) {
                    onSelect(name);
                    setIsOpen(false);
                  }
                }}
                className="w-full px-3 py-2 text-left text-sm text-primary-400 hover:bg-sidebar-hover flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {i18n.branch.newBranch}
              </button>

              {/* 本地分支 */}
              {localBranches.length > 0 && (
                <div className="border-t border-panel-border mt-1 pt-1">
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
                    {i18n.branch.local}
                  </div>
                  {localBranches.map((branch) => (
                    <button
                      key={branch.name}
                      onClick={() => {
                        onSelect(branch.name);
                        setIsOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-sidebar-hover flex items-center gap-2 ${
                        branch.current ? 'text-primary-400' : ''
                      }`}
                    >
                      {branch.current && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      <span className="truncate">{branch.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 远程分支 */}
              {remoteBranches.length > 0 && (
                <div className="border-t border-panel-border mt-1 pt-1">
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
                    {i18n.branch.remote}
                  </div>
                  {remoteBranches.map((branch) => (
                    <button
                      key={branch.name}
                      onClick={() => {
                        onSelect(branch.name);
                        setIsOpen(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm text-gray-400 hover:bg-sidebar-hover flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <span className="truncate">{branch.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default BranchSelector;
