import React, { useState, useEffect, useMemo } from 'react';

interface FileNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  children?: Map<string, FileNode>;
}

interface RepositoryFileTreeProps {
  files?: string[];
  selectedFile?: string | null;
  onFileSelect?: (path: string) => void;
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

function TreeNode({ node, depth = 0, selectedFile, onFileSelect }: { node: FileNode; depth?: number; selectedFile?: string | null; onFileSelect?: (path: string) => void }) {
  const [expanded, setExpanded] = useState(node.isDir);

  if (node.isDir) {
    const childCount = node.children ? node.children.size : 0;
    const sortedChildren = node.children ? Array.from(node.children.values()).sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    }) : [];

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
        {expanded && sortedChildren.map(child => (
          <TreeNode key={child.fullPath} node={child} depth={depth + 1} selectedFile={selectedFile} onFileSelect={onFileSelect} />
        ))}
      </div>
    );
  }

  const isSelected = selectedFile === node.fullPath;
  const iconColor = getFileIconColor(node.name);

  return (
    <div
      className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer transition-colors ${
        isSelected ? 'bg-[#3c3c3c] text-white' : 'hover:bg-[#2a2d2e] text-gray-300'
      }`}
      style={{ paddingLeft: depth * 12 + 8 }}
      onClick={() => onFileSelect?.(node.fullPath)}
    >
      <span className="w-3" />
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
        <path d="M3 1h6l4 4v9.5a.5.5 0 01-.5.5h-9a.5.5 0 01-.5-.5v-13a.5.5 0 01.5-.5z" fill={isSelected ? '#fff' : iconColor} opacity={isSelected ? 1 : 0.6} />
        <path d="M9 1v4h4" fill="none" stroke={isSelected ? '#fff' : iconColor} strokeWidth="1" opacity={isSelected ? 1 : 0.6} />
      </svg>
      <span className="text-xs flex-1 truncate">{node.name}</span>
    </div>
  );
}

function buildTree(filePaths: string[]): FileNode {
  const root: FileNode = { name: '/', fullPath: '/', isDir: true, children: new Map() };

  filePaths.forEach(path => {
    const parts = path.split('/');
    let current = root;

    parts.forEach((part, index) => {
      const isDir = index < parts.length - 1;
      const childPath = parts.slice(0, index + 1).join('/');

      if (!current.children?.has(part)) {
        current.children?.set(part, {
          name: part,
          fullPath: childPath,
          isDir,
          children: isDir ? new Map() : undefined,
        });
      }

      const child = current.children?.get(part);
      if (child) {
        current = child;
      }
    });
  });

  return root;
}

export default function RepositoryFileTree({ files, selectedFile, onFileSelect }: RepositoryFileTreeProps) {
  const [repoFiles, setRepoFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!files) {
      setIsLoading(true);
      window.electronAPI.git.listFiles('HEAD').then(files => {
        setRepoFiles(files);
        setIsLoading(false);
      }).catch(err => {
        console.error('获取文件列表失败:', err);
        setIsLoading(false);
      });
    }
  }, [files]);

  const fileList = files || repoFiles;
  const tree = useMemo(() => buildTree(fileList), [fileList]);

  const rootChildren = tree.children ? Array.from(tree.children.values()).sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  }) : [];

  if (isLoading) {
    return (
      <div className="py-1 flex items-center justify-center">
        <span className="text-xs text-gray-500">加载中...</span>
      </div>
    );
  }

  return (
    <div className="py-1">
      {rootChildren.length > 0 ? (
        rootChildren.map(node => (
          <TreeNode key={node.fullPath} node={node} depth={0} selectedFile={selectedFile} onFileSelect={onFileSelect} />
        ))
      ) : (
        <div className="py-4 px-2 text-xs text-gray-500">
          暂无文件
        </div>
      )}
    </div>
  );
}