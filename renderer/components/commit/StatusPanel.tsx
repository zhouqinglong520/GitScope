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

  /** Split file path into directory + filename for smart display */
  const splitPath = (filePath: string) => {
    const idx = filePath.lastIndexOf('/');
    if (idx === -1) return { dir: '', name: filePath };
    return { dir: filePath.slice(0, idx + 1), name: filePath.slice(idx + 1) };
  };

  /** Per-file hover action buttons (Fork/SourceGit style) */
  const renderFileActions = (file: GitFileStatus, section: 'staged' | 'unstaged' | 'untracked') => {
    const isStaged = section === 'staged';
    return (
      <div className="sp-file-actions" onClick={(e) => e.stopPropagation()}>
        {/* Stage / Unstage */}
        <button
          onClick={() => isStaged ? onUnstage?.(file.path) : onStage?.(file.path)}
          style={{ padding: '1px 6px', fontSize: 10, borderRadius: 3, border: 'none', cursor: 'pointer',
            background: isStaged ? '#3c3c3c' : '#0e7a0d', color: '#e0e0e0' }}
          title={isStaged ? '取消暂存' : '暂存'}
        >
          {isStaged ? '−' : '+'}
        </button>
        {/* Discard (only for unstaged/untracked) */}
        {(section === 'unstaged' || section === 'untracked') && (
          <button
            onClick={async () => {
              if (!window.confirm(section === 'untracked' ? `删除 ${file.path}?` : `放弃 ${file.path} 的更改?`)) return;
              try {
                if (section === 'untracked') await window.electronAPI.git.deleteUntrackedFile(file.path);
                else await window.electronAPI.git.discardChanges([file.path]);
                onRefresh?.();
              } catch (e) { console.error(e); }
            }}
            style={{ padding: '1px 6px', fontSize: 10, borderRadius: 3, border: 'none', cursor: 'pointer',
              background: 'transparent', color: '#f44747' }}
            title={section === 'untracked' ? '删除文件' : '放弃更改'}
          >
            ✕
          </button>
        )}
      </div>
    );
  };

  const renderFile = (file: GitFileStatus, section: 'staged' | 'unstaged' | 'untracked') => {
    const style = getStatusStyle(file.status);
    const isSelected = selectedFile === file.path;
    const isStaged = section === 'staged';
    const { dir, name } = splitPath(file.path);
    return (
      <div
        key={`${section}-${file.path}`}
        className={`sp-file group flex items-center gap-2 cursor-pointer transition-colors
          ${isSelected ? 'bg-[#094771]' : 'hover:bg-[#2a2d2e]'}`}
        onClick={() => onFileSelect(file.path)}
        onContextMenu={(e) => handleContextMenu(e, file, section)}
      >
        {/* Stage/Unstage checkbox toggle */}
        <div style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${isStaged ? '#4ec9b0' : '#555'}`, background: isStaged ? '#4ec9b022' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          onClick={(e) => { e.stopPropagation(); isStaged ? onUnstage?.(file.path) : onStage?.(file.path); }}>
          {isStaged && (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ec9b0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>)}
        </div>
        {/* Status badge — styled pill */}
        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: style.text.includes('green') ? '#4ec9b0' : style.text.includes('yellow') ? '#e5c07b' : style.text.includes('red') ? '#e06c75' : '#61afef', background: '#2a2d2e', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>
          {style.label}
        </span>
        {/* Smart file path: dir muted + filename highlighted */}
        <span className="flex-1 truncate" style={{ fontSize: 12 }}>
          {dir && <span style={{ color: '#808080' }}>{dir}</span>}
          <span style={{ color: '#e0e0e0' }}>{name}</span>
        </span>
        {/* Combined mode section tag */}
        {viewMode === 'combined' && (
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, flexShrink: 0, fontWeight: 600,
            background: section === 'staged' ? '#4ec9b022' : section === 'unstaged' ? '#e5c07b22' : '#80808022',
            color: section === 'staged' ? '#4ec9b0' : section === 'unstaged' ? '#e5c07b' : '#808080' }}>
            {section === 'staged' ? 'S' : section === 'unstaged' ? 'U' : '?'}
          </span>
        )}
        {/* Per-file hover actions */}
        {renderFileActions(file, section)}
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
          <div style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${isStaged ? '#4ec9b0' : '#555'}`, background: isStaged ? '#4ec9b022' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            onClick={(e) => { e.stopPropagation(); isStaged ? onUnstage?.(node.file!.path) : onStage?.(node.file!.path); }}>
            {isStaged && (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ec9b0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>)}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: style.text.includes('green') ? '#4ec9b0' : style.text.includes('yellow') ? '#e5c07b' : style.text.includes('red') ? '#e06c75' : '#61afef', background: '#2a2d2e', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>{style.label}</span>
          <span className="flex-1 truncate" style={{ fontSize: 12, color: '#e0e0e0' }}>{node.name}</span>
          {renderFileActions(node.file!, node.file!.section)}
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
          <div className="sp-view-toggle flex rounded overflow-hidden border border-[#3c3c3c]" style={{ height: 22 }}>
            <button className={`sp-view-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => setViewMode('split')} title="分区视图" style={{ fontSize: 10, padding: '0 6px', width: 'auto' }}>List</button>
            <button className={`sp-view-btn ${viewMode === 'combined' ? 'active' : ''}`}
              onClick={() => setViewMode('combined')} title="组合列表" style={{ fontSize: 10, padding: '0 6px', width: 'auto' }}>Flat</button>
            <button className={`sp-view-btn ${viewMode === 'tree' ? 'active' : ''}`}
              onClick={() => setViewMode('tree')} title="文件树" style={{ fontSize: 10, padding: '0 6px', width: 'auto' }}>Tree</button>
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
                <div className="sticky top-0 z-10 flex items-center justify-between bg-[#252526] border-b border-[#3c3c3c]" style={{ padding: '6px 10px' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#4ec9b0', letterSpacing: '0.5px', textTransform: 'uppercase' }}>STAGED</span>
                    <span style={{ fontSize: 10, color: '#808080', background: '#3c3c3c', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>{staged.length}</span>
                  </div>
                  <button onClick={onUnstageAll} style={{ fontSize: 10, color: '#8b949e', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#e0e0e0')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#8b949e')}>
                    Unstage All
                  </button>
                </div>
                <div className="py-1">{staged.map(f => renderFile(f, 'staged'))}</div>
              </div>
            )}
            {unstaged.length > 0 && (
              <div className="border-b border-[#3c3c3c]">
                <div className="sticky top-0 z-10 flex items-center justify-between bg-[#252526] border-b border-[#3c3c3c]" style={{ padding: '6px 10px' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#e5c07b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>UNSTAGED</span>
                    <span style={{ fontSize: 10, color: '#808080', background: '#3c3c3c', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>{unstaged.length}</span>
                  </div>
                  <button onClick={onStageAll} style={{ fontSize: 10, color: '#8b949e', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#e0e0e0')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#8b949e')}>
                    Stage All
                  </button>
                </div>
                <div className="py-1">{unstaged.map(f => renderFile(f, 'unstaged'))}</div>
              </div>
            )}
            {untracked.length > 0 && (
              <div>
                <div className="sticky top-0 z-10 flex items-center justify-between bg-[#252526] border-b border-[#3c3c3c]" style={{ padding: '6px 10px' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#808080', letterSpacing: '0.5px', textTransform: 'uppercase' }}>UNTRACKED</span>
                    <span style={{ fontSize: 10, color: '#808080', background: '#3c3c3c', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>{untracked.length}</span>
                  </div>
                  <button onClick={onStageAll} style={{ fontSize: 10, color: '#8b949e', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#e0e0e0')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#8b949e')}>
                    Stage All
                  </button>
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
