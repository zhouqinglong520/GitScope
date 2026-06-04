/**
 * 文件提交历史组件
 * 显示指定文件的提交历史，以弹窗形式展示
 */

import React, { useEffect, useState } from 'react';
import type { GitCommit } from '@shared/types/git';
import { useI18, formatRelativeTime } from '../../i18n';

interface FileHistoryProps {
  /** 文件路径 */
  filePath: string;
  /** 提交列表 */
  commits: GitCommit[];
  /** 每个提交的变更统计 */
  stats: Record<string, { additions: number; deletions: number }>;
  /** 关闭回调 */
  onClose: () => void;
  /** 查看某提交的该文件 diff */
  onViewDiff?: (oid: string, filePath: string) => void;
  /** 在 Gitee 中查看 */
  giteeUrl?: string;
}

interface FileHistoryItem {
  commit: GitCommit;
  additions: number;
  deletions: number;
}

function FileHistory({
  filePath,
  commits,
  stats,
  onClose,
  onViewDiff,
  giteeUrl,
}: FileHistoryProps) {
  const { t } = useI18();
  const [selectedOid, setSelectedOid] = useState<string | null>(null);
  const [items, setItems] = useState<FileHistoryItem[]>([]);

  // 处理提交列表
  useEffect(() => {
    const historyItems: FileHistoryItem[] = commits.map((commit) => ({
      commit,
      additions: stats[commit.oid]?.additions || 0,
      deletions: stats[commit.oid]?.deletions || 0,
    }));
    setItems(historyItems);
  }, [commits, stats]);

  // 获取文件状态图标
  const getStatusIcon = (additions: number, deletions: number): React.ReactNode => {
    if (additions > 0 && deletions === 0) {
      // 新文件
      return (
        <span className="text-[#e2a855] font-bold" title="Added">
          A
        </span>
      );
    } else if (additions === 0 && deletions > 0) {
      // 删除
      return (
        <span className="text-[#e85d75] font-bold" title="Deleted">
          D
        </span>
      );
    } else if (additions > 0 && deletions > 0) {
      // 修改
      return (
        <span className="text-[#6cc644] font-bold" title="Modified">
          M
        </span>
      );
    }
    return null;
  };

  // 打开 Gitee
  const openGitee = () => {
    if (giteeUrl) {
      window.open(giteeUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-2xl w-[800px] max-h-[600px] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c]">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-gray-200">{t('fileHistory.title')}</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#3c3c3c] transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 文件路径 */}
        <div className="px-4 py-2 bg-[#2d2d30] border-b border-[#3c3c3c]">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm text-gray-300 font-mono">{filePath}</span>
          </div>
        </div>

        {/* 提交列表 */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-500">
              <p className="text-sm">{t('commitGraph.noCommits')}</p>
            </div>
          ) : (
            <div className="divide-y divide-[#2a2a2a]">
              {items.map((item) => {
                const isSelected = selectedOid === item.commit.oid;
                return (
                  <div
                    key={item.commit.oid}
                    onClick={() => setSelectedOid(isSelected ? null : item.commit.oid)}
                    onDoubleClick={() => onViewDiff?.(item.commit.oid, filePath)}
                    className={`
                      px-4 py-3 cursor-pointer transition-colors
                      ${isSelected ? 'bg-[#094771]' : 'hover:bg-[#2a2d2e]'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      {/* 状态图标 */}
                      <span className="w-5 text-center">
                        {getStatusIcon(item.additions, item.deletions)}
                      </span>

                      {/* SHA */}
                      <span className="font-mono text-xs text-[#5799da] flex-shrink-0">
                        {item.commit.shortOid}
                      </span>

                      {/* 提交消息 */}
                      <span className="flex-1 text-sm text-gray-200 truncate">
                        {item.commit.message}
                      </span>

                      {/* 变更统计 */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-[#6cc644]">
                          +{item.additions}
                        </span>
                        <span className="text-xs text-[#e85d75]">
                          -{item.deletions}
                        </span>
                      </div>

                      {/* 作者 */}
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                        style={{ backgroundColor: getAvatarColor(item.commit.authorEmail) }}
                      >
                        {item.commit.authorName.charAt(0).toUpperCase()}
                      </div>

                      {/* 时间 */}
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {formatRelativeTime(item.commit.authorTimestamp)}
                      </span>

                      {/* 查看 diff 按钮 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDiff?.(item.commit.oid, filePath);
                        }}
                        className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#3c3c3c] rounded transition-colors flex-shrink-0"
                        title={t('fileHistory.viewDiff')}
                      >
                        {t('fileHistory.diff')}
                      </button>
                    </div>

                    {/* 展开的详情 */}
                    {isSelected && (
                      <div className="mt-3 pl-8 text-xs text-gray-400">
                        <div className="mb-2">
                          <span className="text-gray-500">{t('commitGraph.author')}: </span>
                          <span>{item.commit.authorName} &lt;{item.commit.authorEmail}&gt;</span>
                        </div>
                        <div className="text-gray-500">
                          {t('commitGraph.date')}: {new Date(item.commit.authorTimestamp * 1000).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="px-4 py-3 border-t border-[#3c3c3c] flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {items.length} {t('fileHistory.commits')}
          </div>
          <div className="flex items-center gap-2">
            {giteeUrl && (
              <button
                onClick={openGitee}
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-[#3c3c3c] rounded transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {t('fileHistory.viewOnGitee')}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-[#3c3c3c] rounded transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
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

export default FileHistory;
