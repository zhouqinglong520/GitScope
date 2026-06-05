/**
 * 状态面板组件
 * 显示暂存区、未暂存、未跟踪文件，支持 checkbox 勾选和 hunk 级别操作
 * 支持右键菜单查看文件历史
 */

import React, { useState, useCallback } from 'react';
import type { GitStatus, GitFileStatus } from '@shared/types/git';
import { zhCN } from '../../i18n/zh-CN';

interface StatusPanelProps {
  /** 仓库状态 */
  status: GitStatus | null;
  /** 选择文件回调 */
  onFileSelect: (path: string | null) => void;
  /** 当前选中的文件 */
  selectedFile: string | null;
  /** 暂存文件回调 */
  onStage?: (path: string) => void;
  /** 取消暂存回调 */
  onUnstage?: (path: string) => void;
  /** 暂存所有回调 */
  onStageAll?: () => void;
  /** 取消所有暂存回调 */
  onUnstageAll?: () => void;
  /** 查看文件历史回调 */
  onViewHistory?: (filePath: string) => void;
  /** 刷新回调 */
  onRefresh?: () => void;
}

function StatusPanel({
  status,
  onFileSelect,
  selectedFile,
  onStage,
  onUnstage,
  onStageAll,
  onUnstageAll,
  onViewHistory,
  onRefresh,
}: StatusPanelProps) {
  const i18n = zhCN;
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: GitFileStatus;
    section: 'staged' | 'unstaged' | 'untracked';
  } | null>(null);

  // 切换文件展开状态
  const toggleExpand = (path: string) => {
    const newSet = new Set(expandedFiles);
    if (newSet.has(path)) {
      newSet.delete(path);
    } else {
      newSet.add(path);
    }
    setExpandedFiles(newSet);
  };

  // 右键菜单
  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    file: GitFileStatus,
    section: 'staged' | 'unstaged' | 'untracked'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      file,
      section,
    });
  }, []);

  // 关闭右键菜单
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // 获取状态徽章样式和颜色
  const getStatusStyle = (fileStatus: GitFileStatus['status']) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      added: { bg: 'bg-green-500/20', text: 'text-green-400', label: i18n.status.added },
      modified: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: i18n.status.modified },
      deleted: { bg: 'bg-red-500/20', text: 'text-red-400', label: i18n.status.deleted },
      renamed: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: i18n.status.renamed },
      copied: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Copied' },
      unchanged: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: '' },
    };
    return styles[fileStatus] || styles.unchanged;
  };

  // 获取文件图标
  const getFileIcon = (path: string, isExpanded: boolean) => {
    const isDir = path.includes('/');
    
    if (isDir) {
      return isExpanded ? (
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      );
    }

    return (
      <svg className="w-4 h-4 text-gray-500 ml-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  };

  // 渲染单个文件
  const renderFile = (
    file: GitFileStatus,
    section: 'staged' | 'unstaged' | 'untracked'
  ) => {
    const statusStyle = getStatusStyle(file.status);
    const isSelected = selectedFile === file.path;
    const isStaged = section === 'staged';

    return (
      <div
        key={`${section}-${file.path}`}
        className={`
          group flex items-center gap-2 cursor-pointer transition-colors
          ${isSelected ? 'bg-primary-600/20' : 'hover:bg-sidebar-hover'}
        `}
        onClick={() => onFileSelect(file.path)}
        onContextMenu={(e) => handleContextMenu(e, file, section)}
      >
        {/* Checkbox */}
        <div
          className="w-6 h-6 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            if (isStaged) {
              onUnstage?.(file.path);
            } else {
              onStage?.(file.path);
            }
          }}
        >
          <input
            type="checkbox"
            checked={isStaged}
            onChange={() => {}}
            className="w-3.5 h-3.5 rounded border-[#3c3c3c] bg-[#3c3c3c] text-green-500 focus:ring-green-500 focus:ring-offset-0 cursor-pointer"
          />
        </div>

        {/* 文件图标 */}
        {getFileIcon(file.path, expandedFiles.has(file.path))}

        {/* 状态字母 */}
        <span className={`text-xs font-mono font-bold ${statusStyle.text} w-4 text-center`}>
          {file.status === 'modified' ? 'M' : file.status === 'added' ? 'A' : file.status === 'deleted' ? 'D' : file.status === 'renamed' ? 'R' : '?'}
        </span>
        {/* 文件路径 */}
        <span className="flex-1 text-sm truncate py-1.5">
          <span className={statusStyle.text}>{file.path}</span>
        </span>

        {/* 状态标签 */}
        {statusStyle.label && (
          <span className={`badge ${statusStyle.bg} ${statusStyle.text} mr-2`}>
            {statusStyle.label}
          </span>
        )}
      </div>
    );
  };

  // 按目录分组文件
  const groupFilesByDir = (files: GitFileStatus[]) => {
    const groups: Record<string, GitFileStatus[]> = {};
    
    files.forEach((file) => {
      const parts = file.path.split('/');
      parts.pop();
      const dir = parts.join('/') || '.';
      if (!groups[dir]) {
        groups[dir] = [];
      }
      groups[dir].push(file);
    });

    return groups;
  };

  // 渲染分组文件列表
  const renderFileGroup = (
    files: GitFileStatus[],
    section: 'staged' | 'unstaged' | 'untracked'
  ) => {
    const groups = groupFilesByDir(files);
    const dirNames = Object.keys(groups).sort();

    return dirNames.map((dir) => {
      const dirFiles = groups[dir];
      const isExpanded = expandedFiles.has(dir);

      // 只有单个目录且不是根目录时，扁平显示
      if (dirNames.length === 1 && dir === '.') {
        return dirFiles.map((file) => renderFile(file, section));
      }

      return (
        <div key={dir}>
          {/* 目录头 */}
          <div
            className="flex items-center gap-2 px-3 py-1 cursor-pointer hover:bg-sidebar-hover"
            onClick={() => toggleExpand(dir)}
          >
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-sm text-gray-400">{dir}</span>
            <span className="text-xs text-gray-500">({dirFiles.length})</span>
          </div>

          {/* 目录内的文件 */}
          {isExpanded && dirFiles.map((file) => renderFile(file, section))}
        </div>
      );
    });
  };

  // 点击外部关闭右键菜单
  React.useEffect(() => {
    const handleClick = () => closeContextMenu();
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu, closeContextMenu]);

  if (!status) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p className="text-sm">{i18n.common.loading}</p>
      </div>
    );
  }

  if (status.isClean) {
    return (
      <div className="p-4 text-center text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-sm">{i18n.status.clean}</p>
      </div>
    );
  }

  const totalChanges = status.staged.length + status.unstaged.length + status.untracked.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 操作按钮栏 */}
      <div className="flex-shrink-0 px-3 py-2 flex items-center justify-between border-b border-panel-border">
        <div className="flex items-center gap-2">
          {status.staged.length > 0 && (
            <button
              onClick={onUnstageAll}
              className="px-2 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4f4f4f] rounded transition-colors"
            >
              {i18n.detail.unstageAll}
            </button>
          )}
          {(status.unstaged.length > 0 || status.untracked.length > 0) && (
            <button
              onClick={onStageAll}
              className="px-2 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4f4f4f] rounded transition-colors"
            >
              {i18n.detail.stageAll}
            </button>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {totalChanges} 个变更
        </span>
      </div>

      {/* 文件列表（可滚动） */}
      <div className="flex-1 overflow-y-auto">
        {/* 暂存区 */}
        {status.staged.length > 0 && (
          <div className="border-b border-panel-border">
            <div className="sticky top-0 z-10 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase bg-panel-bg border-b border-panel-border">
              {i18n.detail.staged} ({status.staged.length})
            </div>
            <div className="py-1">
              {renderFileGroup(status.staged, 'staged')}
            </div>
          </div>
        )}

        {/* 未暂存 */}
        {status.unstaged.length > 0 && (
          <div className="border-b border-panel-border">
            <div className="sticky top-0 z-10 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase bg-panel-bg border-b border-panel-border">
              {i18n.detail.unstaged} ({status.unstaged.length})
            </div>
            <div className="py-1">
              {renderFileGroup(status.unstaged, 'unstaged')}
            </div>
          </div>
        )}

        {/* 未跟踪 */}
        {status.untracked.length > 0 && (
          <div>
            <div className="sticky top-0 z-10 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase bg-panel-bg border-b border-panel-border">
              {i18n.detail.untracked} ({status.untracked.length})
            </div>
            <div className="py-1">
              {renderFileGroup(status.untracked, 'untracked')}
            </div>
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed bg-[#2d2d30] border border-[#3c3c3c] rounded shadow-xl py-1 z-[1000] min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="px-3 py-2 text-sm text-gray-300 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
            onClick={() => {
              onFileSelect(contextMenu.file.path);
              closeContextMenu();
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {i18n.detail.viewDiff}
          </div>
          <div
            className="px-3 py-2 text-sm text-gray-300 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
            onClick={() => {
              onViewHistory?.(contextMenu.file.path);
              closeContextMenu();
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {i18n.fileHistory?.title || '查看文件历史'}
          </div>
          <div className="h-px bg-[#3c3c3c] my-1" />
          <div
            className="px-3 py-2 text-sm text-gray-300 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.file.path);
              closeContextMenu();
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {i18n.contextMenu.copyPath}
          </div>
          {/* Discard / Delete options */}
          <div className="h-px bg-[#3c3c3c] my-1" />
          {contextMenu.section === 'unstaged' && (
            <div
              className="px-3 py-2 text-sm text-red-400 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
              onClick={async () => {
                if (window.confirm(i18n.fileActions.discardConfirm)) {
                  try {
                    await window.electronAPI.git.discardChanges([contextMenu.file.path]);
                    onRefresh?.();
                  } catch (e) {
                    console.error('丢弃更改失败:', e);
                  }
                }
                closeContextMenu();
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {i18n.fileActions.discardChanges}
            </div>
          )}
          {contextMenu.section === 'untracked' && (
            <div
              className="px-3 py-2 text-sm text-red-400 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
              onClick={async () => {
                if (window.confirm(i18n.fileActions.deleteConfirm)) {
                  try {
                    await window.electronAPI.git.deleteUntrackedFile(contextMenu.file.path);
                    onRefresh?.();
                  } catch (e) {
                    console.error('删除文件失败:', e);
                  }
                }
                closeContextMenu();
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {i18n.fileActions.deleteFile}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StatusPanel;
