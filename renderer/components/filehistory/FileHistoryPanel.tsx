/**
 * 文件历史面板
 * 显示指定文件的提交历史列表，点击可查看对应Diff
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { zhCN } from '../../i18n/zh-CN';
import type { FileHistoryEntry } from '@shared/types/git';

interface FileHistoryPanelProps {
  /** 文件路径 */
  filePath: string;
  /** 选中提交后查看Diff */
  onViewDiff?: (oid: string, filePath: string) => void;
  /** 关闭回调 */
  onClose?: () => void;
}

export const FileHistoryPanel: React.FC<FileHistoryPanelProps> = ({ filePath, onViewDiff, onClose }) => {
  const [entries, setEntries] = useState<FileHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOid, setSelectedOid] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadHistory();
  }, [filePath]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.git.getFileHistoryEnhanced(filePath);
      setEntries(result || []);
    } catch (err) {
      console.error('Failed to load file history:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    if (!filter) return entries;
    const lower = filter.toLowerCase();
    return entries.filter(e =>
      e.message.toLowerCase().includes(lower) ||
      e.author.toLowerCase().includes(lower) ||
      e.oid.startsWith(filter)
    );
  }, [entries, filter]);

  const formatDate = (ts: string) => {
    const d = new Date(Number(ts) * 1000);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return zhCN.fileHistory?.today || 'Today';
    if (days === 1) return zhCN.fileHistory?.yesterday || 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return d.toLocaleDateString();
  };

  const statusColors: Record<string, string> = {
    M: 'text-yellow-400',
    A: 'text-green-400',
    D: 'text-red-400',
    R: 'text-blue-400',
  };

  const handleClick = (oid: string) => {
    setSelectedOid(oid);
    onViewDiff?.(oid, filePath);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{zhCN.fileHistory?.title || 'File History'}</span>
          <span className="text-xs text-gray-500 truncate max-w-[200px]" title={filePath}>{filePath}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder={zhCN.fileHistory?.filterPlaceholder || 'Filter...'}
            className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 placeholder-gray-500 w-32"
          />
          <button onClick={loadHistory} className="text-gray-400 hover:text-white text-xs" title="Refresh">↻</button>
          {onClose && <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">✕</button>}
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            {zhCN.fileHistory?.loading || 'Loading...'}
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            {zhCN.fileHistory?.noHistory || 'No history found'}
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredEntries.map((entry, idx) => (
              <div
                key={entry.oid}
                onClick={() => handleClick(entry.oid)}
                className={`px-4 py-2 cursor-pointer transition-colors hover:bg-gray-800 ${
                  selectedOid === entry.oid ? 'bg-blue-900/30 border-l-2 border-blue-500' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-xs font-mono mt-0.5 ${statusColors[entry.status] || 'text-gray-500'}`}>
                    {entry.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{entry.message}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                      <span>{entry.author}</span>
                      <span>·</span>
                      <span>{formatDate(entry.date)}</span>
                      <span>·</span>
                      <span className="font-mono text-[10px]">{entry.oid.slice(0, 7)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && entries.length > 0 && (
        <div className="px-4 py-1 border-t border-gray-700 bg-gray-800 text-xs text-gray-500">
          {filteredEntries.length} / {entries.length} {zhCN.fileHistory?.commits || 'commits'}
        </div>
      )}
    </div>
  );
};

export default FileHistoryPanel;
