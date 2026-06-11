/**
 * 状态面板组件（增强版）
 * 显示暂存区、未暂存、未跟踪文件
 * 增强：组合列表模式、文件树视图、文件列表过滤、隐藏未跟踪切换
 */
import React, { useState, useCallback, useMemo } from 'react';
import './StatusPanel.css';
import type { GitStatus, GitFileStatus } from '@shared/types/git';
import { useI18 } from '../../i18n';
import { useRepoStore } from '../../stores/repoStore';

type ViewMode = 'split' | 'combined' | 'tree';

interface StatusPanelProps {
  status: GitStatus | null;
  onFileSelect: (path: string | null) => void;
  selectedFile: string | null;
  onStage?: (path: string) => void;
  onUnstage?: (path: string) => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
  onViewHistory?: (filePath: string) => void;
  onRefresh?: () => void;
}

interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children: FileNode[];
  file?: GitFileStatus & { section: 'staged' | 'unstaged' | 'untracked' };
}

function StatusPanel({
  status, onFileSelect, selectedFile, onStage, onUnstage,
  onStageAll, onUnstageAll, onViewHistory, onRefresh,
}: StatusPanelProps) {
  const { t } = useI18();
  const currentRepo = useRepoStore(s => s.currentRepo);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [searchFilter, setSearchFilter] = useState('');
  const [hideUntracked, setHideUntracked] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; file: GitFileStatus; section: 'staged' | 'unstaged' | 'untracked';
  } | null>(null);

  const toggleDir = (dir: string) => {
    const s = new Set(expandedDirs);
    s.has(dir) ? s.delete(dir) : s.add(dir);
    setExpandedDirs(s);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, file: GitFileStatus, section: 'staged' | 'unstaged' | 'untracked') => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, file, section });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Build file tree
  const buildTree = (files: Array<GitFileStatus & { section: string }>): FileNode => {
    const root: FileNode = { name: '', path: '', isDir: true, children: [] };
    for (const file of files) {
      const parts = file.path.split('/');
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const partialPath = parts.slice(0, i + 1).join('/');
        if (isLast) {
          current.children.push({
            name: part, path: file.path, isDir: false, children: [],
            file: file as any,
          });
        } else {
          let dir = current.children.find(c => c.isDir && c.name === part);
          if (!dir) {
            dir = { name: part, path: partialPath, isDir: true, children: [] };
            current.children.push(dir);
          }
          current = dir;
        }
      }
    }
    // Sort: dirs first, then files, alphabetical
    const sortChildren = (node: FileNode) => {
      node.children.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    };
    sortChildren(root);
    return root;
  };

  // Filter files
  const filterFiles = (files: GitFileStatus[], section: 'staged' | 'unstaged' | 'untracked') => {
    return files.filter(f => {
      if (hideUntracked && section === 'untracked') return false;
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        return f.path.toLowerCase().includes(q);
      }
      return true;
    });
  };

  const getStatusStyle = (fileStatus: GitFileStatus['status']) => {
    const styles: Record<string, { text: string; label: string }> = {
      added: { text: 'text-green-400', label: 'A' },
      modified: { text: 'text-yellow-400', label: 'M' },
      deleted: { text: 'text-red-400', label: 'D' },
      renamed: { text: 'text-blue-400', label: 'R' },
      copied: { text: 'text-blue-400', label: 'C' },
      unchanged: { text: 'text-gray-400', label: '' },
    };
    return styles[fileStatus] || styles.unchanged;
  };

  const renderFile = (file: GitFileStatus, section: 'staged' | 'unstaged' | 'untracked') => {
    const style = getStatusStyle(file.status);
    const isSelected = selectedFile === file.path;
    const isStaged = section === 'staged';
    return (
      <div
        key={`${section}-${file.path}`}
        className={`sp-file group flex items-center gap-2 cursor-pointer transition-colors
          ${isSelected ? 'bg-[#094771]' : 'hover:bg-[#2a2d2e]'}`}
        onClick={() => onFileSelect(file.path)}
        onContextMenu={(e) => handleContextMenu(e, file, section)}
      >
        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); isStaged ? onUnstage?.(file.path) : onStage?.(file.path); }}>
          <input type="checkbox" checked={isStaged} onChange={() => {}}
            className="w-3.5 h-3.5 rounded border-[#3c3c3c] bg-[#3c3c3c] text-green-500 cursor-pointer" />
        </div>
        <span className={`text-xs font-mono font-bold ${style.text} w-4 text-center flex-shrink-0`}>
          {style.label}
        </span>
        <span className={`flex-1 text-sm truncate ${style.text}`}>
          {file.path}
        </span>
        {viewMode === 'combined' && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
            section === 'staged' ? 'bg-green-500/20 text-green-400' :
            section === 'unstaged' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {section === 'staged' ? 'S' : section === 'unstaged' ? 'U' : '?'}
          </span>
        )}
      </div>
    );
  };

  // Render tree node
  const renderTreeNode = (node: FileNode, depth: number = 0): React.ReactNode => {
    if (node.isDir) {
      const isExpanded = expandedDirs.has(node.path) || depth === 0;
      if (depth === 0) {
        // Root node - just render children
        return <>{node.children.map(c => renderTreeNode(c, depth))}</>;
      }
      return (
        <div key={node.path}>
          <div
            className="sp-dir flex items-center gap-2 px-3 py-1 cursor-pointer hover:bg-[#2a2d2e]"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => toggleDir(node.path)}
          >
            <svg className={`w-3 h-3 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-sm text-gray-400">{node.name}</span>
            <span className="text-xs text-gray-600">({node.children.length})</span>
          </div>
          {isExpanded && node.children.map(c => renderTreeNode(c, depth + 1))}
        </div>
      );
    }
    // File node
    if (node.file) {
      const style = getStatusStyle(node.file.status);
      const isSelected = selectedFile === node.file.path;
      const isStaged = node.file.section === 'staged';
      return (
        <div
          key={node.file.path}
          className={`sp-file group flex items-center gap-2 cursor-pointer transition-colors
            ${isSelected ? 'bg-[#094771]' : 'hover:bg-[#2a2d2e]'}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => onFileSelect(node.file!.path)}
          onContextMenu={(e) => handleContextMenu(e, node.file!, node.file!.section)}
        >
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); isStaged ? onUnstage?.(node.file!.path) : onStage?.(node.file!.path); }}>
            <input type="checkbox" checked={isStaged} onChange={() => {}}
              className="w-3.5 h-3.5 rounded border-[#3c3c3c] bg-[#3c3c3c] text-green-500 cursor-pointer" />
          </div>
          <span className={`text-xs font-mono font-bold ${style.text} w-4 text-center flex-shrink-0`}>{style.label}</span>
          <span className={`flex-1 text-sm truncate ${style.text}`}>{node.name}</span>
        </div>
      );
    }
    return null;
  };

  React.useEffect(() => {
    const handleClick = () => closeContextMenu();
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu, closeContextMenu]);

  if (!status) return <div className="p-4 text-center text-gray-500 text-sm">{t('common.loading')}</div>;

  if (status.isClean) return (
    <div className="p-4 text-center text-gray-500">
      <svg className="w-12 h-12 mx-auto mb-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <p className="text-sm">{t('status.clean')}</p>
    </div>
  );

  const staged = filterFiles(status.staged, 'staged');
  const unstaged = filterFiles(status.unstaged, 'unstaged');
  const untracked = filterFiles(status.untracked, 'untracked');
  const allFiles = [
    ...staged.map(f => ({ ...f, section: 'staged' as const })),
    ...unstaged.map(f => ({ ...f, section: 'unstaged' as const })),
    ...untracked.map(f => ({ ...f, section: 'untracked' as const })),
  ];
  const totalChanges = allFiles.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 工具栏 */}
      <div className="sp-toolbar flex-shrink-0 px-3 py-2 flex items-center justify-between border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          {/* 视图切换 */}
          <div className="sp-view-toggle flex rounded overflow-hidden border border-[#3c3c3c]">
            <button className={`sp-view-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => setViewMode('split')} title="分区视图">⊞</button>
            <button className={`sp-view-btn ${viewMode === 'combined' ? 'active' : ''}`}
              onClick={() => setViewMode('combined')} title="组合列表">☰</button>
            <button className={`sp-view-btn ${viewMode === 'tree' ? 'active' : ''}`}
              onClick={() => setViewMode('tree')} title="文件树">🌳</button>
          </div>

          {/* 搜索 */}
          <input
            type="text" value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
            placeholder="过滤文件..."
            className="sp-filter-input px-2 py-1 bg-[#3c3c3c] border border-[#4c4c4c] rounded text-xs text-gray-200 w-32"
          />

          {/* 隐藏未跟踪 */}
          <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer select-none">
            <input type="checkbox" checked={hideUntracked} onChange={e => setHideUntracked(e.target.checked)}
              className="w-3 h-3" />
            隐藏未跟踪
          </label>
        </div>

        <div className="flex items-center gap-2">
          {status.staged.length > 0 && (
            <button onClick={onUnstageAll} className="px-2 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4f4f4f] rounded">
              {t('detail.unstageAll')}
            </button>
          )}
          {(status.unstaged.length > 0 || status.untracked.length > 0) && (
            <button onClick={onStageAll} className="px-2 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4f4f4f] rounded">
              {t('detail.stageAll')}
            </button>
          )}
          <span className="text-xs text-gray-500">{totalChanges} 变更</span>
        </div>
      </div>

      {/* 文件列表 */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'tree' ? (
          // 树视图
          renderTreeNode(buildTree(allFiles as any), 0)
        ) : viewMode === 'combined' ? (
          // 组合列表
          <div className="py-1">
            {allFiles.map(f => renderFile(f, f.section))}
            {allFiles.length === 0 && <div className="text-center text-gray-500 text-sm py-4">无匹配文件</div>}
          </div>
        ) : (
          // 分区视图（默认）
          <>
            {staged.length > 0 && (
              <div className="border-b border-[#3c3c3c]">
                <div className="sticky top-0 z-10 px-3 py-1.5 text-xs font-semibold text-green-400 uppercase bg-[#252526] border-b border-[#3c3c3c]">
                  {t('detail.staged')} ({staged.length})
                </div>
                <div className="py-1">{staged.map(f => renderFile(f, 'staged'))}</div>
              </div>
            )}
            {unstaged.length > 0 && (
              <div className="border-b border-[#3c3c3c]">
                <div className="sticky top-0 z-10 px-3 py-1.5 text-xs font-semibold text-yellow-400 uppercase bg-[#252526] border-b border-[#3c3c3c]">
                  {t('detail.unstaged')} ({unstaged.length})
                </div>
                <div className="py-1">{unstaged.map(f => renderFile(f, 'unstaged'))}</div>
              </div>
            )}
            {untracked.length > 0 && (
              <div>
                <div className="sticky top-0 z-10 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase bg-[#252526] border-b border-[#3c3c3c]">
                  {t('detail.untracked')} ({untracked.length})
                </div>
                <div className="py-1">{untracked.map(f => renderFile(f, 'untracked'))}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div className="fixed bg-[#2d2d30] border border-[#3c3c3c] rounded shadow-xl py-1 z-[1000] min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
          {/* Stage / Unstage */}
          <div className="px-3 py-2 text-sm text-gray-300 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
            onClick={() => {
              contextMenu.section === 'staged' ? onUnstage?.(contextMenu.file.path) : onStage?.(contextMenu.file.path);
              closeContextMenu();
            }}>
            {contextMenu.section === 'staged' ? '⊟ ' : '⊞ '}{contextMenu.section === 'staged' ? (t('detail.unstage') || '取消暂存') : (t('detail.stage') || '暂存')}
          </div>
          <div className="h-px bg-[#3c3c3c] my-1" />
          <div className="px-3 py-2 text-sm text-gray-300 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
            onClick={() => { onFileSelect(contextMenu.file.path); closeContextMenu(); }}>
            👁 {t('detail.viewDiff')}
          </div>
          <div className="px-3 py-2 text-sm text-gray-300 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
            onClick={() => { onViewHistory?.(contextMenu.file.path); closeContextMenu(); }}>
            📜 {t('fileHistory.title') || '文件历史'}
          </div>
          <div className="px-3 py-2 text-sm text-gray-300 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
            onClick={() => { window.dispatchEvent(new CustomEvent('showBlame', { detail: contextMenu.file.path })); closeContextMenu(); }}>
            🔍 Blame
          </div>
          <div className="h-px bg-[#3c3c3c] my-1" />
          <div className="px-3 py-2 text-sm text-gray-300 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
            onClick={async () => { if (currentRepo) await window.electronAPI.shell.openPath(`${currentRepo.path}/${contextMenu.file.path}`); closeContextMenu(); }}>
            📂 在资源管理器中打开
          </div>
          <div className="px-3 py-2 text-sm text-gray-300 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
            onClick={() => { navigator.clipboard.writeText(contextMenu.file.path); closeContextMenu(); }}>
            📋 {t('contextMenu.copyPath')}
          </div>
          <div className="h-px bg-[#3c3c3c] my-1" />
          {contextMenu.section === 'unstaged' && (
            <div className="px-3 py-2 text-sm text-red-400 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
              onClick={async () => {
                if (window.confirm(t('fileActions.discardConfirm'))) {
                  try { await window.electronAPI.git.discardChanges([contextMenu.file.path]); onRefresh?.(); }
                  catch (e) { console.error(e); }
                }
                closeContextMenu();
              }}>
              🗑 {t('fileActions.discardChanges')}
            </div>
          )}
          {contextMenu.section === 'untracked' && (
            <div className="px-3 py-2 text-sm text-red-400 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
              onClick={async () => {
                if (window.confirm(t('fileActions.deleteConfirm'))) {
                  try { await window.electronAPI.git.deleteUntrackedFile(contextMenu.file.path); onRefresh?.(); }
                  catch (e) { console.error(e); }
                }
                closeContextMenu();
              }}>
              🗑 {t('fileActions.deleteFile')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StatusPanel;
