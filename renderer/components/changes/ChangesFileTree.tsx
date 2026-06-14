/**
 * Changes 文件树组件 - Fork 风格
 * 在 Changes 标签页中以树形结构展示提交的文件变更
 */

import React, { useState, useMemo } from 'react';
import type { FileChange } from '@shared/types/git';

const STATUS_COLORS: Record<string, string> = {
  added: '#e2a855',
  modified: '#6cc644',
  deleted: '#e85d75',
  renamed: '#5799da',
  copied: '#5799da',
  unchanged: '#888888',
};

const STATUS_LABELS: Record<string, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  unchanged: '-',
};

interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  children: Map<string, TreeNode>;
  file?: FileChange;
}

interface ChangesFileTreeProps {
  files: FileChange[];
  selectedFile?: string | null;
  onFileSelect: (path: string) => void;
}

function buildTree(files: FileChange[]): TreeNode {
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
        });
      }
      current = current.children.get(part)!;
    }
  }
  return root;
}

function getFileIconColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'ts' || ext === 'tsx') return '#519aba';
  if (ext === 'js' || ext === 'jsx') return '#f1e05a';
  if (ext === 'json') return '#89ca78';
  if (ext === 'html') return '#e34c26';
  if (ext === 'css') return '#563d7c';
  if (ext === 'md') return '#4271ae';
  if (ext === 'yml' || ext === 'yaml') return '#cb171e';
  if (ext === 'vue') return '#42b883';
  return '#6cc644';
}

function TreeNodeItem({
  node,
  depth,
  selectedFile,
  onFileSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedFile?: string | null;
  onFileSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  if (node.isDir) {
    const childCount = countFiles(node);
    const sorted = Array.from(node.children.values()).sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <div>
        <div
          className="flex items-center gap-1 px-2 py-0.5 cursor-pointer hover:bg-[#2a2d2e] text-gray-300"
          style={{ paddingLeft: depth * 12 + 8 }}
          onClick={() => setExpanded(!expanded)}
        >
          <svg
            className={`w-3 h-3 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-3.5 h-3.5 text-[#dcb67a]" fill="currentColor" viewBox="0 0 16 16">
            <path d="M1.5 1h5l1 2H14.5a.5.5 0 01.5.5v10a.5.5 0 01-.5.5h-13a.5.5 0 01-.5-.5v-12a.5.5 0 01.5-.5z" />
          </svg>
          <span className="text-xs flex-1">{node.name}</span>
          <span className="text-xs text-gray-500">{childCount}</span>
        </div>
        {expanded && sorted.map(child => (
          <TreeNodeItem
            key={child.fullPath}
            node={child}
            depth={depth + 1}
            selectedFile={selectedFile}
            onFileSelect={onFileSelect}
          />
        ))}
      </div>
    );
  }

  const status = node.file ? STATUS_COLORS[node.file.status] : null;
  const statusLabel = node.file ? STATUS_LABELS[node.file.status] : null;
  const isSelected = selectedFile === node.fullPath;
  const fileStats = node.file ? { add: node.file.additions, del: node.file.deletions } : null;
  const iconColor = getFileIconColor(node.name);

  return (
    <div
      className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer transition-colors ${
        isSelected ? 'bg-[#3c3c3c] text-white' : 'hover:bg-[#2a2d2e] text-gray-300'
      }`}
      style={{ paddingLeft: depth * 12 + 8 }}
      onClick={() => onFileSelect(node.fullPath)}
    >
      <span className="w-3" />
      {status && (
        <span
          className="w-3 h-3 rounded-sm flex items-center justify-center text-[9px] font-medium text-white"
          style={{ backgroundColor: status }}
        >
          {statusLabel}
        </span>
      )}
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
        <path
          d="M3 1h6l4 4v9.5a.5.5 0 01-.5.5h-9a.5.5 0 01-.5-.5v-13a.5.5 0 01.5-.5z"
          fill={isSelected ? '#fff' : iconColor}
          opacity={isSelected ? 1 : 0.6}
        />
        <path
          d="M9 1v4h4"
          fill="none"
          stroke={isSelected ? '#fff' : iconColor}
          strokeWidth="1"
          opacity={isSelected ? 1 : 0.6}
        />
      </svg>
      <span className="text-xs flex-1 truncate">{node.name}</span>
      {fileStats && (
        <span className="text-xs font-mono">
          {fileStats.add > 0 && <span className={isSelected ? 'text-white' : 'text-[#6cc644]'}>+{fileStats.add}</span>}
          {fileStats.del > 0 && (
            <span className={isSelected ? 'text-white' : 'text-[#e85d75]'}>
              {fileStats.add > 0 && ' '}
              -{fileStats.del}
            </span>
          )}
        </span>
      )}
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

export default function ChangesFileTree({ files, selectedFile, onFileSelect }: ChangesFileTreeProps) {
  const tree = useMemo(() => buildTree(files || []), [files]);
  
  if (!files || files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-xs p-4">
        无文件变更
      </div>
    );
  }

  const rootChildren = Array.from(tree.children.values())
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="py-1">
      {rootChildren.map(node => (
        <TreeNodeItem
          key={node.fullPath}
          node={node}
          depth={0}
          selectedFile={selectedFile}
          onFileSelect={onFileSelect}
        />
      ))}
    </div>
  );
}
