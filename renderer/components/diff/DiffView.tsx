/**
 * 差异查看组件（增强版）
 * 支持 Unified（内联）和 Side-by-Side（并排）两种模式
 * 
 * P0 增强：
 * 1. Word-level Diff（词级差异高亮）— 对 delete+add 行配对做词级 diff
 * 2. Line-level Staging（行级暂存）— 选中行后 stage/unstage，保持滚动位置
 * 
 * 原有功能：
 * 3. Diff 内搜索（Ctrl+F）
 * 4. 语法高亮
 * 5. 下一处/上一处变更导航
 * 6. 显示空白字符
 * 7. 忽略空白差异
 * 8. 外部 Diff 工具
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import hljs from 'highlight.js/lib/core';
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
import { useI18 } from '../../i18n';

// ========== 类型定义 ==========

export type DiffViewMode = 'unified' | 'side-by-side';

const DIFF_VIEW_MODE_KEY = 'gitgui-diff-view-mode';
const DIFF_SHOW_WHITESPACE_KEY = 'gitgui-diff-show-whitespace';
const DIFF_IGNORE_WHITESPACE_KEY = 'gitgui-diff-ignore-whitespace';
const DIFF_SYNTAX_HIGHLIGHT_KEY = 'gitgui-diff-syntax-highlight';

interface DiffViewProps {
  commitOid?: string | null;
  filePath?: string | null;
  /** 是否为暂存区 diff（行级暂存需要） */
  isStaged?: boolean;
  /** 刷新回调（行级暂存后刷新） */
  onRefresh?: () => void;
  /** Per-file stage/unstage/discard callbacks (Fork-style) */
  onStageFile?: (path: string) => void;
  onUnstageFile?: (path: string) => void;
  onDiscardFile?: (path: string) => void;
}

interface SearchMatch {
  fileIndex: number;
  hunkIndex: number;
  lineIndex: number;
  text: string;
  start: number;
  end: number;
}

// ========== Word-level Diff 算法 ==========

interface WordDiffSegment {
  value: string;
  added?: boolean;
  removed?: boolean;
}

/**
 * 词级 diff 算法 — 基于 LCS（最长公共子序列）
 * 对一行删除 + 一行新增配对，找出精确的词级变更
 * 算法思路：按 word 边界拆分 → LCS 匹配 → 标记 added/removed
 */
function diffWords(oldStr: string, newStr: string): { oldSegments: WordDiffSegment[]; newSegments: WordDiffSegment[] } {
  // 按 word 边界拆分（保留空格和标点作为独立 token）
  const tokenize = (str: string): string[] => {
    const tokens: string[] = [];
    let i = 0;
    while (i < str.length) {
      const ch = str[i];
      if (/\s/.test(ch)) {
        // 连续空白作为一个 token
        let j = i;
        while (j < str.length && /\s/.test(str[j])) j++;
        tokens.push(str.slice(i, j));
        i = j;
      } else if (/[a-zA-Z0-9_]/.test(ch)) {
        // 标识符作为一个 token
        let j = i;
        while (j < str.length && /[a-zA-Z0-9_]/.test(str[j])) j++;
        tokens.push(str.slice(i, j));
        i = j;
      } else {
        // 其他字符（标点等）每个作为独立 token
        tokens.push(ch);
        i++;
      }
    }
    return tokens;
  };

  const oldTokens = tokenize(oldStr);
  const newTokens = tokenize(newStr);

  // LCS 动态规划
  const m = oldTokens.length;
  const n = newTokens.length;
  
  // 优化：如果 token 太多（>500），退回整行高亮
  if (m + n > 500) {
    return {
      oldSegments: [{ value: oldStr, removed: true }],
      newSegments: [{ value: newStr, added: true }],
    };
  }
  
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯生成 diff segments
  const oldSegments: WordDiffSegment[] = [];
  const newSegments: WordDiffSegment[] = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      oldSegments.unshift({ value: oldTokens[i - 1] });
      newSegments.unshift({ value: newTokens[j - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      newSegments.unshift({ value: newTokens[j - 1], added: true });
      j--;
    } else {
      oldSegments.unshift({ value: oldTokens[i - 1], removed: true });
      i--;
    }
  }

  // 合并相邻同类 segments
  const mergeSegments = (segs: WordDiffSegment[]): WordDiffSegment[] => {
    if (segs.length === 0) return segs;
    const result: WordDiffSegment[] = [segs[0]];
    for (let k = 1; k < segs.length; k++) {
      const prev = result[result.length - 1];
      const curr = segs[k];
      if (prev.added === curr.added && prev.removed === curr.removed) {
        prev.value += curr.value;
      } else {
        result.push(curr);
      }
    }
    return result;
  };

  return {
    oldSegments: mergeSegments(oldSegments),
    newSegments: mergeSegments(newSegments),
  };
}

/**
 * 将 hunk 的行配对（delete 后紧跟 add 视为一组修改）
 * 用于词级 diff 渲染
 */
interface DiffLineGroup {
  type: 'context' | 'delete-only' | 'add-only' | 'modify';
  deleteLines: GitDiffLine[];
  addLines: GitDiffLine[];
}

function groupDiffLines(lines: GitDiffLine[]): DiffLineGroup[] {
  const groups: DiffLineGroup[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.type === 'context') {
      groups.push({ type: 'context', deleteLines: [], addLines: [line] });
      i++;
    } else if (line.type === 'delete') {
      // 收集连续 delete 行
      const deleteLines: GitDiffLine[] = [];
      while (i < lines.length && lines[i].type === 'delete') {
        deleteLines.push(lines[i]);
        i++;
      }
      // 收集紧跟的连续 add 行
      const addLines: GitDiffLine[] = [];
      while (i < lines.length && lines[i].type === 'add') {
        addLines.push(lines[i]);
        i++;
      }
      if (addLines.length > 0) {
        groups.push({ type: 'modify', deleteLines, addLines });
      } else {
        groups.push({ type: 'delete-only', deleteLines, addLines: [] });
      }
    } else if (line.type === 'add') {
      const addLines: GitDiffLine[] = [];
      while (i < lines.length && lines[i].type === 'add') {
        addLines.push(lines[i]);
        i++;
      }
      groups.push({ type: 'add-only', deleteLines: [], addLines });
    } else {
      i++;
    }
  }
  return groups;
}

function getLanguageFromPath(filePath: string | undefined): string {
  if (!filePath) return '';
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', json: 'json', css: 'css', scss: 'css', less: 'less',
    html: 'html', htm: 'html', md: 'markdown', yaml: 'yaml', yml: 'yaml',
    go: 'go', rust: 'rust', rs: 'rust', java: 'java', kotlin: 'kotlin',
    kt: 'kotlin', swift: 'swift', cpp: 'cpp', c: 'c', h: 'cpp',
    hpp: 'cpp', cs: 'csharp', php: 'php', ruby: 'ruby', rb: 'ruby',
    sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
    dockerfile: 'dockerfile', docker: 'dockerfile', sql: 'sql',
    xml: 'xml', svg: 'xml', txt: '', text: '',
  };
  return langMap[ext] || '';
}

// ========== 性能优化缓存 ==========

/** 语法高亮缓存（避免重复调用 hljs） */
const syntaxHighlightCache = new Map<string, string>();
const SYNTAX_CACHE_MAX = 2000;

function getCachedHighlight(content: string, language: string): string {
  const key = `${language}:${content}`;
  let cached = syntaxHighlightCache.get(key);
  if (cached !== undefined) return cached;
  cached = hljs.highlight(content || ' ', { language }).value;
  if (syntaxHighlightCache.size > SYNTAX_CACHE_MAX) {
    // 简单淘汰：清除一半
    let i = 0;
    for (const k of syntaxHighlightCache.keys()) {
      if (i++ > SYNTAX_CACHE_MAX / 2) break;
      syntaxHighlightCache.delete(k);
    }
  }
  syntaxHighlightCache.set(key, cached);
  return cached;
}

/** Word diff 结果缓存 */
const wordDiffCache = new Map<string, { oldSegments: WordDiffSegment[]; newSegments: WordDiffSegment[] }>();
const WORD_DIFF_CACHE_MAX = 500;

/** groupDiffLines 缓存 */
const groupLinesCache = new Map<string, DiffLineGroup[]>();

function getCachedGroupDiffLines(lines: GitDiffLine[]): DiffLineGroup[] {
  // 用第一行内容 + 行数作为缓存键
  const key = `${lines.length}:${lines[0]?.content || ''}:${lines[lines.length - 1]?.content || ''}`;
  let cached = groupLinesCache.get(key);
  if (cached) return cached;
  cached = groupDiffLines(lines);
  if (groupLinesCache.size > 300) groupLinesCache.clear();
  groupLinesCache.set(key, cached);
  return cached;
}

function getCachedWordDiff(oldStr: string, newStr: string): { oldSegments: WordDiffSegment[]; newSegments: WordDiffSegment[] } {
  const key = `${oldStr}\x00${newStr}`;
  let cached = wordDiffCache.get(key);
  if (cached) return cached;
  cached = diffWords(oldStr, newStr);
  if (wordDiffCache.size > WORD_DIFF_CACHE_MAX) {
    let i = 0;
    for (const k of wordDiffCache.keys()) {
      if (i++ > WORD_DIFF_CACHE_MAX / 2) break;
      wordDiffCache.delete(k);
    }
  }
  wordDiffCache.set(key, cached);
  return cached;
}

// ========== 主组件 ==========

function DiffView({ commitOid, filePath, isStaged, onRefresh, onStageFile, onUnstageFile, onDiscardFile }: DiffViewProps) {
  const { t } = useI18();
  const [diff, setDiff] = useState<GitDiff[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [viewMode, setViewMode] = useState<DiffViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(DIFF_VIEW_MODE_KEY);
      if (saved === 'unified' || saved === 'side-by-side') return saved;
    }
    return 'unified';
  });

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchRegex, setSearchRegex] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [diffAlgorithm, setDiffAlgorithm] = useState<'myers' | 'patience' | 'histogram'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('gitgui-diff-algorithm') as any) || 'myers';
    return 'myers';
  });

  const [showWhitespace, setShowWhitespace] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(DIFF_SHOW_WHITESPACE_KEY) === 'true';
    return false;
  });
  
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(DIFF_IGNORE_WHITESPACE_KEY) === 'true';
    return false;
  });
  
  const [syntaxHighlight, setSyntaxHighlight] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(DIFF_SYNTAX_HIGHLIGHT_KEY);
      return saved !== 'false';
    }
    return true;
  });

  // ===== 行级暂存状态 =====
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [stagingLines, setStagingLines] = useState(false);
  const lastClickedLineRef = useRef<number | null>(null);
  const scrollOffsetRef = useRef<number>(0);
  
  const hunkRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const saveSettings = useCallback(() => {
    localStorage.setItem(DIFF_SHOW_WHITESPACE_KEY, String(showWhitespace));
    localStorage.setItem(DIFF_IGNORE_WHITESPACE_KEY, String(ignoreWhitespace));
    localStorage.setItem(DIFF_SYNTAX_HIGHLIGHT_KEY, String(syntaxHighlight));
  }, [showWhitespace, ignoreWhitespace, syntaxHighlight]);

  useEffect(() => { saveSettings(); }, [saveSettings]);

  const handleViewModeChange = useCallback((mode: DiffViewMode) => {
    setViewMode(mode);
    localStorage.setItem(DIFF_VIEW_MODE_KEY, mode);
  }, []);

  // 加载 diff 数据
  useEffect(() => {
    const loadDiff = async () => {
      setLoading(true);
      try {
        let result: GitDiff[];
        if (commitOid) {
          result = await window.electronAPI.git.getFileDiff(commitOid, filePath || undefined);
        } else if (isStaged) {
          result = await window.electronAPI.git.getStagedDiff(filePath || undefined, diffAlgorithm);
        } else {
          result = await window.electronAPI.git.getDiff(filePath || undefined, undefined, diffAlgorithm);
        }
        setDiff(result || []);
      } catch (error) {
        console.error('加载 diff 失败:', error);
        setDiff([]);
      } finally {
        setLoading(false);
      }
    };
    loadDiff();
  }, [commitOid, filePath, isStaged, diffAlgorithm]);

  // 暂存后恢复滚动位置
  useEffect(() => {
    if (contentRef.current && scrollOffsetRef.current > 0) {
      contentRef.current.scrollTop = scrollOffsetRef.current;
      scrollOffsetRef.current = 0;
    }
  }, [diff]);

  // 搜索匹配
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
            matches.push({ fileIndex, hunkIndex, lineIndex, text: line.content, start: match.index, end: match.index + match[0].length });
          }
        });
      });
    });
    return matches;
  }, [diff, searchQuery, searchRegex]);

  const scrollToMatch = useCallback((index: number) => {
    if (searchMatches.length === 0) return;
    const match = searchMatches[index];
    if (!match) return;
    const key = `${match.fileIndex}-${match.hunkIndex}`;
    const hunkEl = hunkRefs.current.get(key);
    if (hunkEl) {
      hunkEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hunkEl.classList.add('hljs-search-highlight');
      setTimeout(() => hunkEl.classList.remove('hljs-search-highlight'), 1000);
    }
  }, [searchMatches]);

  const handleOpenInDiffTool = useCallback(async () => {
    if (filePath) {
      try {
        await window.electronAPI.git.openInDiffTool(filePath);
      } catch (e) {
        console.error('打开外部 Diff 工具失败:', e);
      }
    }
  }, [filePath]);

  // ===== 行级暂存逻辑 =====
  
  // 行选择：支持点击选择、Shift 范围选、Ctrl 切换
  const handleLineClick = useCallback((lineIndex: number, e: React.MouseEvent) => {
    const newSelected = new Set(selectedLines);
    
    if (e.shiftKey && lastClickedLineRef.current !== null) {
      // Shift 范围选
      const start = Math.min(lastClickedLineRef.current, lineIndex);
      const end = Math.max(lastClickedLineRef.current, lineIndex);
      for (let i = start; i <= end; i++) newSelected.add(i);
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl 切换
      if (newSelected.has(lineIndex)) newSelected.delete(lineIndex);
      else newSelected.add(lineIndex);
    } else {
      // 单击
      if (newSelected.size === 1 && newSelected.has(lineIndex)) {
        newSelected.clear();
      } else {
        newSelected.clear();
        newSelected.add(lineIndex);
      }
    }
    
    setSelectedLines(newSelected);
    lastClickedLineRef.current = lineIndex;
  }, [selectedLines]);

  // 全选当前 hunk
  const selectHunk = useCallback((hunkLines: GitDiffLine[], startLineIndex: number) => {
    const newSelected = new Set(selectedLines);
    hunkLines.forEach((line, i) => {
      if (line.type !== 'context') {
        newSelected.add(startLineIndex + i);
      }
    });
    setSelectedLines(newSelected);
  }, [selectedLines]);

  // 执行行级暂存：生成 patch 并 apply
  const handleStageSelectedLines = useCallback(async () => {
    if (selectedLines.size === 0 || !filePath) return;
    
    // 保存滚动位置
    if (contentRef.current) {
      scrollOffsetRef.current = contentRef.current.scrollTop;
    }
    
    setStagingLines(true);
    try {
      // 收集所有 diff 行和全局行号
      let globalLineIndex = 0;
      const patchLines: string[] = [];
      
      for (const fileDiff of diff) {
        for (const hunk of fileDiff.hunks) {
          const hunkStartLine = globalLineIndex;
          
          // 找出本 hunk 中被选中的行
          const selectedInHunk: number[] = [];
          hunk.lines.forEach((line, i) => {
            if (selectedLines.has(hunkStartLine + i) && line.type !== 'context') {
              selectedInHunk.push(i);
            }
          });
          
          if (selectedInHunk.length === 0) {
            globalLineIndex += hunk.lines.length;
            continue;
          }
          
          // 生成部分 hunk：选中行 + 必要的上下文（3行）
          const CONTEXT_LINES = 3;
          const includeIndices = new Set<number>();
          
          for (const idx of selectedInHunk) {
            // 选中行本身
            includeIndices.add(idx);
            // 上下文行
            for (let c = 1; c <= CONTEXT_LINES; c++) {
              if (idx - c >= 0) includeIndices.add(idx - c);
              if (idx + c < hunk.lines.length) includeIndices.add(idx + c);
            }
          }
          
          const sortedIndices = [...includeIndices].sort((a, b) => a - b);
          
          // 计算 hunk header
          let oldStart = hunk.oldStart;
          let newStart = hunk.newStart;
          let oldCount = 0;
          let newCount = 0;
          
          const hunkPatchLines: string[] = [];
          for (const idx of sortedIndices) {
            const line = hunk.lines[idx];
            if (line.type === 'context') {
              hunkPatchLines.push(' ' + line.content);
              oldCount++; newCount++;
            } else if (line.type === 'add' && selectedInHunk.includes(idx)) {
              hunkPatchLines.push('+' + line.content);
              newCount++;
            } else if (line.type === 'delete' && selectedInHunk.includes(idx)) {
              hunkPatchLines.push('-' + line.content);
              oldCount++;
            } else if (line.type === 'add') {
              // 未选中的 add 行变为 context（因为工作区已有）
              hunkPatchLines.push(' ' + line.content);
              newCount++; oldCount++;
            } else if (line.type === 'delete') {
              // 未选中的 delete 行变为 context
              hunkPatchLines.push(' ' + line.content);
              oldCount++; newCount++;
            }
          }
          
          // 补丁头
          if (isStaged) {
            // unstage: 逻辑反转
            patchLines.push(`@@ -${newStart},${newCount} +${oldStart},${oldCount} @@`);
          } else {
            patchLines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
          }
          patchLines.push(...hunkPatchLines);
          
          globalLineIndex += hunk.lines.length;
        }
      }
      
      if (patchLines.length === 0) return;
      
      // 构造完整 patch
      const diffHeader = isStaged
        ? `--- a/${filePath}\n+++ b/${filePath}`
        : `--- a/${filePath}\n+++ b/${filePath}`;
      const patch = diffHeader + '\n' + patchLines.join('\n') + '\n';
      
      // 写入临时文件并通过 git apply
      const tmpPath = `/tmp/majie-patch-${Date.now()}.patch`;
      await window.electronAPI.fs.writeFile(tmpPath, patch);
      
      if (isStaged) {
        // unstage 选中行：git apply -R --cached
        await window.electronAPI.git.applyPatchReverse(tmpPath);
      } else {
        // stage 选中行：git apply --cached
        await window.electronAPI.git.applyPatchCached(tmpPath);
      }
      
      setSelectedLines(new Set());
      onRefresh?.();
    } catch (error) {
      console.error('行级暂存失败:', error);
    } finally {
      setStagingLines(false);
    }
  }, [selectedLines, filePath, diff, isStaged, onRefresh]);

  // ===== 渲染辅助 =====

  const renderWhitespace = (content: string): React.ReactNode => {
    if (!showWhitespace) return <span className="whitespace-pre">{content}</span>;
    const result: React.ReactNode[] = [];
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

  /**
   * 渲染词级 diff 高亮内容
   */
  const renderWordDiff = (
    segments: WordDiffSegment[], 
    lineType: 'delete' | 'add'
  ): React.ReactNode => {
    const highlightClass = lineType === 'delete' ? 'bg-red-600/50' : 'bg-green-600/50';
    return (
      <span className="whitespace-pre">
        {segments.map((seg, i) => {
          if (lineType === 'delete' && seg.removed) {
            return <span key={i} className={highlightClass}>{seg.value}</span>;
          }
          if (lineType === 'add' && seg.added) {
            return <span key={i} className={highlightClass}>{seg.value}</span>;
          }
          return <span key={i}>{seg.value}</span>;
        })}
      </span>
    );
  };

  /**
   * 渲染单行内容（带词级 diff 支持）
   */
  const renderLineContent = (
    line: GitDiffLine,
    wordDiffSegments?: WordDiffSegment[],
    lineType?: 'delete' | 'add'
  ): React.ReactNode => {
    if (syntaxHighlight && fileLanguage && line.type === 'context') {
      return (
        <code
          className={`hljs language-${fileLanguage}`}
          dangerouslySetInnerHTML={{
            __html: getCachedHighlight(line.content || ' ', fileLanguage)
          }}
        />
      );
    }
    
    if (wordDiffSegments && lineType) {
      return renderWordDiff(wordDiffSegments, lineType);
    }
    
    return renderWhitespace(line.content);
  };

  const fileLanguage = useMemo(() => {
    return getLanguageFromPath(filePath || diff[0]?.newPath || diff[0]?.oldPath);
  }, [filePath, diff]);

  // ===== Compute per-file stats =====
  const fileStats = useMemo(() => {
    const stats = new Map<string, { additions: number; deletions: number; hunks: number }>();
    diff.forEach(fd => {
      let add = 0, del = 0;
      fd.hunks.forEach(h => {
        h.lines.forEach(l => {
          if (l.type === 'add') add++;
          else if (l.type === 'delete') del++;
        });
      });
      const key: string = (fd.newPath ?? fd.oldPath) ?? '';
      stats.set(key, { additions: add, deletions: del, hunks: fd.hunks.length });
    });
    return stats;
  }, [diff]);

  // ===== Unified 视图渲染 =====
  
  const renderUnifiedView = () => {
    let globalLineIndex = 0;
    
    return (
      <div style={{ fontFamily: 'ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace', fontSize: 12 }}>
        {diff.map((fileDiff, fileIndex) => {
          const fp: string = (fileDiff.newPath ?? fileDiff.oldPath) ?? '';
          const fstat = fileStats.get(fp);
          const changeType = fileDiff.newPath === '/dev/null' ? 'D' : fileDiff.oldPath === '/dev/null' ? 'A' : 'M';
          const changeColor = changeType === 'D' ? '#e06c75' : changeType === 'A' ? '#4ec9b0' : '#e5c07b';
          return (
          <div key={fileIndex}>
            {/* File header — SourceGit-style */}
            <div style={{
              background: '#252526', color: '#e0e0e0', padding: '6px 12px',
              borderBottom: '1px solid #3c3c3c', position: 'sticky', top: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: changeColor, background: `${changeColor}22`, padding: '1px 6px', borderRadius: 3, fontFamily: 'monospace' }}>
                {changeType}
              </span>
              <span style={{ fontSize: 12, color: '#9cdcfe', fontFamily: 'monospace' }}>{fp}</span>
              {fstat && (
                <span style={{ marginLeft: 'auto', fontSize: 10, display: 'flex', gap: 8 }}>
                  <span style={{ color: '#4ec9b0' }}>+{fstat.additions}</span>
                  <span style={{ color: '#e06c75' }}>-{fstat.deletions}</span>
                  <span style={{ color: '#808080' }}>{fstat.hunks} hunk{fstat.hunks > 1 ? 's' : ''}</span>
                </span>
              )}
            </div>
            
            {fileDiff.hunks.map((hunk, hunkIndex) => {
              const hunkStartLine = globalLineIndex;
              const groups = getCachedGroupDiffLines(hunk.lines);
              let lineIdx = 0;
              
              const hunkContent = groups.map((group, gi) => {
                const content: React.ReactNode[] = [];
                
                if (group.type === 'context') {
                  const line = group.addLines[0];
                  const isSelected = selectedLines.has(hunkStartLine + lineIdx);
                  content.push(
                    <div
                      key={`ctx-${gi}`}
                      style={{ display: 'flex', height: 20, cursor: 'pointer', background: isSelected ? 'rgba(9,71,113,0.4)' : 'transparent' }}
                      className="hover:bg-[#2a2d2e]"
                      onClick={(e) => handleLineClick(hunkStartLine + lineIdx, e)}
                    >
                      <span style={{ width: 3, flexShrink: 0 }} />
                      <span style={{ width: 50, textAlign: 'right', paddingRight: 8, color: '#606060', userSelect: 'none', borderRight: '1px solid #3c3c3c', fontSize: 11, lineHeight: '20px' }}>{line.oldLineNumber || ''}</span>
                      <span style={{ width: 50, textAlign: 'right', paddingRight: 8, color: '#606060', userSelect: 'none', borderRight: '1px solid #3c3c3c', fontSize: 11, lineHeight: '20px' }}>{line.newLineNumber || ''}</span>
                      <span style={{ width: 20, textAlign: 'center', userSelect: 'none', color: '#606060', lineHeight: '20px' }}> </span>
                      <span style={{ flex: 1, paddingLeft: 8, color: '#d4d4d4', whiteSpace: 'pre', lineHeight: '20px' }}>{renderLineContent(line)}</span>
                    </div>
                  );
                  lineIdx++;
                } else if (group.type === 'modify') {
                  const delLines = group.deleteLines;
                  const addLines = group.addLines;
                  const pairCount = Math.max(delLines.length, addLines.length);
                  
                  for (let p = 0; p < pairCount; p++) {
                    const delLine = p < delLines.length ? delLines[p] : null;
                    const addLine = p < addLines.length ? addLines[p] : null;
                    
                    let wordDiff: { oldSegments: WordDiffSegment[]; newSegments: WordDiffSegment[] } | null = null;
                    if (delLine && addLine) {
                      wordDiff = getCachedWordDiff(delLine.content, addLine.content);
                    }
                    
                    if (delLine) {
                      const isSelected = selectedLines.has(hunkStartLine + lineIdx);
                      content.push(
                        <div
                          key={`del-${gi}-${p}`}
                          style={{ display: 'flex', height: 20, cursor: 'pointer', background: isSelected ? 'rgba(9,71,113,0.4)' : 'rgba(248,81,73,0.1)' }}
                          className="hover:bg-red-900/20"
                          onClick={(e) => handleLineClick(hunkStartLine + lineIdx, e)}
                        >
                          <span style={{ width: 3, flexShrink: 0, background: '#e06c75' }} />
                          <span style={{ width: 50, textAlign: 'right', paddingRight: 8, color: '#808080', userSelect: 'none', borderRight: '1px solid #3c3c3c', fontSize: 11, lineHeight: '20px' }}>{delLine.oldLineNumber || ''}</span>
                          <span style={{ width: 50, textAlign: 'right', paddingRight: 8, color: '#808080', userSelect: 'none', borderRight: '1px solid #3c3c3c', fontSize: 11, lineHeight: '20px' }}></span>
                          <span style={{ width: 20, textAlign: 'center', userSelect: 'none', color: '#f48771', fontWeight: 700, lineHeight: '20px' }}>-</span>
                          <span style={{ flex: 1, paddingLeft: 8, color: '#f48771', whiteSpace: 'pre', lineHeight: '20px' }}>
                            {wordDiff ? renderWordDiff(wordDiff.oldSegments, 'delete') : renderWhitespace(delLine.content)}
                          </span>
                        </div>
                      );
                      lineIdx++;
                    }
                    
                    if (addLine) {
                      const isSelected = selectedLines.has(hunkStartLine + lineIdx);
                      content.push(
                        <div
                          key={`add-${gi}-${p}`}
                          style={{ display: 'flex', height: 20, cursor: 'pointer', background: isSelected ? 'rgba(9,71,113,0.4)' : 'rgba(78,201,176,0.08)' }}
                          className="hover:bg-green-900/20"
                          onClick={(e) => handleLineClick(hunkStartLine + lineIdx, e)}
                        >
                          <span style={{ width: 3, flexShrink: 0, background: '#4ec9b0' }} />
                          <span style={{ width: 50, textAlign: 'right', paddingRight: 8, color: '#808080', userSelect: 'none', borderRight: '1px solid #3c3c3c', fontSize: 11, lineHeight: '20px' }}></span>
                          <span style={{ width: 50, textAlign: 'right', paddingRight: 8, color: '#808080', userSelect: 'none', borderRight: '1px solid #3c3c3c', fontSize: 11, lineHeight: '20px' }}>{addLine.newLineNumber || ''}</span>
                          <span style={{ width: 20, textAlign: 'center', userSelect: 'none', color: '#4ec9b0', fontWeight: 700, lineHeight: '20px' }}>+</span>
                          <span style={{ flex: 1, paddingLeft: 8, color: '#4ec9b0', whiteSpace: 'pre', lineHeight: '20px' }}>
                            {wordDiff ? renderWordDiff(wordDiff.newSegments, 'add') : renderWhitespace(addLine.content)}
                          </span>
                        </div>
                      );
                      lineIdx++;
                    }
                  }
                } else if (group.type === 'delete-only') {
                  group.deleteLines.forEach((line, di) => {
                    const isSelected = selectedLines.has(hunkStartLine + lineIdx);
                    content.push(
                      <div
                        key={`delonly-${gi}-${di}`}
                        style={{ display: 'flex', height: 20, cursor: 'pointer', background: isSelected ? 'rgba(9,71,113,0.4)' : 'rgba(248,81,73,0.1)' }}
                        className="hover:bg-red-900/20"
                        onClick={(e) => handleLineClick(hunkStartLine + lineIdx, e)}
                      >
                        <span style={{ width: 3, flexShrink: 0, background: '#e06c75' }} />
                        <span style={{ width: 50, textAlign: 'right', paddingRight: 8, color: '#808080', userSelect: 'none', borderRight: '1px solid #3c3c3c', fontSize: 11, lineHeight: '20px' }}>{line.oldLineNumber || ''}</span>
                        <span style={{ width: 50, textAlign: 'right', paddingRight: 8, color: '#808080', userSelect: 'none', borderRight: '1px solid #3c3c3c', fontSize: 11, lineHeight: '20px' }}></span>
                        <span style={{ width: 20, textAlign: 'center', userSelect: 'none', color: '#f48771', fontWeight: 700, lineHeight: '20px' }}>-</span>
                        <span style={{ flex: 1, paddingLeft: 8, color: '#f48771', whiteSpace: 'pre', lineHeight: '20px' }}>{renderWhitespace(line.content)}</span>
                      </div>
                    );
                    lineIdx++;
                  });
                } else if (group.type === 'add-only') {
                  group.addLines.forEach((line, ai) => {
                    const isSelected = selectedLines.has(hunkStartLine + lineIdx);
                    content.push(
                      <div
                        key={`addonly-${gi}-${ai}`}
                        style={{ display: 'flex', height: 20, cursor: 'pointer', background: isSelected ? 'rgba(9,71,113,0.4)' : 'rgba(78,201,176,0.08)' }}
                        className="hover:bg-green-900/20"
                        onClick={(e) => handleLineClick(hunkStartLine + lineIdx, e)}
                      >
                        <span style={{ width: 3, flexShrink: 0, background: '#4ec9b0' }} />
                        <span style={{ width: 50, textAlign: 'right', paddingRight: 8, color: '#808080', userSelect: 'none', borderRight: '1px solid #3c3c3c', fontSize: 11, lineHeight: '20px' }}></span>
                        <span style={{ width: 50, textAlign: 'right', paddingRight: 8, color: '#808080', userSelect: 'none', borderRight: '1px solid #3c3c3c', fontSize: 11, lineHeight: '20px' }}>{line.newLineNumber || ''}</span>
                        <span style={{ width: 20, textAlign: 'center', userSelect: 'none', color: '#4ec9b0', fontWeight: 700, lineHeight: '20px' }}>+</span>
                        <span style={{ flex: 1, paddingLeft: 8, color: '#4ec9b0', whiteSpace: 'pre', lineHeight: '20px' }}>{renderWhitespace(line.content)}</span>
                      </div>
                    );
                    lineIdx++;
                  });
                }
                
                return <React.Fragment key={gi}>{content}</React.Fragment>;
              });
              
              globalLineIndex += hunk.lines.length;
              
              return (
                <div key={`${fileIndex}-${hunkIndex}`} ref={(el) => {
                  if (el) hunkRefs.current.set(`${fileIndex}-${hunkIndex}`, el);
                }}>
                  {/* Hunk header — SourceGit style */}
                  <div
                    style={{
                      background: 'rgba(59,130,246,0.08)', color: '#569cd6',
                      padding: '3px 12px', fontSize: 10, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      borderBottom: '1px solid rgba(59,130,246,0.15)',
                    }}
                    className="hover:bg-blue-900/15"
                    onClick={() => selectHunk(hunk.lines, hunkStartLine)}
                    title="Click to select entire hunk"
                  >
                    <span style={{ fontFamily: 'monospace', letterSpacing: 0.5 }}>@@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@</span>
                    <span style={{ marginLeft: 'auto', color: '#606060', fontSize: 9 }}>select</span>
                  </div>
                  {hunkContent}
                </div>
              );
            })}
          </div>
          );
        })}
      </div>
    );
  };

  // ===== Side-by-Side 视图渲染 =====
  
  const renderSideBySideView = () => {
    return (
      <div className="flex flex-1 overflow-hidden">
        {/* 左面板（old） */}
        <div ref={leftPanelRef} className="flex-1 overflow-auto border-r border-[#3c3c3c] font-mono text-sm"
          onScroll={(e) => {
            if (isScrollingRef.current) return;
            isScrollingRef.current = true;
            rightPanelRef.current?.scrollTo({ top: (e.target as HTMLDivElement).scrollTop });
            setTimeout(() => { isScrollingRef.current = false; }, 50);
          }}
        >
          {diff.map((fileDiff, fi) => (
            <div key={fi}>
              {fileDiff.hunks.map((hunk, hi) => (
                <SideBySideHunk
                  key={`${fi}-${hi}`}
                  hunk={hunk}
                  side="old"
                  fileLanguage={fileLanguage}
                  showWhitespace={showWhitespace}
                  syntaxHighlight={syntaxHighlight}
                  selectedLines={selectedLines}
                  onLineClick={handleLineClick}
                  globalLineOffset={0}
                  renderWhitespace={renderWhitespace}
                  diffWords={diffWords}
                  renderWordDiff={renderWordDiff}
                />
              ))}
            </div>
          ))}
        </div>
        {/* 右面板（new） */}
        <div ref={rightPanelRef} className="flex-1 overflow-auto font-mono text-sm"
          onScroll={(e) => {
            if (isScrollingRef.current) return;
            isScrollingRef.current = true;
            leftPanelRef.current?.scrollTo({ top: (e.target as HTMLDivElement).scrollTop });
            setTimeout(() => { isScrollingRef.current = false; }, 50);
          }}
        >
          {diff.map((fileDiff, fi) => (
            <div key={fi}>
              {fileDiff.hunks.map((hunk, hi) => (
                <SideBySideHunk
                  key={`${fi}-${hi}`}
                  hunk={hunk}
                  side="new"
                  fileLanguage={fileLanguage}
                  showWhitespace={showWhitespace}
                  syntaxHighlight={syntaxHighlight}
                  selectedLines={selectedLines}
                  onLineClick={handleLineClick}
                  globalLineOffset={0}
                  renderWhitespace={renderWhitespace}
                  diffWords={diffWords}
                  renderWordDiff={renderWordDiff}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ===== P2-1: Diff Minimap 数据 =====
  const [showMinimap, setShowMinimap] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('majie-diff-minimap') !== 'false';
    return true;
  });

  const minimapData = useMemo(() => {
    const markers: Array<{ lineIndex: number; type: 'add' | 'delete' | 'context' | 'conflict' }> = [];
    let idx = 0;
    diff.forEach(fileDiff => {
      fileDiff.hunks.forEach(hunk => {
        hunk.lines.forEach(line => {
          if (line.type === 'add') markers.push({ lineIndex: idx, type: 'add' });
          else if (line.type === 'delete') markers.push({ lineIndex: idx, type: 'delete' });
          else if (line.type === 'conflict') markers.push({ lineIndex: idx, type: 'conflict' });
          else markers.push({ lineIndex: idx, type: 'context' });
          idx++;
        });
      });
    });
    return { totalLines: idx, markers };
  }, [diff]);

  // P2-2: 滚动条冲突/变更标记
  const scrollbarMarkers = useMemo(() => {
    if (!contentRef.current || minimapData.totalLines === 0) return [];
    const markers: Array<{ top: number; height: number; color: string }> = [];
    let idx = 0;
    diff.forEach(fileDiff => {
      fileDiff.hunks.forEach(hunk => {
        let hunkStart = idx;
        let addCount = 0, delCount = 0, conflictCount = 0;
        hunk.lines.forEach(line => {
          if (line.type === 'add') addCount++;
          else if (line.type === 'delete') delCount++;
          else if ((line as any).type === 'conflict') conflictCount++;
          idx++;
        });
        const hunkLen = idx - hunkStart;
        if (conflictCount > 0) {
          markers.push({ top: hunkStart / minimapData.totalLines * 100, height: Math.max(hunkLen / minimapData.totalLines * 100, 0.5), color: '#e8a847' });
        } else if (addCount > 0 || delCount > 0) {
          markers.push({ top: hunkStart / minimapData.totalLines * 100, height: Math.max(hunkLen / minimapData.totalLines * 100, 0.3), color: addCount > delCount ? '#3fb95044' : '#f8514944' });
        }
      });
    });
    return markers;
  }, [diff, minimapData.totalLines]);

  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!contentRef.current || minimapData.totalLines === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const fraction = y / rect.height;
    contentRef.current.scrollTop = fraction * contentRef.current.scrollHeight;
  }, [minimapData.totalLines]);

  // ===== P2-4: ↩︎ 段落级修改标记 =====
  const paragraphMarkers = useMemo(() => {
    // 标记连续删除+新增块之间插入 ↩︎ 标记
    const markers: Array<{ lineIndex: number; label: string }> = [];
    let idx = 0;
    diff.forEach(fileDiff => {
      fileDiff.hunks.forEach(hunk => {
        const groups = groupDiffLines(hunk.lines);
        for (const group of groups) {
          if (group.type === 'modify') {
            markers.push({ lineIndex: idx + group.deleteLines.length, label: '↩' });
          }
          idx += group.deleteLines.length + group.addLines.length;
          if (group.type === 'context') idx++;
        }
      });
    });
    return markers;
  }, [diff]);

  // ===== 主渲染 =====
  
  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400">{t('common.loading')}</div>;
  }

  if (diff.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No changes</div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#252526] border-b border-[#3c3c3c]">
        {/* 视图模式切换 */}
        <div className="flex rounded overflow-hidden border border-[#3c3c3c]">
          <button
            className={`px-2 py-1 text-xs ${viewMode === 'unified' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            onClick={() => handleViewModeChange('unified')}
          >Unified</button>
          <button
            className={`px-2 py-1 text-xs ${viewMode === 'side-by-side' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            onClick={() => handleViewModeChange('side-by-side')}
          >Split</button>
        </div>

        {/* 搜索 */}
        <button
          className="p-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          onClick={() => { setShowSearch(!showSearch); if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 100); }}
          title="Search (Ctrl+Shift+S)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </button>

        <div className="h-4 w-px bg-gray-700" />

        {/* 空白显示 */}
        <button className={`p-1.5 rounded transition-colors ${showWhitespace ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          onClick={() => setShowWhitespace(!showWhitespace)} title="Show Whitespace">
          <span className="text-xs font-mono">¶</span>
        </button>

        {/* 忽略空白 */}
        <button className={`p-1.5 rounded transition-colors ${ignoreWhitespace ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          onClick={() => setIgnoreWhitespace(!ignoreWhitespace)} title="Ignore Whitespace">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>

        {/* 语法高亮 */}
        <button className={`p-1.5 rounded transition-colors ${syntaxHighlight ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          onClick={() => setSyntaxHighlight(!syntaxHighlight)} title="Syntax Highlight">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
        </button>

        {/* P2-1: Minimap 开关 */}
        <button className={`p-1.5 rounded transition-colors ${showMinimap ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          onClick={() => { setShowMinimap(!showMinimap); localStorage.setItem('majie-diff-minimap', String(!showMinimap)); }} title="Toggle Minimap">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>

        {/* Diff 算法选择 */}
        <select
          className="text-xs bg-gray-700 text-gray-300 border border-gray-600 rounded px-1 py-1 outline-none"
          value={diffAlgorithm}
          onChange={(e) => { setDiffAlgorithm(e.target.value as any); localStorage.setItem('gitgui-diff-algorithm', e.target.value); }}
          title="Diff Algorithm"
        >
          <option value="myers">Myers</option>
          <option value="patience">Patience</option>
          <option value="histogram">Histogram</option>
        </select>

        {/* 外部工具 */}
        <button className="p-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          onClick={handleOpenInDiffTool} title="Open in External Tool">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </button>

        {/* Per-file Stage/Unstage/Discard (Fork-style, working dir only) */}
        {!commitOid && filePath && (
          <>
            <div className="h-4 w-px bg-gray-700" />
            {isStaged ? (
              <button
                className="px-3 py-1 text-xs rounded transition-colors"
                style={{ background: '#3c3c3c', color: '#e0e0e0' }}
                onClick={() => onUnstageFile?.(filePath)}
              >Unstage</button>
            ) : (
              <button
                className="px-3 py-1 text-xs rounded transition-colors"
                style={{ background: '#0e7a0d', color: '#fff' }}
                onClick={() => onStageFile?.(filePath)}
              >Stage</button>
            )}
            <button
              className="px-3 py-1 text-xs rounded transition-colors"
              style={{ background: 'transparent', color: '#f44747', border: '1px solid #f44747' }}
              onClick={() => {
                if (window.confirm(`Discard changes in ${filePath}?`)) {
                  onDiscardFile?.(filePath);
                }
              }}
            >Discard</button>
          </>
        )}

        {/* 行级暂存按钮 */}
        {selectedLines.size > 0 && (
          <>
            <div className="h-4 w-px bg-gray-700" />
            <span className="text-xs text-gray-400">{selectedLines.size} 行选中</span>
            <button
              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              disabled={stagingLines}
              onClick={handleStageSelectedLines}
            >
              {stagingLines ? '⏳' : isStaged ? '↩ Unstage Lines' : '✓ Stage Lines'}
            </button>
            <button
              className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
              onClick={() => setSelectedLines(new Set())}
            >Cancel</button>
          </>
        )}

        <div className="flex-1" />
        <div className="text-xs text-gray-500">
          <kbd className="px-1 py-0.5 bg-gray-700 rounded">Ctrl+Shift+S</kbd>
        </div>
      </div>

      {/* 搜索栏 */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-panel-border">
          <input ref={searchInputRef} type="text"
            className="flex-1 px-3 py-1 bg-gray-700 text-white text-sm rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Search in diff..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentMatchIndex(0); }}
          />
          <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={searchRegex} onChange={(e) => setSearchRegex(e.target.checked)} className="rounded" />
            Regex
          </label>
          <span className="text-xs text-gray-400 min-w-[60px] text-center">
            {searchMatches.length > 0 ? `${currentMatchIndex + 1}/${searchMatches.length}` : searchQuery ? 'No results' : ''}
          </span>
          <button className="p-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
            disabled={searchMatches.length === 0}
            onClick={() => { const prev = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length; setCurrentMatchIndex(prev); scrollToMatch(prev); }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
          <button className="p-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
            disabled={searchMatches.length === 0}
            onClick={() => { const next = (currentMatchIndex + 1) % searchMatches.length; setCurrentMatchIndex(next); scrollToMatch(next); }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <button className="p-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
            onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Diff 内容 + P2-1 Minimap + P2-2 Scrollbar Markers */}
      <div className="flex-1 overflow-hidden flex">
        {/* P2-2: 滚动条冲突/变更标记（左侧窄条） */}
        <div style={{ position: 'relative', width: 6, background: '#1a1a2e', flexShrink: 0, cursor: 'pointer' }}
          onClick={(e) => {
            if (!contentRef.current || minimapData.totalLines === 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const fraction = (e.clientY - rect.top) / rect.height;
            contentRef.current.scrollTop = fraction * contentRef.current.scrollHeight;
          }}
        >
          {scrollbarMarkers.map((m, i) => (
            <div key={i} style={{ position: 'absolute', top: `${m.top}%`, height: `${Math.max(m.height, 0.3)}%`, left: 0, right: 0, background: m.color, borderRadius: 1 }} />
          ))}
        </div>

        {/* 主 Diff 内容 */}
        <div ref={contentRef} className="flex-1 overflow-auto">
          {viewMode === 'unified' ? renderUnifiedView() : renderSideBySideView()}
        </div>

        {/* P2-1: Diff Minimap（右侧迷你地图） */}
        {showMinimap && minimapData.totalLines > 0 && (
          <canvas
            width={40}
            height={Math.min(minimapData.totalLines * 2, 600)}
            onClick={handleMinimapClick}
            style={{ width: 40, flexShrink: 0, background: '#0d1117', borderLeft: '1px solid #21262d', cursor: 'pointer', alignSelf: 'stretch' }}
            ref={(canvas) => {
              if (!canvas) return;
              const ctx = canvas.getContext('2d');
              if (!ctx) return;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              const lineH = canvas.height / minimapData.totalLines;
              minimapData.markers.forEach(m => {
                const y = m.lineIndex * lineH;
                ctx.fillStyle = m.type === 'add' ? '#3fb95066' : m.type === 'delete' ? '#f8514966' : m.type === 'conflict' ? '#e8a84788' : '#30363d44';
                ctx.fillRect(0, y, canvas.width, Math.max(lineH, 0.5));
              });
            }}
          />
        )}
      </div>
    </div>
  );
}

// ========== Side-by-Side Hunk 组件 ==========

interface SideBySideHunkProps {
  hunk: GitDiffHunk;
  side: 'old' | 'new';
  fileLanguage: string;
  showWhitespace: boolean;
  syntaxHighlight: boolean;
  selectedLines: Set<number>;
  onLineClick: (lineIndex: number, e: React.MouseEvent) => void;
  globalLineOffset: number;
  renderWhitespace: (content: string) => React.ReactNode;
  diffWords: (oldStr: string, newStr: string) => { oldSegments: WordDiffSegment[]; newSegments: WordDiffSegment[] };
  renderWordDiff: (segments: WordDiffSegment[], lineType: 'delete' | 'add') => React.ReactNode;
}

const SideBySideHunk = React.memo(function SideBySideHunk({
  hunk, side, fileLanguage, showWhitespace, syntaxHighlight,
  selectedLines, onLineClick, globalLineOffset,
  renderWhitespace, diffWords, renderWordDiff,
}: SideBySideHunkProps) {
  const groups = groupDiffLines(hunk.lines);
  let lineIdx = 0;

  return (
    <div>
      {/* Hunk header */}
      <div className="bg-blue-900/20 text-blue-400 px-2 py-1 sticky left-0">
        <span className="text-[10px]">@@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@</span>
      </div>

      {groups.map((group, gi) => {
        const content: React.ReactNode[] = [];

        if (group.type === 'context') {
          const line = group.addLines[0];
          const isSelected = selectedLines.has(globalLineOffset + lineIdx);
          content.push(
            <div key={`ctx-${gi}`}
              className={`flex h-5 cursor-pointer hover:bg-[#2a2d2e] ${isSelected ? 'bg-blue-900/30' : ''}`}
              onClick={(e) => onLineClick(globalLineOffset + lineIdx, e)}
            >
              <span className="w-10 text-right pr-2 text-gray-600 select-none border-r border-panel-border">
                {side === 'old' ? (line.oldLineNumber || '') : (line.newLineNumber || '')}
              </span>
              <span className="w-5 text-center select-none text-gray-500"> </span>
              <span className="flex-1 px-2 text-gray-300">{renderWhitespace(line.content)}</span>
            </div>
          );
          lineIdx++;
        } else if (group.type === 'modify') {
          const delLines = group.deleteLines;
          const addLines = group.addLines;
          const pairCount = Math.max(delLines.length, addLines.length);

          for (let p = 0; p < pairCount; p++) {
            const delLine = p < delLines.length ? delLines[p] : null;
            const addLine = p < addLines.length ? addLines[p] : null;
            
            let wordDiff: { oldSegments: WordDiffSegment[]; newSegments: WordDiffSegment[] } | null = null;
            if (delLine && addLine) {
              wordDiff = diffWords(delLine.content, addLine.content);
            }

            if ((side === 'old' && delLine) || (side === 'new' && !addLine)) {
              const line = delLine!;
              const isSelected = selectedLines.has(globalLineOffset + lineIdx);
              content.push(
                <div key={`del-${gi}-${p}`}
                  className={`flex h-5 bg-red-900/20 cursor-pointer hover:bg-red-900/30 ${isSelected ? 'bg-blue-900/30' : ''}`}
                  onClick={(e) => onLineClick(globalLineOffset + lineIdx, e)}
                >
                  <span className="w-10 text-right pr-2 text-gray-600 select-none border-r border-panel-border">{line.oldLineNumber || ''}</span>
                  <span className="w-5 text-center select-none text-red-400 font-bold">-</span>
                  <span className="flex-1 px-2 text-red-400">
                    {wordDiff ? renderWordDiff(wordDiff.oldSegments, 'delete') : renderWhitespace(line.content)}
                  </span>
                </div>
              );
              lineIdx++;
            }
            if ((side === 'new' && addLine) || (side === 'old' && !delLine)) {
              const line = addLine!;
              const isSelected = selectedLines.has(globalLineOffset + lineIdx);
              content.push(
                <div key={`add-${gi}-${p}`}
                  className={`flex h-5 bg-green-900/20 cursor-pointer hover:bg-green-900/30 ${isSelected ? 'bg-blue-900/30' : ''}`}
                  onClick={(e) => onLineClick(globalLineOffset + lineIdx, e)}
                >
                  <span className="w-10 text-right pr-2 text-gray-600 select-none border-r border-panel-border">{line.newLineNumber || ''}</span>
                  <span className="w-5 text-center select-none text-green-400 font-bold">+</span>
                  <span className="flex-1 px-2 text-green-400">
                    {wordDiff ? renderWordDiff(wordDiff.newSegments, 'add') : renderWhitespace(line.content)}
                  </span>
                </div>
              );
              lineIdx++;
            }
          }
        } else if (group.type === 'delete-only') {
          group.deleteLines.forEach((line, di) => {
            if (side === 'old') {
              const isSelected = selectedLines.has(globalLineOffset + lineIdx);
              content.push(
                <div key={`delonly-${gi}-${di}`}
                  className={`flex h-5 bg-red-900/20 cursor-pointer hover:bg-red-900/30 ${isSelected ? 'bg-blue-900/30' : ''}`}
                  onClick={(e) => onLineClick(globalLineOffset + lineIdx, e)}
                >
                  <span className="w-10 text-right pr-2 text-gray-600 select-none border-r border-panel-border">{line.oldLineNumber || ''}</span>
                  <span className="w-5 text-center select-none text-red-400 font-bold">-</span>
                  <span className="flex-1 px-2 text-red-400">{renderWhitespace(line.content)}</span>
                </div>
              );
            } else {
              content.push(<div key={`delonly-${gi}-${di}`} className="flex h-5 bg-gray-900/20"><span className="w-10 text-right pr-2 border-r border-panel-border" /><span className="w-5" /><span className="flex-1" /></div>);
            }
            lineIdx++;
          });
        } else if (group.type === 'add-only') {
          group.addLines.forEach((line, ai) => {
            if (side === 'new') {
              const isSelected = selectedLines.has(globalLineOffset + lineIdx);
              content.push(
                <div key={`addonly-${gi}-${ai}`}
                  className={`flex h-5 bg-green-900/20 cursor-pointer hover:bg-green-900/30 ${isSelected ? 'bg-blue-900/30' : ''}`}
                  onClick={(e) => onLineClick(globalLineOffset + lineIdx, e)}
                >
                  <span className="w-10 text-right pr-2 text-gray-600 select-none border-r border-panel-border">{line.newLineNumber || ''}</span>
                  <span className="w-5 text-center select-none text-green-400 font-bold">+</span>
                  <span className="flex-1 px-2 text-green-400">{renderWhitespace(line.content)}</span>
                </div>
              );
            } else {
              content.push(<div key={`addonly-${gi}-${ai}`} className="flex h-5 bg-gray-900/20"><span className="w-10 text-right pr-2 border-r border-panel-border" /><span className="w-5" /><span className="flex-1" /></div>);
            }
            lineIdx++;
          });
        }

        return <React.Fragment key={gi}>{content}</React.Fragment>;
      })}
    </div>
  );
});

// 搜索高亮样式
const style = document.createElement('style');
style.textContent = `
  .hljs-search-highlight { animation: highlight-flash 1s ease-out; }
  @keyframes highlight-flash { 0% { background-color: rgba(59, 130, 246, 0.5); } 100% { background-color: transparent; } }
`;
document.head.appendChild(style);

export default React.memo(DiffView);
export type { DiffViewProps, WordDiffSegment };
