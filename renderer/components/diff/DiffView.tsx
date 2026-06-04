/**
 * 差异查看组件
 * 支持 Unified（内联）和 Side-by-Side（并排）两种模式
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { GitDiff, GitDiffHunk, GitDiffLine } from '@shared/types/git';
import { zhCN } from '../../i18n/zh-CN';

/** 视图模式 */
export type DiffViewMode = 'unified' | 'side-by-side';

/** localStorage 持久化的 key */
const DIFF_VIEW_MODE_KEY = 'gitgui-diff-view-mode';

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
  const [viewMode, setViewMode] = useState<DiffViewMode>(() => {
    // 从 localStorage 读取持久化的模式
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(DIFF_VIEW_MODE_KEY);
      if (saved === 'unified' || saved === 'side-by-side') {
        return saved;
      }
    }
    return 'unified';
  });

  // Side-by-Side 模式同步滚动 ref
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // 切换视图模式并持久化
  const handleViewModeChange = (mode: DiffViewMode) => {
    setViewMode(mode);
    localStorage.setItem(DIFF_VIEW_MODE_KEY, mode);
  };

  // 快捷键处理：Ctrl+Shift+S 切换模式
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        handleViewModeChange(viewMode === 'unified' ? 'side-by-side' : 'unified');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  // Side-by-Side 同步滚动
  const handleScroll = useCallback((source: 'left' | 'right') => {
    if (isScrollingRef.current) return;
    
    const sourceEl = source === 'left' ? leftPanelRef.current : rightPanelRef.current;
    const targetEl = source === 'left' ? rightPanelRef.current : leftPanelRef.current;
    
    if (!sourceEl || !targetEl) return;
    
    isScrollingRef.current = true;
    targetEl.scrollTop = sourceEl.scrollTop;
    requestAnimationFrame(() => {
      isScrollingRef.current = false;
    });
  }, []);

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

  // 渲染 Unified 模式
  const renderUnifiedView = () => (
    <div className="font-mono text-xs">
      {diff.map((fileDiff, fileIndex) => (
        <div key={fileIndex} className="border-b border-panel-border">
          {/* 文件头 */}
          <div className="bg-panel-bg px-4 py-2 border-b border-panel-border">
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
            fileDiff.hunks.map((hunk, hunkIndex) => (
              <div key={hunkIndex}>
                {/* Hunk 头 */}
                <div className="bg-blue-900/20 text-blue-400 px-4 py-1">
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
            ))
          )}

          {/* 统计信息 */}
          <div className="px-4 py-2 bg-panel-bg text-xs text-gray-500 border-t border-panel-border">
            {renderStats(fileDiff)}
          </div>
        </div>
      ))}
    </div>
  );

  // 渲染 Side-by-Side 模式
  const renderSideBySideView = () => (
    <div className="font-mono text-xs">
      {diff.map((fileDiff, fileIndex) => (
        <div key={fileIndex} className="border-b border-panel-border">
          {/* 文件头 */}
          <div className="bg-panel-bg px-4 py-2 border-b border-panel-border">
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
            <div className="flex">
              {/* 左栏（旧文件） */}
              <div 
                ref={leftPanelRef}
                className="flex-1 border-r border-panel-border overflow-auto max-h-[600px]"
                onScroll={() => handleScroll('left')}
              >
                {fileDiff.hunks.map((hunk, hunkIndex) => (
                  <SideBySideHunk
                    key={hunkIndex}
                    hunk={hunk}
                    side="old"
                    i18n={i18n}
                  />
                ))}
              </div>

              {/* 右栏（新文件） */}
              <div 
                ref={rightPanelRef}
                className="flex-1 overflow-auto max-h-[600px]"
                onScroll={() => handleScroll('right')}
              >
                {fileDiff.hunks.map((hunk, hunkIndex) => (
                  <SideBySideHunk
                    key={hunkIndex}
                    hunk={hunk}
                    side="new"
                    i18n={i18n}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 统计信息 */}
          <div className="px-4 py-2 bg-panel-bg text-xs text-gray-500 border-t border-panel-border">
            {renderStats(fileDiff)}
          </div>
        </div>
      ))}
    </div>
  );

  // 渲染统计信息
  const renderStats = (fileDiff: GitDiff) => {
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
    <div className="h-full flex flex-col">
      {/* 工具栏：视图模式切换 */}
      <div className="flex items-center justify-between px-4 py-2 bg-panel-bg border-b border-panel-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{i18n.diff.viewMode}:</span>
          <div className="flex bg-gray-800 rounded overflow-hidden">
            <button
              className={`px-3 py-1 text-xs transition-colors ${
                viewMode === 'unified'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => handleViewModeChange('unified')}
              title="Unified View (Ctrl+Shift+S)"
            >
              {i18n.diff.unified}
            </button>
            <button
              className={`px-3 py-1 text-xs transition-colors ${
                viewMode === 'side-by-side'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => handleViewModeChange('side-by-side')}
              title="Side-by-Side View (Ctrl+Shift+S)"
            >
              {i18n.diff.sideBySide}
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {i18n.diff.viewModeShortcut}: <kbd className="px-1 py-0.5 bg-gray-700 rounded">Ctrl+Shift+S</kbd>
        </div>
      </div>

      {/* 差异内容 */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'unified' ? renderUnifiedView() : renderSideBySideView()}
      </div>
    </div>
  );
}

/** Side-by-Side 模式的 Hunk 组件 */
interface SideBySideHunkProps {
  hunk: GitDiffHunk;
  side: 'old' | 'new';
  i18n: typeof zhCN;
}

function SideBySideHunk({ hunk, side, i18n }: SideBySideHunkProps) {
  // 将 hunk 转换为并排行
  const sideBySideLines = convertToSideBySide(hunk);

  return (
    <div>
      {/* Hunk 头 */}
      <div className="bg-blue-900/20 text-blue-400 px-2 py-1 sticky left-0">
        <span className="text-[10px]">
          @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
        </span>
      </div>

      {/* 并排行 */}
      {sideBySideLines.map((row, index) => {
        const line = side === 'old' ? row.oldLine : row.newLine;
        const lineNumber = side === 'old' ? row.oldLineNumber : row.newLineNumber;

        if (!line) {
          // 空行（纯新增或纯删除的配对行）
          return (
            <div
              key={index}
              className="flex h-5"
              style={{ minHeight: '20px' }}
            >
              <span className="w-10 text-right pr-2 text-gray-600 select-none border-r border-panel-border bg-gray-900/30">
                {lineNumber || ''}
              </span>
              <span className="flex-1 px-2 bg-gray-900/20" />
            </div>
          );
        }

        // 行样式
        let bgClass = 'bg-transparent';
        if (line.type === 'add') {
          bgClass = 'bg-green-900/30';
        } else if (line.type === 'delete') {
          bgClass = 'bg-red-900/30';
        } else if (row.isModified) {
          bgClass = side === 'old' ? 'bg-yellow-900/20' : 'bg-green-900/20';
        }

        return (
          <div
            key={index}
            className={`flex h-5 ${bgClass}`}
            style={{ minHeight: '20px' }}
          >
            {/* 行号 */}
            <span className="w-10 text-right pr-2 text-gray-600 select-none border-r border-panel-border">
              {lineNumber || ''}
            </span>

            {/* 前缀 */}
            <span className="w-5 text-center select-none text-gray-500">
              {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
            </span>

            {/* 内容 */}
            <span className={`flex-1 px-1 whitespace-pre ${
              line.type === 'add' ? 'text-green-400' : 
              line.type === 'delete' ? 'text-red-400' : 'text-gray-300'
            }`}>
              {line.content}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 并排显示的行数据 */
interface SideBySideRow {
  oldLine: GitDiffLine | null;
  newLine: GitDiffLine | null;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  isModified: boolean;
}

/**
 * 将 hunk 转换为并排显示的行
 * 策略：
 * - 纯删除行：左边显示，右边 null
 * - 纯新增行：左边 null，右边显示
 * - 上下文行：两边都显示
 * - 修改行：两边都显示，标记 isModified
 */
function convertToSideBySide(hunk: GitDiffHunk): SideBySideRow[] {
  const result: SideBySideRow[] = [];
  const lines = hunk.lines;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.type === 'context') {
      // 上下文行：两边都显示
      result.push({
        oldLine: line,
        newLine: line,
        oldLineNumber: line.oldLineNumber ?? null,
        newLineNumber: line.newLineNumber ?? null,
        isModified: false,
      });
      i++;
    } else if (line.type === 'delete' && (i + 1 >= lines.length || lines[i + 1].type !== 'add')) {
      // 纯删除行（后面不是新增）
      result.push({
        oldLine: line,
        newLine: null,
        oldLineNumber: line.oldLineNumber ?? null,
        newLineNumber: null,
        isModified: false,
      });
      i++;
    } else if (line.type === 'add' && (i === 0 || lines[i - 1].type !== 'delete')) {
      // 纯新增行（前面不是删除）
      result.push({
        oldLine: null,
        newLine: line,
        oldLineNumber: null,
        newLineNumber: line.newLineNumber ?? null,
        isModified: false,
      });
      i++;
    } else if (line.type === 'delete' && i + 1 < lines.length && lines[i + 1].type === 'add') {
      // 修改行：删除+新增 配对
      const deleteLine = line;
      const addLine = lines[i + 1];

      // 添加删除行（左边）
      result.push({
        oldLine: deleteLine,
        newLine: null,
        oldLineNumber: deleteLine.oldLineNumber ?? null,
        newLineNumber: null,
        isModified: true,
      });

      // 添加新增行（右边）
      result.push({
        oldLine: null,
        newLine: addLine,
        oldLineNumber: null,
        newLineNumber: addLine.newLineNumber ?? null,
        isModified: true,
      });

      i += 2;
    } else {
      // 其他情况
      result.push({
        oldLine: line,
        newLine: line,
        oldLineNumber: line.oldLineNumber ?? null,
        newLineNumber: line.newLineNumber ?? null,
        isModified: false,
      });
      i++;
    }
  }

  return result;
}

export default DiffView;
export type { DiffViewProps };
