/**
 * 差异查看组件
 * 显示文件差异或提交详情
 */

import React, { useEffect, useState } from 'react';
import type { GitDiff } from '@shared/types/git';
import { zhCN } from '../../i18n/zh-CN';

interface DiffViewProps {
  /** 提交 SHA（查看提交差异时） */
  commitOid?: string | null;
  /** 文件路径（查看文件差异时） */
  filePath?: string | null;
}

function DiffView({ commitOid, filePath }: DiffViewProps) {
  const i18n = zhCN;
  const [diff, setDiff] = useState<GitDiff[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载差异数据
  useEffect(() => {
    const loadDiff = async () => {
      if (!commitOid && !filePath) {
        setDiff([]);
        return;
      }

      setLoading(true);
      try {
        const result = await window.electronAPI.git.getDiff(filePath || undefined);
        setDiff(result);
      } catch (error) {
        console.error('加载差异失败:', error);
        setDiff([]);
      } finally {
        setLoading(false);
      }
    };

    loadDiff();
  }, [commitOid, filePath]);

  // 获取行类型样式
  const getLineClass = (type: 'context' | 'add' | 'delete') => {
    const baseClass = 'font-mono text-xs leading-5';
    switch (type) {
      case 'add':
        return `${baseClass} bg-green-900/30 text-green-400`;
      case 'delete':
        return `${baseClass} bg-red-900/30 text-red-400`;
      default:
        return `${baseClass} text-gray-300`;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <p className="text-sm">{i18n.common.loading}</p>
      </div>
    );
  }

  if (diff.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">{i18n.diff.noDiff}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {diff.map((fileDiff, fileIndex) => (
        <div key={fileIndex} className="border-b border-panel-border">
          {/* 文件头 */}
          <div className="sticky top-0 bg-panel-bg px-4 py-2 border-b border-panel-border z-10">
            <div className="flex items-center gap-4 text-sm">
              {fileDiff.oldPath && (
                <span className="text-red-400">
                  {i18n.diff.oldFile}: {fileDiff.oldPath}
                </span>
              )}
              {fileDiff.newPath && (
                <span className="text-green-400">
                  {i18n.diff.newFile}: {fileDiff.newPath}
                </span>
              )}
              {fileDiff.type === 'binary' && (
                <span className="text-gray-400">{i18n.diff.binaryFile}</span>
              )}
            </div>
          </div>

          {/* 差异内容 */}
          {fileDiff.type === 'binary' ? (
            <div className="p-8 text-center text-gray-500">
              <p>{i18n.diff.binaryFile}</p>
            </div>
          ) : fileDiff.type === 'untracked' ? (
            <div className="p-8 text-center text-green-400">
              <p>{i18n.diff.untrackedFile}</p>
            </div>
          ) : (
            <div className="font-mono text-xs">
              {fileDiff.hunks.map((hunk, hunkIndex) => (
                <div key={hunkIndex}>
                  {/* Hunk 头 */}
                  <div className="bg-blue-900/20 text-blue-400 px-4 py-1 sticky left-0">
                    <span>@@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@</span>
                  </div>

                  {/* Hunk 内容 */}
                  {hunk.lines.map((line, lineIndex) => (
                    <div
                      key={lineIndex}
                      className={`flex ${getLineClass(line.type)}`}
                    >
                      {/* 行号 */}
                      <span className="w-12 text-right pr-2 text-gray-600 select-none border-r border-panel-border">
                        {line.oldLineNumber || ''}
                      </span>
                      <span className="w-12 text-right pr-2 text-gray-600 select-none border-r border-panel-border">
                        {line.newLineNumber || ''}
                      </span>

                      {/* 前缀 */}
                      <span className="w-6 text-center select-none">
                        {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
                      </span>

                      {/* 内容 */}
                      <span className="flex-1 px-2 whitespace-pre">{line.content}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* 统计信息 */}
          <div className="px-4 py-2 bg-panel-bg text-xs text-gray-500 border-t border-panel-border">
            {(() => {
              let additions = 0;
              let deletions = 0;
              fileDiff.hunks.forEach((hunk) => {
                hunk.lines.forEach((line) => {
                  if (line.type === 'add') additions++;
                  if (line.type === 'delete') deletions++;
                });
              });
              return (
                <span>
                  <span className="text-green-400">+{additions}</span>
                  {' / '}
                  <span className="text-red-400">-{deletions}</span>
                </span>
              );
            })()}
          </div>
        </div>
      ))}
    </div>
  );
}

export default DiffView;
