/**
 * 提交详情面板组件 - Fork 风格完全复刻
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { CommitDetail as CommitDetailType, GitDiff, GitDiffHunk, GitDiffLine } from '@shared/types/git';
import { useI18, formatDate } from '../../i18n';
import { useContextMenu, type MenuItem } from '../contextmenu/ContextMenu';
import { useRepoStore } from '../../stores/repoStore';

interface CommitDetailPanelProps {
  detail: CommitDetailType | null;
  isExpanded: boolean;
  onToggle: () => void;
  onViewFileDiff?: (oid: string, filePath: string) => void;
  onViewFileHistory?: (filePath: string) => void;
}

// Diff 缓存，用于存储已加载的 diff 数据
const diffCache: Map<string, GitDiff[]> = new Map();

// 将 GitDiff 转换为组件使用的格式
function convertGitDiffToLines(diff: GitDiff[]): Array<{
  oldLine?: number;
  newLine?: number;
  type: 'add' | 'remove' | 'keep' | 'header';
  content: string;
}> {
  const lines: Array<{
    oldLine?: number;
    newLine?: number;
    type: 'add' | 'remove' | 'keep' | 'header';
    content: string;
  }> = [];

  for (const fileDiff of diff) {
    // 添加文件头部
    lines.push({
      type: 'header',
      content: `diff --git a/${fileDiff.oldPath || fileDiff.newPath} b/${fileDiff.newPath || fileDiff.oldPath}`,
    });

    if (fileDiff.type === 'binary') {
      lines.push({ type: 'header', content: 'Binary files differ' });
      continue;
    }

    if (fileDiff.type === 'renamed') {
      lines.push({ type: 'header', content: `rename from ${fileDiff.oldPath}` });
      lines.push({ type: 'header', content: `rename to ${fileDiff.newPath}` });
    }

    if (fileDiff.type === 'deleted') {
      lines.push({ type: 'header', content: `deleted file mode ${fileDiff.oldMode || ''}` });
    }

    if (fileDiff.type === 'untracked') {
      lines.push({ type: 'header', content: `untracked file: ${fileDiff.newPath}` });
    }

    // 添加 hunks
    for (const hunk of fileDiff.hunks) {
      lines.push({
        type: 'header',
        content: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
      });

      for (const line of hunk.lines) {
        const lineType = line.type === 'add' ? 'add' : line.type === 'delete' ? 'remove' : 'keep';
        lines.push({
          oldLine: line.oldLineNumber,
          newLine: line.newLineNumber,
          type: lineType,
          content: line.content,
        });
      }
    }
  }

  return lines;
}

// 获取文件的 diff 数据 - 从实际 git 仓库读取
export const getFileDiff = async (oid: string, filePath?: string): Promise<Array<{
  oldLine?: number;
  newLine?: number;
  type: 'add' | 'remove' | 'keep' | 'header';
  content: string;
}> | null> => {
  try {
    // 构建缓存 key
    const cacheKey = `${oid}:${filePath || 'all'}`;
    
    // 检查缓存
    if (diffCache.has(cacheKey)) {
      return convertGitDiffToLines(diffCache.get(cacheKey)!);
    }

    // 调用真正的 git 命令
    const diff = await window.electronAPI.git.getFileDiff(oid, filePath);
    
    if (!diff || diff.length === 0) {
      return null;
    }

    // 缓存结果
    diffCache.set(cacheKey, diff);
    
    return convertGitDiffToLines(diff);
  } catch (error) {
    console.error('获取文件 diff 失败:', error);
    return null;
  }
};

const STATUS_COLORS = {
  added: '#e2a855',
  modified: '#6cc644',
  deleted: '#e85d75',
  renamed: '#5799da',
  copied: '#5799da',
  unchanged: '#888888',
};

const STATUS_LABELS = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  unchanged: '-',
};

function FileRow({
  file,
  isExpanded,
  onToggle,
  commitOid,
}: {
  file: { path: string; status: string; additions: number; deletions: number };
  isExpanded: boolean;
  onToggle: (path: string) => void;
  commitOid?: string;
}) {
  const [diffLines, setDiffLines] = useState<Array<{
    oldLine?: number;
    newLine?: number;
    type: 'add' | 'remove' | 'keep' | 'header';
    content: string;
  }> | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const hasChanges = file.additions > 0 || file.deletions > 0;

  // 加载 diff 数据
  useEffect(() => {
    if (isExpanded && hasChanges && commitOid && !diffLines) {
      setIsLoadingDiff(true);
      getFileDiff(commitOid, file.path).then((data) => {
        setDiffLines(data);
        setIsLoadingDiff(false);
      });
    }
  }, [isExpanded, hasChanges, commitOid, file.path, diffLines]);

  const { showContextMenu, ContextMenuWrapper } = useContextMenu(() => {
    const repoPath = useRepoStore.getState().currentRepo?.path || '';
    const absPath = `${repoPath}/${file.path}`;
    const fileName = file.path.split('/').pop() || file.path;
    const items: MenuItem[] = [
      { id: 'open', label: 'Open', shortcut: 'Ctrl+Shift+Alt+O', onClick: () => window.electronAPI.shell.openPath(absPath) },
      { id: 'diff-vscode', label: 'Diff in VS Code', shortcut: 'Ctrl+D', onClick: () => {
        if (commitOid) window.electronAPI.shell.openExternal(`vscode://file/${absPath}`);
      } },
      { id: 'show-in-explorer', label: 'Show in File Explorer', onClick: () => window.electronAPI.shell.showItemInFolder(absPath) },
      { id: 'divider-1', label: '', divider: true },
      { id: 'reset-file', label: 'Reset File to', children: [
        { id: 'reset-at-commit', label: 'State At Commit...', onClick: async () => {
          if (commitOid) { try { await window.electronAPI.git.checkout(`${commitOid} -- ${file.path}`); } catch (e: any) { alert('重置失败: ' + e.message); } }
        } },
        { id: 'reset-before-commit', label: 'State Before Commit...', onClick: async () => {
          if (commitOid) { try { await window.electronAPI.git.checkout(`${commitOid}~1 -- ${file.path}`); } catch (e: any) { alert('重置失败: ' + e.message); } }
        } },
      ]},
      { id: 'divider-2', label: '', divider: true },
      { id: 'blame', label: 'Blame/Timeline...', onClick: () => window.dispatchEvent(new CustomEvent('showBlame', { detail: file.path })) },
      { id: 'history', label: 'History...', onClick: () => window.dispatchEvent(new CustomEvent('showBlame', { detail: file.path })) },
      { id: 'show-in-tree', label: 'Show in File Tree', onClick: () => window.electronAPI.shell.showItemInFolder(absPath) },
      { id: 'divider-3', label: '', divider: true },
      { id: 'save-as', label: 'Save as...', onClick: async () => {
        if (!commitOid) return;
        const savePath = await window.electronAPI.fs.showSaveDialog({ defaultPath: fileName });
        if (!savePath) return;
        try {
          const content = await window.electronAPI.git.getFileContent(file.path, commitOid);
          await window.electronAPI.fs.writeFile(savePath, content || '');
        } catch (e: any) { alert('保存失败: ' + e.message); }
      } },
      { id: 'divider-4', label: '', divider: true },
      { id: 'copy-path', label: 'Copy Path', shortcut: 'Ctrl+C', onClick: () => navigator.clipboard.writeText(file.path) },
      { id: 'copy-full-path', label: 'Copy Full Path', shortcut: 'Ctrl+Shift+C', onClick: () => navigator.clipboard.writeText(absPath) },
    ];
    return items;
  });

  return (
    <div key={file.path}>
      {/* 文件行 */}
      <div
        onClick={() => hasChanges && onToggle(file.path)}
        onContextMenu={showContextMenu}
        className={`flex items-center gap-2 px-4 py-1.5 hover:bg-[#2a2d2e] transition-colors ${hasChanges ? 'cursor-pointer' : ''}`}
      >
        {/* 展开图标 */}
        {hasChanges && (
          <svg className={`w-3 h-3 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
        {!hasChanges && <span className="w-3" />}
        
        {/* 文件状态图标 */}
        <div className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-medium text-white" style={{ backgroundColor: STATUS_COLORS[file.status as keyof typeof STATUS_COLORS] }}>
          {STATUS_LABELS[file.status as keyof typeof STATUS_LABELS]}
        </div>
        
        {/* 文件名 */}
        <span className="flex-1 text-xs text-gray-300 truncate">{file.path}</span>
        
        {/* 变更统计 - Fork 格式: -x,y +x,y */}
        <span className="text-xs text-gray-500 font-mono">
          {file.deletions > 0 && `-${file.deletions},${file.additions}`}
          {file.additions > 0 && !file.deletions && `+${file.additions}`}
          {file.deletions === 0 && file.additions === 0 && ''}
        </span>
      </div>
      
      {/* 展开的 Diff 内容 - 只有当有内容时才显示 */}
      {isExpanded && hasChanges && (
        <div className="bg-[#1a1a1a] border-l-2 border-[#3c3c3c]">
          {/* Diff 头部 */}
          <div className="px-4 py-1.5 bg-[#252526] border-b border-[#3c3c3c]">
            <span className="text-xs text-gray-500 font-mono">diff --git a/{file.path} b/{file.path}</span>
          </div>
          {/* Diff 内容 */}
          {isLoadingDiff ? (
            <div className="px-4 py-2 text-xs text-gray-500">加载中...</div>
          ) : diffLines && diffLines.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <tbody>
                  {diffLines.map((line, index) => (
                    <tr key={index} className={line.type === 'header' ? 'bg-[#252526]' : ''}>
                      {/* 旧行号 */}
                      <td className="w-12 px-2 text-right select-none" style={{ backgroundColor: line.type === 'remove' ? '#4a1a1a' : line.type === 'add' ? '#1a3a1a' : 'transparent', color: '#8b949e' }}>
                        {line.oldLine || ''}
                      </td>
                      {/* 新行号 */}
                      <td className="w-12 px-2 text-right select-none" style={{ backgroundColor: line.type === 'add' ? '#1a3a1a' : line.type === 'remove' ? '#4a1a1a' : 'transparent', color: '#8b949e' }}>
                        {line.newLine || ''}
                      </td>
                      {/* 内容 */}
                      <td className="flex-1 px-2" style={{ 
                        backgroundColor: line.type === 'add' ? '#1a3a1a' : line.type === 'remove' ? '#4a1a1a' : 'transparent',
                        color: line.type === 'header' ? '#8b949e' : line.type === 'add' ? '#9ece6a' : line.type === 'remove' ? '#f778ba' : '#c9d1d9'
                      }}>
                        <span className={line.type === 'add' ? 'text-green-500' : line.type === 'remove' ? 'text-red-500' : ''}>
                          {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : line.type === 'header' ? '' : ' '}
                        </span>
                        {line.content}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-2 text-xs text-gray-500">没有可显示的差异</div>
          )}
        </div>
      )}
      
      {ContextMenuWrapper}
    </div>
  );
}

function CommitDetailPanel({ detail, isExpanded, onToggle }: CommitDetailPanelProps) {
  const { t } = useI18();
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [showAllFiles, setShowAllFiles] = useState(false);

  // 当提交切换时，重置展开状态
  useEffect(() => {
    setExpandedFiles(new Set());
    setShowAllFiles(false);
  }, [detail]);

  if (!detail) {
    return null;
  }

  const { commit, files } = detail;

  const stats = {
    additions: files.reduce((sum, f) => sum + f.additions, 0),
    deletions: files.reduce((sum, f) => sum + f.deletions, 0),
  };

  const toggleFile = (path: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const toggleAllFiles = () => {
    setShowAllFiles(!showAllFiles);
  };

  // 分割提交消息（主消息和详细消息）
  const [subject, ...bodyLines] = commit.fullMessage.split('\n');
  const body = bodyLines.join('\n').trim();

  return (
    <div className={`bg-[#1e1e1e] transition-all duration-300 flex flex-col overflow-hidden ${isExpanded ? 'flex-1 min-h-0' : 'max-h-[40px] flex-shrink-0'}`}>
      {/* 折叠头部 */}
      <div onClick={onToggle} className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-[#2a2d2e] transition-colors border-b border-[#2d2d30]">
        <div className="flex items-center gap-3">
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-medium text-gray-200">{t('commitDetail.title')}</span>
          <span className="text-xs text-gray-500 font-mono">{commit.shortOid}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#6cc644]">+{stats.additions}</span>
            <span className="text-[#e85d75]">-{stats.deletions}</span>
          </div>
          <span className="text-xs text-gray-500">{files.length} {t('commitDetail.filesChanged')}</span>
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* AUTHOR 区域 */}
          <div className="px-4 py-3 border-b border-[#2d2d30]">
            <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Author</div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium text-white" style={{ backgroundColor: getAvatarColor(commit.authorEmail) }}>
                {commit.authorName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-200">{commit.authorName}</span>
                  <span className="text-xs text-gray-500">{commit.authorEmail}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{formatDate(commit.authorTimestamp)}</div>
              </div>
            </div>
          </div>

          {/* 提交信息区域 */}
          <div className="px-4 py-3 border-b border-[#2d2d30]">
            {/* REFS */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-500 w-16">REFS</span>
              <span className="text-xs text-gray-300 font-mono bg-[#2d2d30] px-1.5 py-0.5 rounded">{commit.branch || 'master'}</span>
            </div>
            
            {/* SHA */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-500 w-16">SHA</span>
              <span className="text-xs text-[#5799da] font-mono">{commit.oid}</span>
            </div>
            
            {/* PARENTS - 支持多个 */}
            {commit.parentIds.map((parentId, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-16">PARENTS</span>
                <span className="text-xs text-[#5799da] font-mono">{parentId}</span>
              </div>
            ))}
          </div>

          {/* 提交消息 */}
          <div className="px-4 py-3 border-b border-[#2d2d30]">
            {/* 主消息 */}
            <div className="text-sm text-gray-200">{subject}</div>
            {/* 详细消息 */}
            {body && (
              <div className="text-xs text-gray-400 mt-2 whitespace-pre-wrap">{body}</div>
            )}
          </div>

          {/* 文件列表 */}
          <div className="border-b border-[#2d2d30]">
            {/* 文件列表头部 */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#252526]">
              <span className="text-xs text-gray-500">{files.length} {t('commitDetail.filesChanged')}</span>
              <button onClick={toggleAllFiles} className="text-xs text-[#5799da] hover:underline">
                {showAllFiles ? 'Collapse All' : 'Expand All'}
              </button>
            </div>

            {/* 文件列表内容 */}
            <div>
              {files.map((file, index) => (
                <FileRow
                  key={file.path || index}
                  file={file}
                  isExpanded={showAllFiles || expandedFiles.has(file.path)}
                  onToggle={toggleFile}
                  commitOid={commit.oid}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getAvatarColor(email: string): string {
  const colors = ['#5799da', '#7dce82', '#e2a855', '#b47ccf', '#52c4e8', '#e85d75', '#72d6c9', '#f0c674'];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default CommitDetailPanel;