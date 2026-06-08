/**
 * Diff 文件树组件
 * 按目录结构折叠展示变更文件列表
 * 替代扁平文件列表，大 PR 50+ 文件时快速定位
 */

import React, { useState, useMemo, useCallback } from 'react';
import './DiffFileTree.css';

interface FileEntry {
  path: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'unchanged';
  additions: number;
  deletions: number;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  children: Map<string, TreeNode>;
  file?: FileEntry;
  expanded?: boolean;
}

const STATUS_ICONS: Record<string, { label: string; color: string }> = {
  added:    { label: 'A', color: '#e2a855' },
  modified: { label: 'M', color: '#6cc644' },
  deleted:  { label: 'D', color: '#e85d75' },
  renamed:  { label: 'R', color: '#5799da' },
  copied:   { label: 'C', color: '#5799da' },
  unchanged:{ label: '-', color: '#888888' },
};

interface DiffFileTreeProps {
  files: FileEntry[];
  selectedFile?: string | null;
  onFileSelect: (path: string) => void;
  onViewDiff?: (oid: string, path: string) => void;
  onViewHistory?: (path: string) => void;
  commitOid?: string;
}

function buildTree(files: FileEntry[]): TreeNode {
  const root: TreeNode = { name: '', fullPath: '', isDir: true, children: new Map() };

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      const childPath = parts.slice(0, i + 1).join('/');

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          fullPath: childPath,
          isDir: !isLeaf,
          children: new Map(),
          file: isLeaf ? file : undefined,
          expanded: false,
        });
      }
      current = current.children.get(part)!;
    }
  }
  return root;
}

function TreeNodeItem({
  node,
  depth,
  selectedFile,
  onFileSelect,
  onViewDiff,
  onViewHistory,
  commitOid,
  defaultExpanded,
}: {
  node: TreeNode;
  depth: number;
  selectedFile?: string | null;
  onFileSelect: (path: string) => void;
  onViewDiff?: (oid: string, path: string) => void;
  onViewHistory?: (path: string) => void;
  commitOid?: string;
  defaultExpanded: boolean | ((depth: number) => boolean);
}) {
  const [expanded, setExpanded] = useState(typeof defaultExpanded === 'function' ? defaultExpanded(depth) : defaultExpanded);

  if (node.isDir) {
    const childCount = countFiles(node);
    const sorted = Array.from(node.children.values()).sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <div className="dft-dir">
        <div
          className="dft-dir-header"
          style={{ paddingLeft: depth * 16 + 8 }}
          onClick={() => setExpanded(!expanded)}
        >
          <svg
            className={`dft-arrow ${expanded ? 'dft-arrow-open' : ''}`}
            width="10" height="10" viewBox="0 0 10 10"
          >
            <path d="M3 1l5 4-5 4z" fill="currentColor" />
          </svg>
          <svg className="dft-icon dft-icon-dir" width="14" height="14" viewBox="0 0 16 16">
            <path d="M1.5 1h5l1 2H14.5a.5.5 0 01.5.5v10a.5.5 0 01-.5.5h-13a.5.5 0 01-.5-.5v-12a.5.5 0 01.5-.5z" fill="#e2a855"/>
          </svg>
          <span className="dft-name">{node.name}</span>
          <span className="dft-count">{childCount}</span>
        </div>
        {expanded && sorted.map(child => (
          <TreeNodeItem
            key={child.fullPath}
            node={child}
            depth={depth + 1}
            selectedFile={selectedFile}
            onFileSelect={onFileSelect}
            onViewDiff={onViewDiff}
            onViewHistory={onViewHistory}
            commitOid={commitOid}
            defaultExpanded={false}
          />
        ))}
      </div>
    );
  }

  // File node
  const status = node.file ? STATUS_ICONS[node.file.status] : null;
  const isSelected = selectedFile === node.fullPath;
  const fileStats = node.file ? { add: node.file.additions, del: node.file.deletions } : null;

  return (
    <div
      className={`dft-file ${isSelected ? 'dft-file-selected' : ''}`}
      style={{ paddingLeft: depth * 16 + 8 }}
      onClick={() => onFileSelect(node.fullPath)}
    >
      <span className="dft-file-spacer" />
      {status && (
        <span className="dft-status-badge" style={{ color: status.color }}>
          {status.label}
        </span>
      )}
      <svg className="dft-icon dft-icon-file" width="14" height="14" viewBox="0 0 16 16">
        <path d="M3 1h6l4 4v9.5a.5.5 0 01-.5.5h-9a.5.5 0 01-.5-.5v-13a.5.5 0 01.5-.5z" fill="#6cc644" opacity="0.6"/>
        <path d="M9 1v4h4" fill="none" stroke="#6cc644" strokeWidth="1" opacity="0.6"/>
      </svg>
      <span className="dft-name" title={node.fullPath}>{node.name}</span>
      {fileStats && (
        <span className="dft-file-stats">
          <span className="dft-stat-add">+{fileStats.add}</span>
          <span className="dft-stat-del">-{fileStats.del}</span>
        </span>
      )}
      <div className="dft-file-actions">
        {commitOid && onViewDiff && (
          <button
            className="dft-action-btn"
            title="查看 Diff"
            onClick={e => { e.stopPropagation(); onViewDiff(commitOid, node.fullPath); }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </button>
        )}
        {onViewHistory && (
          <button
            className="dft-action-btn"
            title="文件历史"
            onClick={e => { e.stopPropagation(); onViewHistory(node.fullPath); }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function countFiles(node: TreeNode): number {
  if (!node.isDir) return 1;
  let count = 0;
  for (const child of node.children.values()) {
    count += countFiles(child);
  }
  return count;
}

export default function DiffFileTree({
  files,
  selectedFile,
  onFileSelect,
  onViewDiff,
  onViewHistory,
  commitOid,
}: DiffFileTreeProps) {
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree');

  const filteredFiles = useMemo(() => {
    if (!filter) return files;
    const q = filter.toLowerCase();
    return files.filter(f => f.path.toLowerCase().includes(q));
  }, [files, filter]);

  const tree = useMemo(() => buildTree(filteredFiles), [filteredFiles]);

  // Stats
  const totalAdd = files.reduce((s, f) => s + f.additions, 0);
  const totalDel = files.reduce((s, f) => s + f.deletions, 0);

  const handleExpandAll = useCallback(() => {
    // Force re-render with expanded state
    setViewMode('flat');
    setTimeout(() => setViewMode('tree'), 0);
  }, []);

  if (files.length === 0) {
    return (
      <div className="dft-empty">
        <p>无文件变更</p>
      </div>
    );
  }

  return (
    <div className="dft-container">
      {/* Header */}
      <div className="dft-header">
        <div className="dft-header-left">
          <span className="dft-title">文件变更</span>
          <span className="dft-badge">{files.length}</span>
          <span className="dft-stats-total">
            <span className="dft-stat-add">+{totalAdd}</span>
            <span className="dft-stat-del">-{totalDel}</span>
          </span>
        </div>
        <div className="dft-header-right">
          <button
            className={`dft-mode-btn ${viewMode === 'tree' ? 'active' : ''}`}
            onClick={() => setViewMode('tree')}
            title="树形视图"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>
            </svg>
          </button>
          <button
            className={`dft-mode-btn ${viewMode === 'flat' ? 'active' : ''}`}
            onClick={() => setViewMode('flat')}
            title="平铺视图"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="dft-filter">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dft-filter-icon">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          className="dft-filter-input"
          placeholder="过滤文件..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        {filter && (
          <button className="dft-filter-clear" onClick={() => setFilter('')}>✕</button>
        )}
      </div>

      {/* Content */}
      <div className="dft-content">
        {viewMode === 'tree' ? (
          Array.from(tree.children.values())
            .sort((a, b) => {
              if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map(node => (
              <TreeNodeItem
                key={node.fullPath}
                node={node}
                depth={0}
                selectedFile={selectedFile}
                onFileSelect={onFileSelect}
                onViewDiff={onViewDiff}
                onViewHistory={onViewHistory}
                commitOid={commitOid}
                defaultExpanded={(depth: number) => depth < 1}
              />
            ))
        ) : (
          // Flat view
          filteredFiles.map(file => {
            const status = STATUS_ICONS[file.status];
            const isSelected = selectedFile === file.path;
            return (
              <div
                key={file.path}
                className={`dft-file ${isSelected ? 'dft-file-selected' : ''}`}
                onClick={() => onFileSelect(file.path)}
              >
                {status && (
                  <span className="dft-status-badge" style={{ color: status.color }}>
                    {status.label}
                  </span>
                )}
                <span className="dft-name" title={file.path}>{file.path}</span>
                <span className="dft-file-stats">
                  <span className="dft-stat-add">+{file.additions}</span>
                  <span className="dft-stat-del">-{file.deletions}</span>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
