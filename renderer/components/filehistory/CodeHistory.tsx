/**
 * 选中代码的历史组件
 * Fork 标志性功能：选中几行代码 → 追踪这些代码的变更历史
 * 
 * 实现方式：
 * 1. 在 Blame/Diff 视图中选中行范围
 * 2. 使用 git log -L start,end:file 追踪行范围的历史
 * 3. 或使用 git log -S "code snippet" (pickaxe) 搜索代码出现/消失的提交
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18 } from '../../i18n';
import type { GitCommit } from '@shared/types/git';

// ========== 类型 ==========

interface CodeHistoryEntry {
  oid: string;
  shortOid: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authorTimestamp: number;
  /** 变更类型：added / removed / modified */
  changeType: 'added' | 'removed' | 'modified';
  /** 变更的 diff 片段 */
  diffSnippet: string;
}

interface CodeHistoryProps {
  filePath: string;
  /** 选中行范围 */
  lineRange: { start: number; end: number } | null;
  /** 选中代码片段（用于 pickaxe 搜索） */
  selectedCode: string | null;
  onClose: () => void;
  onViewCommit?: (oid: string) => void;
}

// ========== 主组件 ==========

function CodeHistory({
  filePath,
  lineRange,
  selectedCode,
  onClose,
  onViewCommit,
}: CodeHistoryProps) {
  const { t } = useI18();
  const [entries, setEntries] = useState<CodeHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'line-range' | 'pickaxe'>('line-range');
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);

  // 加载代码历史
  useEffect(() => {
    if (!filePath) return;
    
    const loadHistory = async () => {
      setLoading(true);
      setEntries([]);
      
      try {
        let result: CodeHistoryEntry[] = [];
        
        if (searchMode === 'line-range' && lineRange) {
          // 使用 git log -L 追踪行范围
          result = await window.electronAPI.git.getCodeHistory({
            filePath,
            startLine: lineRange.start,
            endLine: lineRange.end,
            mode: 'line-range',
          });
        } else if (searchMode === 'pickaxe' && selectedCode) {
          // 使用 git log -S 搜索代码片段
          result = await window.electronAPI.git.getCodeHistory({
            filePath,
            codeSnippet: selectedCode,
            mode: 'pickaxe',
          });
        }
        
        setEntries(result || []);
      } catch (error) {
        console.error('加载代码历史失败:', error);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadHistory();
  }, [filePath, lineRange, selectedCode, searchMode]);

  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`;
    return `${Math.floor(diff / 2592000)}个月前`;
  };

  const getAvatarColor = (email: string): string => {
    const colors = ['#5799da', '#7dce82', '#e2a855', '#b47ccf', '#52c4e8', '#e85d75', '#72d6c9', '#f0c674'];
    let hash = 0;
    for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const changeTypeConfig = {
    added: { color: 'text-green-400', bg: 'bg-green-900/20', label: 'A', desc: '添加' },
    removed: { color: 'text-red-400', bg: 'bg-red-900/20', label: 'D', desc: '删除' },
    modified: { color: 'text-yellow-400', bg: 'bg-yellow-900/20', label: 'M', desc: '修改' },
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-2xl w-[900px] max-h-[700px] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c]">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span className="text-sm font-medium text-gray-200">选中代码的历史</span>
            <span className="text-xs text-gray-500 font-mono truncate max-w-[300px]">{filePath}</span>
            {lineRange && (
              <span className="text-xs text-blue-400">L{lineRange.start}-{lineRange.end}</span>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#3c3c3c]">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 搜索模式切换 */}
        <div className="flex items-center gap-3 px-4 py-2 bg-[#2d2d30] border-b border-[#3c3c3c]">
          <div className="flex rounded overflow-hidden border border-[#3c3c3c]">
            <button
              className={`px-3 py-1 text-xs ${searchMode === 'line-range' ? 'bg-blue-600 text-white' : 'bg-[#3c3c3c] text-gray-300'}`}
              onClick={() => setSearchMode('line-range')}
              disabled={!lineRange}
            >
              📍 行范围追踪 (git log -L)
            </button>
            <button
              className={`px-3 py-1 text-xs ${searchMode === 'pickaxe' ? 'bg-blue-600 text-white' : 'bg-[#3c3c3c] text-gray-300'}`}
              onClick={() => setSearchMode('pickaxe')}
              disabled={!selectedCode}
            >
              🔍 Pickaxe 搜索 (git log -S)
            </button>
          </div>

          {selectedCode && (
            <div className="flex-1 text-xs text-gray-400 truncate">
              搜索: <code className="text-yellow-400 bg-[#1e1e1e] px-1 rounded">{selectedCode.substring(0, 50)}{selectedCode.length > 50 ? '...' : ''}</code>
            </div>
          )}
        </div>

        {/* 结果列表 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm">搜索中...</div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
              {lineRange || selectedCode ? '未找到相关历史记录' : '请在代码中选择行或代码片段'}
            </div>
          ) : (
            <div className="divide-y divide-[#2a2a2a]">
              {entries.map((entry) => {
                const isSelected = selectedEntry === entry.oid;
                const config = changeTypeConfig[entry.changeType];
                
                return (
                  <div
                    key={entry.oid}
                    className={`px-4 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-[#094771]' : 'hover:bg-[#2a2d2e]'}`}
                    onClick={() => setSelectedEntry(isSelected ? null : entry.oid)}
                    onDoubleClick={() => onViewCommit?.(entry.oid)}
                  >
                    <div className="flex items-center gap-3">
                      {/* 变更类型标记 */}
                      <span className={`text-xs font-mono font-bold ${config.color} w-4 text-center`}>
                        {config.label}
                      </span>

                      {/* SHA */}
                      <span className="font-mono text-xs text-[#5799da] flex-shrink-0">
                        {entry.shortOid}
                      </span>

                      {/* 提交消息 */}
                      <span className="flex-1 text-sm text-gray-200 truncate">
                        {entry.message}
                      </span>

                      {/* 作者 */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium"
                          style={{ backgroundColor: getAvatarColor(entry.authorEmail) }}
                        >
                          {entry.authorName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-gray-400">{entry.authorName}</span>
                      </div>

                      {/* 时间 */}
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {formatRelativeTime(entry.authorTimestamp)}
                      </span>
                    </div>

                    {/* 展开的 diff 片段 */}
                    {isSelected && entry.diffSnippet && (
                      <div className="mt-2 ml-7 bg-[#1e1e1e] rounded p-2 max-h-[150px] overflow-auto">
                        <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">{entry.diffSnippet}</pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-4 py-3 border-t border-[#3c3c3c] flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {entries.length > 0 ? `${entries.length} 条历史记录` : ''}
          </span>
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-[#3c3c3c] rounded">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default CodeHistory;
