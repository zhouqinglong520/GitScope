/**
 * Blame 视图组件
 * 显示文件的 blame 信息，包含热力图、悬停详情、过滤功能
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { zhCN } from '../../i18n/zh-CN';
import type { BlameResult, BlameLine, BlameFilter } from '@shared/types/git';

interface BlameViewProps {
  /** 文件路径 */
  filePath: string;
  /** 初始过滤条件 */
  initialFilter?: BlameFilter;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 根据提交时间计算热力图颜色
 * 越新的提交颜色越暖（红/橙），越老的提交颜色越冷（蓝/绿）
 */
function getHeatmapColor(date: number, dateRange: { oldest: number; newest: number }): string {
  if (!date || dateRange.newest === dateRange.oldest) {
    return 'rgba(128, 128, 128, 0.2)'; // 默认灰色
  }

  const range = dateRange.newest - dateRange.oldest;
  const position = (date - dateRange.oldest) / range; // 0 = 最老, 1 = 最新

  // 颜色渐变：蓝(冷) -> 绿 -> 黄 -> 橙 -> 红(热)
  // position: 0    -> 0.25 -> 0.5 -> 0.75 -> 1
  // 颜色:    #3b82f6 -> #10b981 -> #eab308 -> #f97316 -> #ef4444
  
  if (position < 0.25) {
    // 蓝 -> 绿
    const t = position / 0.25;
    const r = Math.round(59 + (16 - 59) * t);
    const g = Math.round(130 + (185 - 130) * t);
    const b = Math.round(246 + (129 - 246) * t);
    return `rgba(${r}, ${g}, ${b}, 0.3)`;
  } else if (position < 0.5) {
    // 绿 -> 黄
    const t = (position - 0.25) / 0.25;
    const r = Math.round(16 + (234 - 16) * t);
    const g = Math.round(185 + (179 - 185) * t);
    const b = Math.round(129 + (8 - 129) * t);
    return `rgba(${r}, ${g}, ${b}, 0.3)`;
  } else if (position < 0.75) {
    // 黄 -> 橙
    const t = (position - 0.5) / 0.25;
    const r = Math.round(234 + (249 - 234) * t);
    const g = Math.round(179 + (115 - 179) * t);
    const b = Math.round(8 + (22 - 8) * t);
    return `rgba(${r}, ${g}, ${b}, 0.3)`;
  } else {
    // 橙 -> 红
    const t = (position - 0.75) / 0.25;
    const r = Math.round(249 + (239 - 249) * t);
    const g = Math.round(115 + (68 - 115) * t);
    const b = Math.round(22 + (68 - 22) * t);
    return `rgba(${r}, ${g}, ${b}, 0.3)`;
  }
}

/**
 * 格式化日期
 */
function formatDate(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * 复制到剪贴板
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function BlameView({ filePath, initialFilter, onClose }: BlameViewProps) {
  const i18n = zhCN.blame;
  
  const [blameData, setBlameData] = useState<BlameResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BlameFilter>(initialFilter || {});
  const [hoveredLine, setHoveredLine] = useState<BlameLine | null>(null);
  const [showAllLines, setShowAllLines] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [authorSearch, setAuthorSearch] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; line: BlameLine } | null>(null);
  const [blamingPrevious, setBlamingPrevious] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载 blame 数据
  useEffect(() => {
    const loadBlame = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await window.electronAPI.git.blame(filePath);
        if (result) {
          setBlameData(result);
        } else {
          setError('无法获取 Blame 信息');
        }
      } catch (err) {
        setError('加载 Blame 数据失败');
        console.error('Blame error:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadBlame();
  }, [filePath]);

  // 过滤后的行
  const filteredLines = useMemo(() => {
    if (!blameData) return [];
    
    return blameData.lines.filter(line => {
      // 按作者过滤
      if (filter.authors && filter.authors.length > 0) {
        if (!filter.authors.includes(line.author)) {
          return false;
        }
      }
      
      // 按日期范围过滤
      if (filter.startDate && line.date < filter.startDate) {
        return false;
      }
      if (filter.endDate && line.date > filter.endDate) {
        return false;
      }
      
      return true;
    });
  }, [blameData, filter]);

  // 显示的行（过滤后或全部）
  const displayLines = showAllLines ? blameData?.lines || [] : filteredLines;

  // 作者列表（用于过滤）
  const authors = useMemo(() => {
    if (!blameData) return [];
    return blameData.authors.sort();
  }, [blameData]);

  // 过滤作者搜索
  const filteredAuthors = useMemo(() => {
    if (!authorSearch.trim()) return authors;
    return authors.filter(a => a.toLowerCase().includes(authorSearch.toLowerCase()));
  }, [authors, authorSearch]);

  // 处理作者选择
  const handleAuthorToggle = useCallback((author: string) => {
    setFilter(prev => {
      const currentAuthors = prev.authors || [];
      if (currentAuthors.includes(author)) {
        return { ...prev, authors: currentAuthors.filter(a => a !== author) };
      } else {
        return { ...prev, authors: [...currentAuthors, author] };
      }
    });
  }, []);

  // 清除所有过滤
  const handleClearFilters = useCallback(() => {
    setFilter({});
    setAuthorSearch('');
    setShowAllLines(false);
  }, []);

  // Blame 上一版本
  const handleBlamePrevious = useCallback(async (line: BlameLine) => {
    setBlamingPrevious(true);
    setContextMenu(null);
    try {
      const result = await window.electronAPI.git.blamePreviousRevision(filePath, line.commit);
      if (result) {
        setBlameData(result as any);
      }
    } catch (error) {
      console.error('Blame 上一版本失败:', error);
    } finally {
      setBlamingPrevious(false);
    }
  }, [filePath]);

  // 复制 SHA
  const handleCopySHA = useCallback(async (sha: string) => {
    const success = await copyToClipboard(sha);
    if (success) {
      setCopied(sha.substring(0, 7));
      setTimeout(() => setCopied(null), 2000);
    }
  }, []);

  // 点击外部关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  // 处理滚动以跟随悬停行
  useEffect(() => {
    if (hoveredLine && containerRef.current) {
      const container = containerRef.current;
      const lineElement = container.querySelector(`[data-line="${hoveredLine.lineNumber}"]`);
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [hoveredLine]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        {zhCN.common.loading}
      </div>
    );
  }

  if (error || !blameData) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        {error || '加载失败'}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* 工具栏 */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#252526] border-b border-[#3c3c3c]">
        {/* 标题 */}
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-sm font-medium">{i18n.title}</span>
          <span className="text-xs text-gray-500 truncate max-w-[200px]">{filePath}</span>
        </div>

        <div className="h-4 w-px bg-[#3c3c3c]" />

        {/* 作者过滤 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{i18n.filterByAuthor}:</span>
          <input
            type="text"
            value={authorSearch}
            onChange={(e) => setAuthorSearch(e.target.value)}
            placeholder={zhCN.authorFilter.search}
            className="w-32 px-2 py-1 text-xs bg-[#3c3c3c] border border-[#3c3c3c] rounded outline-none focus:border-primary-500"
          />
        </div>

        {/* 作者选择 */}
        {filteredAuthors.length > 0 && (
          <div className="flex items-center gap-1 max-w-[300px] overflow-x-auto">
            {filteredAuthors.slice(0, 5).map(author => (
              <button
                key={author}
                onClick={() => handleAuthorToggle(author)}
                className={`
                  px-2 py-0.5 text-xs rounded whitespace-nowrap
                  ${(filter.authors || []).includes(author)
                    ? 'bg-primary-600 text-white'
                    : 'bg-[#3c3c3c] text-gray-300 hover:bg-[#4f4f4f]'
                  }
                `}
              >
                {author}
              </button>
            ))}
            {filteredAuthors.length > 5 && (
              <span className="text-xs text-gray-500">+{filteredAuthors.length - 5}</span>
            )}
          </div>
        )}

        {/* 清除过滤 */}
        {(filter.authors?.length || filter.startDate || filter.endDate) && (
          <button
            onClick={handleClearFilters}
            className="px-2 py-1 text-xs text-primary-400 hover:text-primary-300"
          >
            {i18n.clearFilters}
          </button>
        )}

        {/* 显示选项 */}
        <div className="flex items-center gap-2 ml-auto">
          <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showAllLines}
              onChange={(e) => setShowAllLines(e.target.checked)}
              className="w-3 h-3"
            />
            {i18n.showAllLines}
          </label>
        </div>

        {/* 关闭按钮 */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#3c3c3c] rounded"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 热力图图例 */}
      <div className="flex items-center gap-4 px-4 py-1.5 bg-[#252526] border-b border-[#3c3c3c] text-xs">
        <span className="text-gray-400">{i18n.legend.title}:</span>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">{i18n.legend.cold}</span>
          <div className="w-24 h-3 rounded" style={{
            background: 'linear-gradient(to right, #3b82f6, #10b981, #eab308, #f97316, #ef4444)'
          }} />
          <span className="text-gray-500">{i18n.legend.warm}</span>
        </div>
        <span className="text-gray-500">({filteredLines.length}/{blameData.lines.length} 行)</span>
      </div>

      {/* Blame 内容 */}
      <div ref={containerRef} className="flex-1 overflow-auto font-mono text-sm">
        <table className="w-full border-collapse">
          <tbody>
            {displayLines.map((line) => {
              const heatmapColor = blameData.dateRange 
                ? getHeatmapColor(line.date, blameData.dateRange) 
                : 'rgba(128, 128, 128, 0.2)';
              const isHovered = hoveredLine?.lineNumber === line.lineNumber;
              
              return (
                <tr
                  key={line.lineNumber}
                  data-line={line.lineNumber}
                  className={`group ${isHovered ? 'bg-[#2a2d2e]' : 'hover:bg-[#252526]'}`}
                  onMouseEnter={() => setHoveredLine(line)}
                  onMouseLeave={() => setHoveredLine(null)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, line });
                  }}
                >
                  {/* 提交信息 */}
                  <td 
                    className="px-2 py-0.5 text-xs text-gray-400 border-r border-[#3c3c3c] select-none"
                    style={{ backgroundColor: heatmapColor }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[80px]" title={line.commit}>
                        {line.shortCommit}
                      </span>
                      <button
                        onClick={() => handleCopySHA(line.commit)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#3c3c3c] rounded transition-opacity"
                        title={copied === line.shortCommit ? i18n.copied : i18n.copySHA}
                      >
                        {copied === line.shortCommit ? (
                          <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                  
                  {/* 作者 */}
                  <td className="px-2 py-0.5 text-xs text-gray-400 border-r border-[#3c3c3c] select-none" style={{ backgroundColor: heatmapColor }}>
                    <span className="truncate max-w-[100px]" title={line.author}>
                      {line.author}
                    </span>
                  </td>
                  
                  {/* 日期 */}
                  <td className="px-2 py-0.5 text-xs text-gray-500 border-r border-[#3c3c3c] select-none" style={{ backgroundColor: heatmapColor }}>
                    <span title={formatDate(line.date)}>
                      {new Date(line.date * 1000).toLocaleDateString()}
                    </span>
                  </td>
                  
                  {/* 行号 */}
                  <td className="px-2 py-0.5 text-xs text-gray-600 text-right select-none w-10">
                    {line.lineNumber}
                  </td>
                  
                  {/* 代码内容 */}
                  <td className="px-2 py-0.5 text-gray-300 whitespace-pre">
                    {line.content}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div className="fixed bg-[#2d2d30] border border-[#3c3c3c] rounded shadow-xl py-1 z-[1000] min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 text-sm text-gray-300 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
            onClick={() => { navigator.clipboard.writeText(contextMenu.line.commit); setContextMenu(null); }}
          >
            📋 复制 SHA
          </div>
          <div className="px-3 py-2 text-sm text-gray-300 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
            onClick={() => handleBlamePrevious(contextMenu.line)}
          >
            ⏪ Blame 上一版本
          </div>
          <div className="h-px bg-[#3c3c3c] my-1" />
          <div className="px-3 py-2 text-sm text-gray-300 hover:bg-[#094771] cursor-pointer flex items-center gap-2"
            onClick={() => { setContextMenu(null); }}
          >
            ✕ 关闭
          </div>
        </div>
      )}

      {/* Blaming 指示器 */}
      {blamingPrevious && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg z-50">
          ⏳ 正在加载上一版本...
        </div>
      )}

      {/* 悬停详情 Tooltip */}
      {hoveredLine && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-xl p-3 z-50 min-w-[300px]">
          <div className="text-xs space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-16">{i18n.hoverDetail.commit}:</span>
              <span className="text-primary-400 font-mono">{hoveredLine.shortCommit}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-16">{i18n.hoverDetail.author}:</span>
              <span>{hoveredLine.author} &lt;{hoveredLine.authorEmail}&gt;</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-16">{i18n.hoverDetail.date}:</span>
              <span>{formatDate(hoveredLine.date)}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-400 w-16 flex-shrink-0">{i18n.hoverDetail.message}:</span>
              <span className="text-gray-300 line-clamp-2">{hoveredLine.commitMessage}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
