/**
 * 仓库列表组件
 * 显示最近打开的仓库列表
 */

import React from 'react';
import type { RepositoryInfo } from '@shared/types/git';
import { zhCN } from '../../i18n/zh-CN';

interface RepoListProps {
  /** 最近打开的仓库路径列表 */
  recentRepos: string[];
  /** 当前打开的仓库 */
  currentRepo: RepositoryInfo | null;
  /** 选择仓库回调 */
  onSelectRepo: (path: string) => void;
  /** 添加仓库回调 */
  onAddRepo: () => void;
}

function RepoList({ recentRepos, currentRepo, onSelectRepo, onAddRepo }: RepoListProps) {
  const i18n = zhCN;

  // 获取仓库名称
  const getRepoName = (path: string) => {
    return path.split(/[/\\]/).pop() || path;
  };

  return (
    <div className="py-1">
      {/* 当前仓库（如果存在） */}
      {currentRepo && (
        <div className="px-3 py-2 bg-primary-600/20 border-l-2 border-primary-500">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {currentRepo.name}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {currentRepo.path}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 最近仓库列表 */}
      {recentRepos.length > 0 ? (
        <div className="mt-2">
          <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
            {i18n.sidebar.recent}
          </div>
          {recentRepos.map((path) => {
            const isActive = currentRepo?.path === path;
            return (
              <div
                key={path}
                onClick={() => onSelectRepo(path)}
                className={`list-item flex items-center gap-2 ${
                  isActive ? 'list-item-active' : ''
                }`}
              >
                <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{getRepoName(path)}</div>
                  <div className="text-xs text-gray-500 truncate">{path}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 text-center text-gray-500">
          <p className="text-sm mb-3">{i18n.sidebar.noRepos}</p>
          <button onClick={onAddRepo} className="btn btn-secondary text-xs">
            {i18n.sidebar.addRepo}
          </button>
        </div>
      )}
    </div>
  );
}

export default RepoList;
