/**
 * 提交列表组件
 * 显示提交历史记录
 */

import React from 'react';
import type { GitCommit } from '@shared/types/git';
import { zhCN } from '../../i18n/zh-CN';
import { formatRelativeTime, shortOid } from '@shared/utils';

interface CommitListProps {
  /** 提交列表 */
  commits: GitCommit[];
  /** 选择提交回调 */
  onCommitSelect: (oid: string | null) => void;
  /** 当前选中的提交 */
  selectedCommit: string | null;
}

function CommitList({ commits, onCommitSelect, selectedCommit }: CommitListProps) {
  const i18n = zhCN;

  if (commits.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p className="text-sm">{i18n.commitGraph.noCommits}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-panel-border">
      {commits.map((commit) => (
        <div
          key={commit.oid}
          onClick={() => onCommitSelect(commit.oid)}
          className={`p-3 cursor-pointer transition-colors ${
            selectedCommit === commit.oid
              ? 'bg-primary-600/20 border-l-2 border-primary-500'
              : 'hover:bg-sidebar-hover border-l-2 border-transparent'
          }`}
        >
          {/* 提交消息 */}
          <div className="text-sm font-medium truncate mb-1">
            {commit.message}
          </div>

          {/* 提交信息行 */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {/* SHA */}
            <span className="font-mono text-primary-400">
              {shortOid(commit.oid)}
            </span>

            {/* 分隔符 */}
            <span>·</span>

            {/* 时间 */}
            <span>{formatRelativeTime(commit.authorTimestamp)}</span>

            {/* 分隔符 */}
            <span>·</span>

            {/* 作者 */}
            <span className="truncate">{commit.authorName}</span>
          </div>

          {/* 父提交 */}
          {commit.parentIds.length > 0 && (
            <div className="mt-1 text-xs text-gray-500">
              {commit.parentIds.length === 1 ? 'parent' : 'parents'}:{' '}
              {commit.parentIds.map((pid) => shortOid(pid)).join(', ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default CommitList;
