/**
 * 差异查看组件
 * 支持 Unified（内联）和 Side-by-Side（并排）两种模式
 * 
 * 功能：
 * 1. Diff 内搜索（Ctrl+F）
 * 2. 语法高亮
 * 3. 下一处/上一处变更导航
 * 4. 显示空白字符
 * 5. 忽略空白差异
 * 6. 外部 Diff 工具
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import hljs from 'highlight.js/lib/core';
// 导入常用语言支持
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import markdown from 'highlight.js/lib/languages/markdown';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';
import sql from 'highlight.js/lib/languages/sql';
import java from 'highlight.js/lib/languages/java';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import dart from 'highlight.js/lib/languages/dart';
import 'highlight.js/styles/github-dark.css';

// 注册语言
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('vue', xml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('java', java);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('dart', dart);

import type { GitDiff, GitDiffHunk, GitDiffLine } from '@shared/types/git';
import { zhCN } from '../../i18n/zh-CN';

// ========== 类型定义 ==========

/** 视图模式 */
export type DiffViewMode = 'unified' | 'side-by-side';

/** localStorage 持久化的 key */
const DIFF_VIEW_MODE_KEY = 'gitgui-diff-view-mode';
const DIFF_SHOW_WHITESPACE_KEY = 'gitgui-diff-show-whitespace';
const DIFF_IGNORE_WHITESPACE_KEY = 'gitgui-diff-ignore-whitespace';
const DIFF_SYNTAX_HIGHLIGHT_KEY = 'gitgui-diff-syntax-highlight';

interface DiffViewProps {
  /** 提交 SHA（查看提交差异时） */
  commitOid?: string | null;
  /** 文件路径（查看文件差异时） */
  filePath?: string | null;
}

/** 搜索匹配项 */
interface SearchMatch {
  fileIndex: number;
  hunkIndex: number;
  lineIndex: number;
  text: string;
  start: number;
  end: number;
}

/** 根据文件扩展名获取语言 */
function getLanguageFromPath(filePath: string | undefined): string {
  if (!filePath) return '';
  
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    json: 'json',
    css: 'css',
    scss: 'css',
    less: 'less',
    html: 'html',
    htm: 'html',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    go: 'go',
    rust: 'rust',
    rs: 'rust',
    java: 'java',
    kotlin: 'kotlin',
    kt: 'kotlin',
    swift: 'swift',
    cpp: 'cpp',
    c: 'c',
    h: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    ruby: 'ruby',
    rb: 'ruby',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'bash',
    dockerfile: 'dockerfile',
    docker: 'dockerfile',
    sql: 'sql',
    xml: 'xml',
    svg: 'xml',
    txt: '',
    text: '',
  };
  
  return langMap[ext] || '';
}

// ========== 主组件 ==========

function DiffView({ commitOid, filePath }: DiffViewProps) {
  const i18n = zhCN;
  const [diff, setDiff] = useState<GitDiff[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 视图模式
  const [viewMode, setViewMode] = useState<DiffViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(DIFF_VIEW_MODE_KEY);
      if (saved === 'unified' || saved === 'side-by-side') {
        return saved;
      }
    }
    return 'unified';
  });

  // 搜索状态
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchRegex, setSearchRegex] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // 显示空白字符
  const [showWhitespace, setShowWhitespace] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(DIFF_SHOW_WHITESPACE_KEY) === 'true';
    }
    return false;
  });
  
  // 忽略空白差异
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(DIFF_IGNORE_WHITESPACE_KEY) === 'true';
    }
    return false;
  });
  
  // 语法高亮
  const [syntaxHighlight, setSyntaxHighlight] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(DIFF_SYNTAX_HIGHLIGHT_KEY);
      return saved !== 'false'; // 默认开启
    }
    return true;
  });
  
  // Hunk 导航
  const hunkRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Side-by-Side 模式同步滚动 ref
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  
  // 内容滚动容器 ref
  const contentRef = useRef<HTMLDivElement>(null);

  // 保存设置到 localStorage
  const saveSettings = useCallback(() => {
    localStorage.setItem(DIFF_SHOW_WHITESPACE_KEY, String(showWhitespace));
    localStorage.setItem(DIFF_IGNORE_WHITESPACE_KEY, String(ignoreWhitespace));
    localStorage.setItem(DIFF_SYNTAX_HIGHLIGHT_KEY, String(syntaxHighlight));
  }, [showWhitespace, ignoreWhitespace, syntaxHighlight]);

  useEffect(() => {
    saveSettings();
  }, [saveSettings]);

  // 切换视图模式并持久化
  const handleViewModeChange = useCallback((mode: DiffViewMode) => {
    setViewMode(mode);
    localStorage.setItem(DIFF_VIEW_MODE_KEY, mode);
  }, []);

  // 计算所有搜索匹配项
  const searchMatches = useMemo((): SearchMatch[] => {
    if (!searchQuery) return [];
    
    const matches: SearchMatch[] = [];
    const regex = searchRegex 
      ? new RegExp(searchQuery, 'gi')
      : new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    
    diff.forEach((fileDiff, fileIndex) => {
      fileDiff.hunks.forEach((hunk, hunkIndex) => {
        hunk.lines.forEach((line, lineIndex) => {
          let match;
          while ((match = regex.exec(line.content)) !== null) {
            matches.push({
              fileIndex,
              hunkIndex,
              lineIndex,
              text: line.content,
              start: match.index,
              end: match.index + match[0].length,
            });
          }
        });
      });
    });
    
    return matches;
  }, [diff, searchQuery, searchRegex]);

  // 跳转到指定匹配项
  const scrollToMatch = useCallback((index: number) => {
    if (searchMatches.length === 0) return;
    
    const match = searchMatches[index];
    if (!match) return;
    
    const key = `${match.fileIndex}-${match.hunkIndex}`;
    const hunkEl = hunkRefs.current.get(key);
    
    if (hunkEl) {
      hunkEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 添加高亮闪烁效果
      hunkEl.classList.add('hljs-search-highlight');
      setTimeout(() => {
        hunkEl.classList.remove('hljs-search-highlight');
      }, 1000);
    }
  }, [searchMatches]);

  // 快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F 打开搜索
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      
      // Ctrl+Shift+S 切换模式
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        handleViewModeChange(viewMode === 'unified' ? 'side-by-side' : 'unified');
      }
      
      // Ctrl+G 或 F3 下一个匹配
      if ((e.ctrlKey && e.key === 'g') || e.key === 'F3') {
        e.preventDefault();
        if (searchMatches.length > 0) {
          const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
          setCurrentMatchIndex(nextIndex);
          scrollToMatch(nextIndex);
        }
      }
      
      // Shift+F3 上一个匹配
      if (e.shiftKey && e.key === 'F3') {
        e.preventDefault();
        if (searchMatches.length > 0) {
          const prevIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
          setCurrentMatchIndex(prevIndex);
          scrollToMatch(prevIndex);
        }
      }
      
      // Escape 关闭搜索
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
      }
      
      // Ctrl+Up 上一处变更
      if (e.ctrlKey && e.key === 'ArrowUp') {
        e.preventDefault();
        navigateToHunk(-1);
      }
      
      // Ctrl+Down 下一处变更
      if (e.ctrlKey && e.key === 'ArrowDown') {
        e.preventDefault();
        navigateToHunk(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, handleViewModeChange, showSearch, searchMatches, currentMatchIndex, scrollToMatch]);

  // Hunk 导航
  const navigateToHunk = useCallback((direction: 1 | -1) => {
    const allHunks: Array<{ fileIndex: number; hunkIndex: number }> = [];
    
    diff.forEach((fileDiff, fileIndex) => {
      fileDiff.hunks.forEach((_, hunkIndex) => {
        allHunks.push({ fileIndex, hunkIndex });
      });
    });
    
    if (allHunks.length === 0) return;
    
    // 找到当前可见的 hunk
    const scrollTop = contentRef.current?.scrollTop || 0;
    let currentHunkIndex = 0;
    
    allHunks.forEach((hunk, index) => {
      const key = `${hunk.fileIndex}-${hunk.hunkIndex}`;
      const el = hunkRefs.current.get(key);
      if (el && el.offsetTop < scrollTop) {
        currentHunkIndex = index;
      }
    });
    
    // 计算目标 hunk（循环）
    const nextIndex = (currentHunkIndex + direction + allHunks.length) % allHunks.length;
    const targetHunk = allHunks[nextIndex];
    const key = `${targetHunk.fileIndex}-${targetHunk.hunkIndex}`;
    const el = hunkRefs.current.get(key);
    
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-blue-900/30');
      setTimeout(() => el.classList.remove('bg-blue-900/30'), 1000);
    }
  }, [diff]);

  // Side-by-Side 同步滚动
  const handleScroll = useCallback((source: 'left' | 'right') => {
    if (isScrollingRef.current) return;
    
    const sourceEl = source === 'left' ? leftPanelRef.current : rightPanelRef.current;
    const targetEl = source === 'left' ? rightPanelRef.current : leftPanelRef.current;
    
    if (!sourceEl || !targetEl) return;
    
    isScrollingRef.current = true;
    targetEl.scrollTop = sourceEl.scrollTop;
    requestAnimationFrame(() => {
      isScrollingRef.current = false;
    });
  }, []);

  // 加载差异数据
  useEffect(() => {
    const loadDiff = async () => {
      if (!commitOid && !filePath) {
        setDiff([]);
        return;
      }

      setLoading(true);
      try {
        const result = await window.electronAPI.git.getDiff(
          filePath || undefined, 
          commitOid || undefined
        );
        setDiff(result);
      } catch (error) {
        console.error('加载差异失败:', error);
        setDiff([]);
      } finally {
        setLoading(false);
      }
    };

    loadDiff();
  }, [commitOid, filePath, ignoreWhitespace]);

  // 在外部工具中打开
  const handleOpenInDiffTool = async () => {
    try {
      const success = await window.electronAPI.git.openInDiffTool(filePath || undefined);
      if (!success) {
        alert(i18n.diff.diffToolNotConfigured);
      }
    } catch (error) {
      console.error('打开 difftool 失败:', error);
      alert(i18n.diff.diffToolNotConfigured);
    }
  };

  // 获取行类型样式
  const getLineClass = (type: 'context' | 'add' | 'delete') => {
    const baseClass = 'font-mono text-xs leading-5';
    switch (type) {
      case 'add':
        return `${baseClass} bg-green-900/30 text-green-400`;
      case 'delete':
        return `${baseClass} bg-red-900/30 text-red-400`;
      default:
        return `${baseClass} text-gray-300`;
    }
  };

  // 渲染空白字符
  const renderContent = (content: string, lineType: 'context' | 'add' | 'delete') => {
    if (!showWhitespace) {
      return <span className="whitespace-pre">{content}</span>;
    }
    
    // 显示空白字符
    let result: React.ReactNode[] = [];
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (char === ' ') {
        result.push(<span key={i} className="text-gray-500">·</span>);
      } else if (char === '\t') {
        result.push(<span key={i} className="text-gray-500">→ </span>);
      } else {
        result.push(char);
      }
    }
    
    return (
      <span className="whitespace-pre">
        {result}
        {content.endsWith(' ') && <span className="bg-yellow-600/50 text-yellow-400">·</span>}
      </span>
    );
  };

  // 检查行是否匹配搜索
  const isLineHighlighted = (lineIndex: number, hunkIndex: number, fileIndex: number) => {
    if (!searchQuery || searchMatches.length === 0) return false;
    return searchMatches.some(m => 
      m.fileIndex === fileIndex && 
      m.hunkIndex === hunkIndex && 
      m.lineIndex === lineIndex
    );
  };

  // 高亮搜索文本
  const highlightSearchText = (text: string) => {
    if (!searchQuery) return text;
    
    try {
      const regex = searchRegex 
        ? new RegExp(`(${searchQuery})`, 'gi')
        : new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      
      const parts = text.split(regex);
      return parts.map((part, i) => {
        if (regex.test(part)) {
          return <mark key={i} className="bg-yellow-500/70 text-black px-0.5 rounded">{part}</mark>;
        }
        return part;
      });
    } catch {
      return text;
    }
  };

  // 获取 hunk key
  const getHunkKey = (fileIndex: number, hunkIndex: number) => `${fileIndex}-${hunkIndex}`;

  // 注册 hunk ref
  const registerHunkRef = (key: string, el: HTMLDivElement | null) => {
    if (el) {
      hunkRefs.current.set(key, el);
    } else {
      hunkRefs.current.delete(key);
    }
  };

  // 渲染 Unified 模式
  const renderUnifiedView = () => (
    <div className="font-mono text-xs">
      {diff.map((fileDiff, fileIndex) => {
        const fileLanguage = getLanguageFromPath(fileDiff.newPath || fileDiff.oldPath);
        
        return (
          <div key={fileIndex} className="border-b border-panel-border">
            {/* 文件头 */}
            <div className="bg-panel-bg px-4 py-2 border-b border-panel-border">
              <div className="flex items-center gap-4 text-sm">
                {fileDiff.oldPath && (
                  <span className="text-red-400">
                    {i18n.diff.oldFile}: {fileDiff.oldPath}
                  </span>
                )}
                {fileDiff.newPath && (
                  <span className="text-green-400">
                    {i18n.diff.newFile}: {fileDiff.newPath}
                  </span>
                )}
                {fileDiff.type === 'binary' && (
                  <span className="text-gray-400">{i18n.diff.binaryFile}</span>
                )}
              </div>
            </div>

            {/* 差异内容 */}
            {fileDiff.type === 'binary' ? (
              <div className="p-8 text-center text-gray-500">
                <p>{i18n.diff.binaryFile}</p>
              </div>
            ) : fileDiff.type === 'untracked' ? (
              <div className="p-8 text-center text-green-400">
                <p>{i18n.diff.untrackedFile}</p>
              </div>
            ) : (
              fileDiff.hunks.map((hunk, hunkIndex) => {
                const hunkKey = getHunkKey(fileIndex, hunkIndex);
                
                return (
                  <div key={hunkIndex} ref={(el) => registerHunkRef(hunkKey, el)}>
                    {/* Hunk 头 */}
                    <div className="bg-blue-900/20 text-blue-400 px-4 py-1">
                      <span>@@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@</span>
                    </div>

                    {/* Hunk 内容 */}
                    {hunk.lines.map((line, lineIndex) => (
                      <div
                        key={lineIndex}
                        className={`flex ${getLineClass(line.type)} ${
                          isLineHighlighted(lineIndex, hunkIndex, fileIndex) ? 'bg-yellow-900/30' : ''
                        }`}
                      >
                        {/* 行号 */}
                        <span className="w-12 text-right pr-2 text-gray-600 select-none border-r border-panel-border">
                          {line.oldLineNumber || ''}
                        </span>
                        <span className="w-12 text-right pr-2 text-gray-600 select-none border-r border-panel-border">
                          {line.newLineNumber || ''}
                        </span>

                        {/* 前缀 */}
                        <span className="w-6 text-center select-none">
                          {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
                        </span>

                        {/* 内容 */}
                        <span className="flex-1 px-2">
                          {syntaxHighlight && fileLanguage && line.type === 'context' ? (
                            <code 
                              className={`hljs language-${fileLanguage}`}
                              dangerouslySetInnerHTML={{
                                __html: hljs.highlight(line.content || ' ', { language: fileLanguage }).value
                              }}
                            />
                          ) : (
                            renderContent(line.content, line.type)
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })
            )}

            {/* 统计信息 */}
            <div className="px-4 py-2 bg-panel-bg text-xs text-gray-500 border-t border-panel-border">
              {renderStats(fileDiff)}
            </div>
          </div>
        );
      })}
    </div>
  );

  // 渲染 Side-by-Side 模式
  const renderSideBySideView = () => (
    <div className="font-mono text-xs">
      {diff.map((fileDiff, fileIndex) => {
        const fileLanguage = getLanguageFromPath(fileDiff.newPath || fileDiff.oldPath);
        
        return (
          <div key={fileIndex} className="border-b border-panel-border">
            {/* 文件头 */}
            <div className="bg-panel-bg px-4 py-2 border-b border-panel-border">
              <div className="flex items-center gap-4 text-sm">
                {fileDiff.oldPath && (
                  <span className="text-red-400">
                    {i18n.diff.oldFile}: {fileDiff.oldPath}
                  </span>
                )}
                {fileDiff.newPath && (
                  <span className="text-green-400">
                    {i18n.diff.newFile}: {fileDiff.newPath}
                  </span>
                )}
                {fileDiff.type === 'binary' && (
                  <span className="text-gray-400">{i18n.diff.binaryFile}</span>
                )}
              </div>
            </div>

            {/* 差异内容 */}
            {fileDiff.type === 'binary' ? (
              <div className="p-8 text-center text-gray-500">
                <p>{i18n.diff.binaryFile}</p>
              </div>
            ) : fileDiff.type === 'untracked' ? (
              <div className="p-8 text-center text-green-400">
                <p>{i18n.diff.untrackedFile}</p>
              </div>
            ) : (
              <div className="flex">
                {/* 左栏（旧文件） */}
                <div 
                  ref={leftPanelRef}
                  className="flex-1 border-r border-panel-border overflow-auto max-h-[600px]"
                  onScroll={() => handleScroll('left')}
                >
                  {fileDiff.hunks.map((hunk, hunkIndex) => (
                    <SideBySideHunk
                      key={hunkIndex}
                      hunk={hunk}
                      side="old"
                      i18n={i18n}
                      fileLanguage={fileLanguage}
                      showWhitespace={showWhitespace}
                      syntaxHighlight={syntaxHighlight}
                      isHighlighted={(lineIndex) => isLineHighlighted(lineIndex, hunkIndex, fileIndex)}
                      highlightText={highlightSearchText}
                    />
                  ))}
                </div>

                {/* 右栏（新文件） */}
                <div 
                  ref={rightPanelRef}
                  className="flex-1 overflow-auto max-h-[600px]"
                  onScroll={() => handleScroll('right')}
                >
                  {fileDiff.hunks.map((hunk, hunkIndex) => (
                    <SideBySideHunk
                      key={hunkIndex}
                      hunk={hunk}
                      side="new"
                      i18n={i18n}
                      fileLanguage={fileLanguage}
                      showWhitespace={showWhitespace}
                      syntaxHighlight={syntaxHighlight}
                      isHighlighted={(lineIndex) => isLineHighlighted(lineIndex, hunkIndex, fileIndex)}
                      highlightText={highlightSearchText}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 统计信息 */}
            <div className="px-4 py-2 bg-panel-bg text-xs text-gray-500 border-t border-panel-border">
              {renderStats(fileDiff)}
            </div>
          </div>
        );
      })}
    </div>
  );

  // 渲染统计信息
  const renderStats = (fileDiff: GitDiff) => {
    let additions = 0;
    let deletions = 0;
    fileDiff.hunks.forEach((hunk) => {
      hunk.lines.forEach((line) => {
        if (line.type === 'add') additions++;
        if (line.type === 'delete') deletions++;
      });
    });
    return (
      <span>
        <span className="text-green-400">+{additions}</span>
        {' / '}
        <span className="text-red-400">-{deletions}</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <p className="text-sm">{i18n.common.loading}</p>
      </div>
    );
  }

  if (diff.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">{i18n.diff.noDiff}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-panel-bg border-b border-panel-border flex-wrap gap-2">
        {/* 左侧：视图模式 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{i18n.diff.viewMode}:</span>
          <div className="flex bg-gray-800 rounded overflow-hidden">
            <button
              className={`px-3 py-1 text-xs transition-colors ${
                viewMode === 'unified'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => handleViewModeChange('unified')}
              title="Unified View (Ctrl+Shift+S)"
            >
              {i18n.diff.unified}
            </button>
            <button
              className={`px-3 py-1 text-xs transition-colors ${
                viewMode === 'side-by-side'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => handleViewModeChange('side-by-side')}
              title="Side-by-Side View (Ctrl+Shift+S)"
            >
              {i18n.diff.sideBySide}
            </button>
          </div>
        </div>

        {/* 中间：功能按钮 */}
        <div className="flex items-center gap-2">
          {/* 搜索按钮 */}
          <button
            className={`p-1.5 rounded transition-colors ${
              showSearch ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            onClick={() => {
              setShowSearch(!showSearch);
              if (!showSearch) {
                setTimeout(() => searchInputRef.current?.focus(), 0);
              }
            }}
            title="Search (Ctrl+F)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* 上一处/下一处变更 */}
          <button
            className="p-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            onClick={() => navigateToHunk(-1)}
            title={`${i18n.diff.prevHunk} (Ctrl+↑)`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            className="p-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            onClick={() => navigateToHunk(1)}
            title={`${i18n.diff.nextHunk} (Ctrl+↓)`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* 分隔线 */}
          <div className="w-px h-5 bg-gray-600 mx-1" />

          {/* 显示空白字符 */}
          <button
            className={`p-1.5 rounded transition-colors ${
              showWhitespace ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            onClick={() => setShowWhitespace(!showWhitespace)}
            title={i18n.diff.showWhitespace}
          >
            <span className="text-xs font-mono">¶</span>
          </button>

          {/* 忽略空白差异 */}
          <button
            className={`p-1.5 rounded transition-colors ${
              ignoreWhitespace ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            onClick={() => setIgnoreWhitespace(!ignoreWhitespace)}
            title={i18n.diff.ignoreWhitespace}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* 语法高亮 */}
          <button
            className={`p-1.5 rounded transition-colors ${
              syntaxHighlight ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            onClick={() => setSyntaxHighlight(!syntaxHighlight)}
            title={i18n.diff.syntaxHighlight}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </button>

          {/* 外部工具 */}
          <button
            className="p-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            onClick={handleOpenInDiffTool}
            title={i18n.diff.openInExternalTool}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>

        {/* 右侧：快捷键提示 */}
        <div className="text-xs text-gray-500">
          <kbd className="px-1 py-0.5 bg-gray-700 rounded">Ctrl+Shift+S</kbd>
        </div>
      </div>

      {/* 搜索栏 */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-panel-border">
          <input
            ref={searchInputRef}
            type="text"
            className="flex-1 px-3 py-1 bg-gray-700 text-white text-sm rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={i18n.diff.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentMatchIndex(0);
            }}
          />
          
          {/* 正则表达式 */}
          <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={searchRegex}
              onChange={(e) => setSearchRegex(e.target.checked)}
              className="rounded"
            />
            {i18n.diff.searchPlaceholder.includes('正则') ? '.*' : 'Regex'}
          </label>
          
          {/* 匹配计数 */}
          <span className="text-xs text-gray-400 min-w-[60px] text-center">
            {searchMatches.length > 0
              ? `${currentMatchIndex + 1}/${searchMatches.length}`
              : searchQuery
                ? i18n.diff.searchNoResults
                : ''}
          </span>
          
          {/* 上一个/下一个 */}
          <button
            className="p-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
            disabled={searchMatches.length === 0}
            onClick={() => {
              const prevIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
              setCurrentMatchIndex(prevIndex);
              scrollToMatch(prevIndex);
            }}
            title={i18n.diff.prevHunk}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            className="p-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
            disabled={searchMatches.length === 0}
            onClick={() => {
              const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
              setCurrentMatchIndex(nextIndex);
              scrollToMatch(nextIndex);
            }}
            title={i18n.diff.nextHunk}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {/* 关闭 */}
          <button
            className="p-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            title="Close (Esc)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 差异内容 */}
      <div ref={contentRef} className="flex-1 overflow-auto">
        {viewMode === 'unified' ? renderUnifiedView() : renderSideBySideView()}
      </div>
    </div>
  );
}

// ========== Side-by-Side Hunk 组件 ==========

interface SideBySideHunkProps {
  hunk: GitDiffHunk;
  side: 'old' | 'new';
  i18n: typeof zhCN;
  fileLanguage: string;
  showWhitespace: boolean;
  syntaxHighlight: boolean;
  isHighlighted: (lineIndex: number) => boolean;
  highlightText: (text: string) => React.ReactNode;
}

function SideBySideHunk({
  hunk,
  side,
  i18n,
  fileLanguage,
  showWhitespace,
  syntaxHighlight,
  isHighlighted,
  highlightText,
}: SideBySideHunkProps) {
  // 将 hunk 转换为并排行
  const sideBySideLines = convertToSideBySide(hunk);

  // 渲染空白字符
  const renderContent = (content: string, lineType: 'context' | 'add' | 'delete') => {
    if (!showWhitespace) {
      return <span className="whitespace-pre">{content}</span>;
    }
    
    let result: React.ReactNode[] = [];
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (char === ' ') {
        result.push(<span key={i} className="text-gray-500">·</span>);
      } else if (char === '\t') {
        result.push(<span key={i} className="text-gray-500">→ </span>);
      } else {
        result.push(char);
      }
    }
    
    return (
      <span className="whitespace-pre">
        {result}
        {content.endsWith(' ') && <span className="bg-yellow-600/50 text-yellow-400">·</span>}
      </span>
    );
  };

  return (
    <div>
      {/* Hunk 头 */}
      <div className="bg-blue-900/20 text-blue-400 px-2 py-1 sticky left-0">
        <span className="text-[10px]">
          @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
        </span>
      </div>

      {/* 并排行 */}
      {sideBySideLines.map((row, index) => {
        const line = side === 'old' ? row.oldLine : row.newLine;
        const lineNumber = side === 'old' ? row.oldLineNumber : row.newLineNumber;

        if (!line) {
          // 空行（纯新增或纯删除的配对行）
          return (
            <div
              key={index}
              className="flex h-5"
              style={{ minHeight: '20px' }}
            >
              <span className="w-10 text-right pr-2 text-gray-600 select-none border-r border-panel-border bg-gray-900/30">
                {lineNumber || ''}
              </span>
              <span className="flex-1 px-2 bg-gray-900/20" />
            </div>
          );
        }

        // 行样式
        let bgClass = 'bg-transparent';
        if (line.type === 'add') {
          bgClass = 'bg-green-900/30';
        } else if (line.type === 'delete') {
          bgClass = 'bg-red-900/30';
        } else if (row.isModified) {
          bgClass = side === 'old' ? 'bg-yellow-900/20' : 'bg-green-900/20';
        }

        const highlighted = isHighlighted(index);

        return (
          <div
            key={index}
            className={`flex h-5 ${bgClass} ${highlighted ? 'bg-yellow-900/30' : ''}`}
            style={{ minHeight: '20px' }}
          >
            {/* 行号 */}
            <span className="w-10 text-right pr-2 text-gray-600 select-none border-r border-panel-border">
              {lineNumber || ''}
            </span>

            {/* 前缀 */}
            <span className="w-5 text-center select-none text-gray-500">
              {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
            </span>

            {/* 内容 */}
            <span className={`flex-1 px-1 ${
              line.type === 'add' ? 'text-green-400' : 
              line.type === 'delete' ? 'text-red-400' : 'text-gray-300'
            }`}>
              {syntaxHighlight && fileLanguage && line.type === 'context' ? (
                <code 
                  className={`hljs language-${fileLanguage}`}
                  dangerouslySetInnerHTML={{
                    __html: hljs.highlight(line.content || ' ', { language: fileLanguage }).value
                  }}
                />
              ) : (
                renderContent(line.content, line.type)
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ========== 并排显示行数据 ==========

interface SideBySideRow {
  oldLine: GitDiffLine | null;
  newLine: GitDiffLine | null;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  isModified: boolean;
}

/**
 * 将 hunk 转换为并排显示的行
 */
function convertToSideBySide(hunk: GitDiffHunk): SideBySideRow[] {
  const result: SideBySideRow[] = [];
  const lines = hunk.lines;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.type === 'context') {
      result.push({
        oldLine: line,
        newLine: line,
        oldLineNumber: line.oldLineNumber ?? null,
        newLineNumber: line.newLineNumber ?? null,
        isModified: false,
      });
      i++;
    } else if (line.type === 'delete' && (i + 1 >= lines.length || lines[i + 1].type !== 'add')) {
      result.push({
        oldLine: line,
        newLine: null,
        oldLineNumber: line.oldLineNumber ?? null,
        newLineNumber: null,
        isModified: false,
      });
      i++;
    } else if (line.type === 'add' && (i === 0 || lines[i - 1].type !== 'delete')) {
      result.push({
        oldLine: null,
        newLine: line,
        oldLineNumber: null,
        newLineNumber: line.newLineNumber ?? null,
        isModified: false,
      });
      i++;
    } else if (line.type === 'delete' && i + 1 < lines.length && lines[i + 1].type === 'add') {
      const deleteLine = line;
      const addLine = lines[i + 1];

      result.push({
        oldLine: deleteLine,
        newLine: null,
        oldLineNumber: deleteLine.oldLineNumber ?? null,
        newLineNumber: null,
        isModified: true,
      });

      result.push({
        oldLine: null,
        newLine: addLine,
        oldLineNumber: null,
        newLineNumber: addLine.newLineNumber ?? null,
        isModified: true,
      });

      i += 2;
    } else {
      result.push({
        oldLine: line,
        newLine: line,
        oldLineNumber: line.oldLineNumber ?? null,
        newLineNumber: line.newLineNumber ?? null,
        isModified: false,
      });
      i++;
    }
  }

  return result;
}

// 添加搜索高亮样式
const style = document.createElement('style');
style.textContent = `
  .hljs-search-highlight {
    animation: highlight-flash 1s ease-out;
  }
  @keyframes highlight-flash {
    0% { background-color: rgba(59, 130, 246, 0.5); }
    100% { background-color: transparent; }
  }
`;
document.head.appendChild(style);

export default DiffView;
export type { DiffViewProps };
