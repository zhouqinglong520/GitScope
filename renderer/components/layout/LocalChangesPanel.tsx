/**
 * 本地仓库变更面板 - Fork 风格
 * 显示未跟踪文件和已暂存文件，以及提交信息输入
 */

import React, { useState } from 'react';

interface FileItem {
  path: string;
  status: 'untracked' | 'modified' | 'deleted' | 'added';
}

// Mock 数据
const MOCK_UNTRACKED_FILES: FileItem[] = [
  { path: 'src/components/layout/NewComponent.tsx', status: 'untracked' },
  { path: 'src/utils/helpers.ts', status: 'untracked' },
];

const MOCK_STAGED_FILES: FileItem[] = [
  { path: 'src/components/layout/MainLayout.tsx', status: 'modified' },
  { path: 'src/components/commitdetail/CommitDetailPanel.tsx', status: 'modified' },
  { path: 'src/components/changes/ChangesFileTree.tsx', status: 'added' },
];

function FileRow({ file, onStage, onUnstage, isStaged }: { file: FileItem; onStage?: () => void; onUnstage?: () => void; isStaged: boolean }) {
  const getStatusIcon = () => {
    switch (file.status) {
      case 'untracked':
        return <span className="w-3 h-3 rounded bg-[#e2a855]" />;
      case 'modified':
        return <span className="w-3 h-3 rounded bg-[#6cc644]" />;
      case 'deleted':
        return <span className="w-3 h-3 rounded bg-[#e85d75]" />;
      case 'added':
        return <span className="w-3 h-3 rounded bg-[#6cc644]" />;
      default:
        return null;
    }
  };

  const getStatusLabel = () => {
    switch (file.status) {
      case 'untracked': return '未跟踪';
      case 'modified': return '已修改';
      case 'deleted': return '已删除';
      case 'added': return '已添加';
      default: return '';
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#2a2d2e] cursor-pointer">
      {getStatusIcon()}
      <span className="text-xs text-gray-400 w-16">{getStatusLabel()}</span>
      <span className="flex-1 text-xs text-gray-300 truncate">{file.path}</span>
      {isStaged ? (
        <button 
          className="text-xs text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded hover:bg-[#3c3c3c]"
          onClick={onUnstage}
        >
          Unstage
        </button>
      ) : (
        <button 
          className="text-xs text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded hover:bg-[#3c3c3c]"
          onClick={onStage}
        >
          Stage
        </button>
      )}
    </div>
  );
}

export default function LocalChangesPanel() {
  const [untrackedFiles, setUntrackedFiles] = useState<FileItem[]>(MOCK_UNTRACKED_FILES);
  const [stagedFiles, setStagedFiles] = useState<FileItem[]>(MOCK_STAGED_FILES);
  const [commitMessage, setCommitMessage] = useState('');

  const handleStage = (file: FileItem) => {
    setUntrackedFiles(prev => prev.filter(f => f.path !== file.path));
    setStagedFiles(prev => [...prev, { ...file, status: 'added' as const }]);
  };

  const handleUnstage = (file: FileItem) => {
    setStagedFiles(prev => prev.filter(f => f.path !== file.path));
    setUntrackedFiles(prev => [...prev, { ...file, status: 'modified' as const }]);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
      {/* Untracked 区域 */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="bg-[#252526] border-b border-[#3c3c3c] px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-300">Untracked</span>
          <button className="text-xs text-gray-500 hover:text-gray-300">
            Stage All
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {untrackedFiles.length > 0 ? (
            untrackedFiles.map(file => (
              <FileRow 
                key={file.path} 
                file={file} 
                onStage={() => handleStage(file)}
                isStaged={false}
              />
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 text-xs">
              没有未跟踪的文件
            </div>
          )}
        </div>
      </div>

      {/* Staged 区域 */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-[#3c3c3c]">
        <div className="bg-[#252526] border-b border-[#3c3c3c] px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-300">Staged</span>
          <button className="text-xs text-gray-500 hover:text-gray-300">
            Unstage All
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {stagedFiles.length > 0 ? (
            stagedFiles.map(file => (
              <FileRow 
                key={file.path} 
                file={file} 
                onUnstage={() => handleUnstage(file)}
                isStaged={true}
              />
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 text-xs">
              没有已暂存的文件
            </div>
          )}
        </div>
      </div>

      {/* 提交信息区域 */}
      <div className="bg-[#252526] border-t border-[#3c3c3c]">
        {/* 暂存统计 */}
        {stagedFiles.length > 0 && (
          <div className="px-4 py-1.5 text-xs text-gray-400 bg-[#1e1e1e] border-b border-[#3c3c3c]">
            <span className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {stagedFiles.length} 个文件已暂存
            </span>
          </div>
        )}
        
        {/* 输入区域 */}
        <div className="flex items-stretch">
          <div className="flex-1 px-4 py-3">
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder={stagedFiles.length > 0 ? 'Commit subject' : '输入提交信息... (需先暂存文件)'}
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:border-primary-500"
              disabled={stagedFiles.length === 0}
            />
            <textarea
              value=""
              placeholder="Description (optional)"
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] border-t-0 rounded-b px-3 py-2 text-sm text-white placeholder:text-gray-500 resize-none outline-none focus:border-primary-500"
              rows={2}
              style={{ minHeight: '40px' }}
              disabled={stagedFiles.length === 0}
            />
          </div>
          <div className="flex flex-col justify-end py-3 pr-3">
            <button 
              className={`px-4 py-2 text-sm rounded transition-colors ${
                stagedFiles.length > 0 
                  ? 'bg-[#3794ff] text-white hover:bg-[#4a9eff]' 
                  : 'bg-[#3c3c3c] text-gray-500 cursor-not-allowed'
              }`}
              disabled={stagedFiles.length === 0}
            >
              Commit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
