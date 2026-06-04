/**
 * 提交详情面板组件
 * 选中提交后展示详情区域
 * 包含：完整提交消息、作者信息、文件列表等
 */

import React from 'react';
import type { CommitDetail as CommitDetailType } from '@shared/types/git';
import { useI18, formatDate } from '../../i18n';

interface CommitDetailPanelProps {
  /** 提交详情 */
  detail: CommitDetailType | null;
  /** 是否展开 */
  isExpanded: boolean;
  /** 切换展开状态 */
  onToggle: () => void;
  /** 查看文件 diff */
  onViewFileDiff?: (oid: string, filePath: string) => void;
  /** 查看文件历史 */
  onViewFileHistory?: (filePath: string) => void;
}

// 文件状态图标颜色
const STATUS_COLORS = {
  added: '#e2a855',      // 黄色 - 新增
  modified: '#6cc644',    // 绿色 - 修改
  deleted: '#e85d75',     // 红色 - 删除
  renamed: '#5799da',     // 蓝色 - 重命名
  copied: '#5799da',     // 蓝色 - 复制
  unchanged: '#888888',  // 灰色 - 未变更
};

const STATUS_LABELS = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  unchanged: '-',
};

function CommitDetailPanel({
  detail,
  isExpanded,
  onToggle,
  onViewFileDiff,
  onViewFileHistory,
}: CommitDetailPanelProps) {
  const { t } = useI18();

  if (!detail) {
    return null;
  }

  const { commit, files } = detail;

  // 统计变更
  const stats = {
    additions: files.reduce((sum, f) => sum + f.additions, 0),
    deletions: files.reduce((sum, f) => sum + f.deletions, 0),
  };

  return (
    <div className={`
      bg-[#252526] border-t border-[#3c3c3c] transition-all duration-300
      ${isExpanded ? 'max-h-[400px]' : 'max-h-[40px]'}
    `}>
      {/* 折叠头部 */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-[#2a2d2e] transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-medium text-gray-200">
            {t('commitDetail.title')}
          </span>
          <span className="text-xs text-gray-500 font-mono">
            {commit.shortOid}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#6cc644]">+{stats.additions}</span>
            <span className="text-[#e85d75]">-{stats.deletions}</span>
          </div>
          <span className="text-xs text-gray-500">
            {files.length} {t('commitDetail.filesChanged')}
          </span>
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="px-4 pb-4 max-h-[350px] overflow-y-auto">
          <div className="grid grid-cols-3 gap-4">
            {/* 左侧：提交信息 */}
            <div className="col-span-2">
              {/* 完整提交消息 */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 mb-2">{t('commitDetail.message')}</h4>
                <div className="bg-[#1e1e1e] rounded p-3">
                  <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono">
                    {commit.fullMessage}
                  </pre>
                </div>
              </div>

              {/* 文件列表 */}
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-2">
                  {t('commitDetail.fileChanges')} ({files.length})
                </h4>
                <div className="bg-[#1e1e1e] rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-[#3c3c3c]">
                        <th className="text-left px-3 py-2 w-8">{t('commitDetail.status')}</th>
                        <th className="text-left px-3 py-2">{t('commitDetail.path')}</th>
                        <th className="text-right px-3 py-2 w-20">{t('commitDetail.stats')}</th>
                        <th className="px-3 py-2 w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((file, index) => (
                        <tr
                          key={`${file.path}-${index}`}
                          className="border-b border-[#2a2a2a] last:border-b-0 hover:bg-[#2a2d2e] transition-colors"
                        >
                          <td className="px-3 py-2">
                            <span
                              className="font-bold text-sm"
                              style={{ color: STATUS_COLORS[file.status] }}
                            >
                              {STATUS_LABELS[file.status]}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-gray-300 font-mono text-xs truncate block max-w-[400px]">
                              {file.oldPath && (
                                <span className="text-gray-500 line-through mr-2">
                                  {file.oldPath}
                                </span>
                              )}
                              {file.path}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2 text-xs">
                              <span className="text-[#6cc644]">+{file.additions}</span>
                              <span className="text-[#e85d75]">-{file.deletions}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => onViewFileDiff?.(commit.oid, file.path)}
                                className="p-1 text-gray-500 hover:text-gray-300 hover:bg-[#3c3c3c] rounded transition-colors"
                                title={t('commitDetail.viewDiff')}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => onViewFileHistory?.(file.path)}
                                className="p-1 text-gray-500 hover:text-gray-300 hover:bg-[#3c3c3c] rounded transition-colors"
                                title={t('commitDetail.viewHistory')}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 右侧：作者信息 */}
            <div className="col-span-1">
              {/* SHA */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 mb-1">{t('commitDetail.sha')}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#5799da] font-mono break-all">
                    {commit.oid}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(commit.oid)}
                    className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                    title={t('commitDetail.copySHA')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 父提交 */}
              {commit.parentIds.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 mb-1">{t('commitDetail.parents')}</h4>
                  <div className="space-y-1">
                    {commit.parentIds.map((parentOid) => (
                      <div key={parentOid} className="flex items-center gap-2">
                        <span className="text-xs text-[#5799da] font-mono">
                          {parentOid.slice(0, 7)}
                        </span>
                        <button
                          onClick={() => navigator.clipboard.writeText(parentOid)}
                          className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 作者 */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 mb-1">{t('commitDetail.author')}</h4>
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                    style={{ backgroundColor: getAvatarColor(commit.authorEmail) }}
                  >
                    {commit.authorName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm text-gray-200">{commit.authorName}</div>
                    <div className="text-xs text-gray-500">{commit.authorEmail}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {formatDate(commit.authorTimestamp)}
                </div>
              </div>

              {/* 提交者 */}
              {commit.authorEmail !== commit.committerEmail && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 mb-1">{t('commitDetail.committer')}</h4>
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                      style={{ backgroundColor: getAvatarColor(commit.committerEmail) }}
                    >
                      {commit.committerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm text-gray-200">{commit.committerName}</div>
                      <div className="text-xs text-gray-500">{commit.committerEmail}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(commit.committerTimestamp)}
                  </div>
                </div>
              )}
            </div>
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

export default CommitDetailPanel;
