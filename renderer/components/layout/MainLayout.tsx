/**
 * 主布局组件
 * Fork 风格三栏并列：左 Sidebar → 中 CommitGraph+List → 右 Detail(FileTree+Diff)
 * CommitBar 在右栏底部常驻
 * 支持左右拖拽调整列宽
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import CommitGraph from '../graph/CommitGraph';
import StatusPanel from '../commit/StatusPanel';
import DiffView from '../diff/DiffView';
import CommitBar from '../commitbar/CommitBar';
import CommitFilterBar from '../filter/CommitFilterBar';
import CommitDetailPanel, { getFileDiff } from '../commitdetail/CommitDetailPanel';
import DiffFileTree from '../difftree/DiffFileTree';
import ChangesFileTree from '../changes/ChangesFileTree';
import RepositoryFileTree from '../filetree/RepositoryFileTree';
import LocalChangesPanel from './LocalChangesPanel';
import FileHistory from '../filehistory/FileHistory';
import CherryPickDialog from '../operations/CherryPickDialog';
import { PushDialog, PullDialog, FetchDialog } from '../operations/PushPullDialog';
import InteractiveRebaseDialog from '../rebase/InteractiveRebaseDialog';
import StashDialog from '../stash/StashDialog';
import BlameView from '../blame/BlameView';
import ConflictResolutionPanel from '../conflict/ConflictResolutionPanel';
import ConflictWarningDialog from '../conflict/ConflictWarningDialog';
import ReflogPanel from '../reflog/ReflogPanel';
import ReflogVisualPanel from '../reflogvisual/ReflogVisualPanel';
import TerminalPanel from '../terminal/TerminalPanel';
import GiteePanel from '../gitee/GiteePanel';
import TagPanel from '../branch/TagPanel';
import CommandPreviewDialog, { getGitCommandPreview, shouldShowPreview } from '../commandpreview/CommandPreviewDialog';
import ShortcutsDialog from '../shortcuts/ShortcutsDialog';
import { DragDropProvider } from '../dragdrop/DragDropContext';
import { useRepoStore } from '../../stores/repoStore';
import { useI18, formatDate } from '../../i18n';
import { zhCN } from '../../i18n/zh-CN';

function MainLayout() {
  const { t } = useI18();
  const [graphSearch, setGraphSearch] = useState('');
  const [graphDateFilter, setGraphDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [showCherryPick, setShowCherryPick] = useState(false);
  const [cherryPickOid, setCherryPickOid] = useState<string | undefined>();
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [showPushPull, setShowPushPull] = useState<'push' | 'pull' | 'fetch' | null>(null);
  const [showRebase, setShowRebase] = useState(false);
  const [rebaseOid, setRebaseOid] = useState<string>();
  const [showStashDialog, setShowStashDialog] = useState(false);
  const [showBlame, setShowBlame] = useState(false);
  const [blameFilePath, setBlameFilePath] = useState<string>();
  const [showConflict, setShowConflict] = useState(false);
  const [conflictType, setConflictType] = useState<'merge' | 'rebase' | 'cherry-pick'>('merge');
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [conflictWarningData, setConflictWarningData] = useState<{ type: string; branch: string; files: string[] }>({ type: '', branch: '', files: [] });
  const [showReflog, setShowReflog] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showGitee, setShowGitee] = useState(false);
  const [showReflogVisual, setShowReflogVisual] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCmdPreview, setShowCmdPreview] = useState(false);
  const [pendingCmdAction, setPendingCmdAction] = useState<(() => void) | null>(null);
  const [cmdPreviewCommands, setCmdPreviewCommands] = useState<any[]>([]);
  const [autoFetchInterval, setAutoFetchInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  
  // 右栏标签页状态
  const [rightPanelTab, setRightPanelTab] = useState<'commit' | 'changes' | 'filetree'>('changes');

  const {
    commits,
    filteredCommits,
    branches,
    status,
    currentRepo,
    refresh,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    authorStats,
    commitFilter,
    updateCommitFilter,
    clearCommitFilter,
    fileHistory,
    showFileHistory,
    setShowFileHistory,
    selectedCommitDetail,
    showCommitDetail,
    setShowCommitDetail,
    getFileHistory,
    getCommitDetail,
    setupWatcher,
  } = useRepoStore();

  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [fileDiff, setFileDiff] = useState<Array<{
    oldLine?: number;
    newLine?: number;
    type: 'add' | 'remove' | 'keep' | 'header';
    content: string;
  }> | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // 加载文件 diff
  useEffect(() => {
    if (selectedFile && selectedCommit) {
      getFileDiff(selectedCommit, selectedFile).then(diff => {
        setFileDiff(diff);
      });
    } else {
      setFileDiff(null);
    }
  }, [selectedFile, selectedCommit]);

  // 加载文件内容
  useEffect(() => {
    if (selectedFile && rightPanelTab === 'filetree') {
      setIsLoadingContent(true);
      // 使用 fs.readFile 读取工作目录中的文件
      const fullPath = currentRepo?.path 
        ? `${currentRepo.path.replace(/\\/g, '/')}/${selectedFile.replace(/\\/g, '/')}`
        : selectedFile.replace(/\\/g, '/');
      console.log('[FileTree] 加载文件:', fullPath);
      window.electronAPI.fs.readFile(fullPath)
        .then(content => {
          console.log('[FileTree] 文件加载成功, 长度:', content.length);
          setFileContent(content);
          setIsLoadingContent(false);
        })
        .catch(err => {
          console.error('[FileTree] 读取文件失败:', err);
          setFileContent(`// 无法读取文件: ${err.message}\n路径: ${fullPath}`);
          setIsLoadingContent(false);
        });
    } else if (rightPanelTab === 'filetree') {
      setFileContent(null);
    }
  }, [selectedFile, rightPanelTab, currentRepo?.path]);

  // 三栏比例状态：中栏占比
  const [centerRatio, setCenterRatio] = useState(0.38);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingCenterRef = useRef(false);

  // 右栏内部上下分栏：详情/文件树 占比
  const [detailRatio, setDetailRatio] = useState(0.35);
  const isDraggingDetailRef = useRef(false);

  // 拖拽：中栏/右栏分隔线
  const handleCenterMouseDown = useCallback(() => {
    isDraggingCenterRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // 拖拽：右栏内部详情/Diff分隔线
  const handleDetailMouseDown = useCallback(() => {
    isDraggingDetailRef.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingCenterRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        setCenterRatio(Math.min(Math.max(ratio, 0.2), 0.6));
      }
      if (isDraggingDetailRef.current) {
        // 右栏内部拖拽，基于右栏高度
        const rightPanel = document.getElementById('right-panel');
        if (rightPanel) {
          const rect = rightPanel.getBoundingClientRect();
          const ratio = (e.clientY - rect.top) / rect.height;
          setDetailRatio(Math.min(Math.max(ratio, 0.15), 0.6));
        }
      }
    };

    const handleMouseUp = () => {
      isDraggingCenterRef.current = false;
      isDraggingDetailRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // 处理提交选择
  const handleCommitSelect = useCallback(async (oid: string | null) => {
    setSelectedCommit(oid);
    setSelectedFile(null);
    if (oid) {
      await getCommitDetail(oid);
    } else {
      setShowCommitDetail(false);
    }
  }, [getCommitDetail, setShowCommitDetail]);

  const handleRefresh = async () => { await refresh(); };

  const handleCommit = async (message: string, options?: { amend?: boolean; sign?: boolean }) => {
    setIsCommitting(true);
    try {
      await window.electronAPI.git.commit(message, { amend: options?.amend, sign: options?.sign });
      await refresh();
    } catch (error) {
      console.error('提交失败:', error);
      throw error;
    } finally {
      setIsCommitting(false);
    }
  };

  const handleStage = async (path: string) => { await stageFile(path); };
  const handleUnstage = async (path: string) => { await unstageFile(path); };
  const handleStageAll = async () => { await stageAll(); };
  const handleUnstageAll = async () => { await unstageAll(); };
  const handleViewFileHistory = async (filePath: string) => { await getFileHistory(filePath); };
  const handleViewFileDiff = (oid: string, filePath: string) => {
    setSelectedFile(filePath);
    setSelectedCommit(oid);
  };

  // 监听侧边栏变更面板事件
  useEffect(() => {
    const handleSidebarFileSelect = (e: Event) => {
      const path = (e as CustomEvent).detail as string;
      setSelectedFile(path);
      setSelectedCommit(null);
    };
    const handleSidebarCommit = async (e: Event) => {
      const message = (e as CustomEvent).detail as string;
      try {
        await handleCommit(message);
      } catch (err) {
        console.error('[MainLayout] 侧边栏提交失败:', err);
      }
    };
    window.addEventListener('sidebar:fileSelect', handleSidebarFileSelect);
    window.addEventListener('sidebar:commit', handleSidebarCommit);
    return () => {
      window.removeEventListener('sidebar:fileSelect', handleSidebarFileSelect);
      window.removeEventListener('sidebar:commit', handleSidebarCommit);
    };
  }, []);

  // 右键菜单回调 → 触发专业弹窗
  const handleCreateBranch = useCallback((oid: string) => {
    window.dispatchEvent(new CustomEvent('showDialog:newBranch', { detail: { defaultBase: oid } }));
  }, []);

  const handleCreateTag = useCallback((oid: string) => {
    window.dispatchEvent(new CustomEvent('showDialog:newTag', { detail: { defaultRef: oid } }));
  }, []);

  const handleCheckout = useCallback(async (oid: string) => {
    await window.electronAPI.git.checkout(oid); await refresh();
  }, [refresh]);

  const handleReset = useCallback(async (oid: string) => {
    await window.electronAPI.git.checkout(oid); await refresh();
  }, [refresh]);

  const handleCherryPick = useCallback((oid: string) => {
    setCherryPickOid(oid); setShowCherryPick(true);
  }, []);

  const handleRevert = useCallback(async (oid: string) => {
    try { await window.electronAPI.git.revert(oid); await refresh(); } catch (err) { console.error('Revert failed:', err); }
  }, []);

  const handleSavePatch = useCallback(async (oid: string) => {
    try { await window.electronAPI.git.createPatch([oid]); alert('Patch 已创建'); } catch (e: any) { alert('创建 Patch 失败: ' + e.message); }
  }, []);

  const handleInteractiveRebase = useCallback(async (oid: string, _action: 'reword' | 'squash' | 'fixup' | 'drop') => {
    setRebaseOid(oid); setShowRebase(true);
  }, []);

  // 自动 Fetch（每 5 分钟）
  useEffect(() => {
    if (currentRepo) {
      const interval = setInterval(async () => {
        try { await window.electronAPI.git.fetch(); } catch (e) { /* silent */ }
      }, 5 * 60 * 1000);
      setAutoFetchInterval(interval);
      return () => clearInterval(interval);
    } else {
      if (autoFetchInterval) clearInterval(autoFetchInterval);
    }
  }, [currentRepo]);

  // 启动文件监听器（SourceGit 模式：.git 变更自动刷新）
  useEffect(() => {
    setupWatcher();
  }, []);

  // 快捷键 ? 弹出速查表
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        setShowShortcuts(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // 执行 Git 操作（带命令预览）
  const executeGitAction = useCallback((action: string, params: Record<string, any>, callback: () => void) => {
    const commands = getGitCommandPreview(action, params);
    if (commands.length > 0 && shouldShowPreview(commands[0].category)) {
      setCmdPreviewCommands(commands);
      setPendingCmdAction(() => callback);
      setShowCmdPreview(true);
    } else {
      callback();
    }
  }, []);

  // Amend Last Commit
  const handleAmendCommit = useCallback(async () => {
    const callback = async () => {
      try { await window.electronAPI.git.commit('', { amend: true }); await refresh(); } catch (e: any) { alert('Amend 失败: ' + e.message); }
    };
    executeGitAction('commit_amend', {}, callback);
  }, [refresh, executeGitAction]);

  // 监听 CustomEvent
  useEffect(() => {
    const handlers: Record<string, EventListener> = {
      showRemotesManager: () => setShowPushPull('fetch'),
      showPushPullDialog: (e: Event) => {
        const mode = (e as CustomEvent).detail as 'push' | 'pull' | 'fetch';
        setShowPushPull(mode);
      },
      showInteractiveRebase: (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.oid) { setRebaseOid(detail.oid); }
        setShowRebase(true);
      },
      showReflog: () => setShowReflog(true),
      showSubmodulesManager: () => {},
      showBranchSelector: () => {},
      showGitignoreEditor: () => {
        window.dispatchEvent(new CustomEvent('openDialog:gitignoreEditor'));
      },
      showStashPop: async () => {
        try { await window.electronAPI.git.stashPop(); await refresh(); } catch (e: any) { alert('Stash Pop 失败: ' + e.message); }
      },
      showBlame: (e: Event) => {
        const filePath = (e as CustomEvent).detail as string;
        if (filePath) { setBlameFilePath(filePath); setShowBlame(true); }
      },
      showTagPanel: () => setShowTagPanel(true),
      focusCommits: () => { document.getElementById('commit-graph-area')?.focus(); },
      focusStatus: () => { document.getElementById('status-panel-area')?.focus(); },
      focusDiff: () => { document.getElementById('diff-view-area')?.focus(); },
      showShortcuts: () => setShowShortcuts(true),
      showReflogVisual: () => setShowReflogVisual(true),
      toggleTerminal: () => setShowTerminal(prev => !prev),
      'menu:toggleTerminal': () => setShowTerminal(prev => !prev),
      'menu:gitee': () => setShowGitee(true),
      'menu:amendCommit': () => handleAmendCommit(),
      'menu:reflogVisual': () => setShowReflogVisual(true),
    };
    for (const [event, handler] of Object.entries(handlers)) {
      window.addEventListener(event, handler);
    }
    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        window.removeEventListener(event, handler);
      }
    };
  }, [refresh, handleAmendCommit]);

  return (
    <DragDropProvider
      onMerge={async (source, target) => { try { await window.electronAPI.git.checkout(target); await window.electronAPI.git.merge(source); await refresh(); } catch (e: any) { alert('合并失败: ' + e.message); } }}
      onRebase={async (source, onto) => { try { await window.electronAPI.git.checkout(source); await window.electronAPI.git.rebaseInteractive?.(onto, ''); await refresh(); } catch (e: any) { alert('变基失败: ' + e.message); } }}
      onCherryPick={async (oid) => { setCherryPickOid(oid); setShowCherryPick(true); }}
      onCompare={async () => {}}
      onReset={async (oid, targetBranch) => { try { await window.electronAPI.git.checkout(targetBranch); await window.electronAPI.git.resetTo(oid, 'mixed'); await refresh(); } catch (e: any) { alert('重置失败: ' + e.message); } }}
    >
    <div className="flex-1 flex overflow-hidden" ref={containerRef}>

      {/* ========== 中栏：提交图（分支和提交合并显示）========== */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ width: `${centerRatio * 100}%` }}
      >
        {/* 提交筛选工具栏 */}
        <CommitFilterBar
          authors={authorStats}
          branches={branches}
          filter={commitFilter}
          onFilterChange={updateCommitFilter}
          onClearFilter={clearCommitFilter}
        />

        {/* 提交图 */}
        <div className="flex-1 overflow-hidden">
          <CommitGraph
            selectedCommit={selectedCommit}
            onCommitSelect={handleCommitSelect}
            onCreateBranch={handleCreateBranch}
            onCreateTag={handleCreateTag}
            onCheckout={handleCheckout}
            onReset={handleReset}
            onCherryPick={handleCherryPick}
            onRevert={handleRevert}
            onSavePatch={handleSavePatch}
          />
        </div>
      </div>

      {/* ========== 中/右拖拽条 ========== */}
      <div
        onMouseDown={handleCenterMouseDown}
        className="resize-handle-vertical flex-shrink-0"
      />

      {/* ========== 右栏：详情面板 + 暂存区 + Diff + CommitBar ========== */}
      <div
        id="right-panel"
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* 判断是否为本地仓库（无远程分支） */}
        {(() => {
          const isLocalRepo = !branches?.some(b => b.remote);
          
          if (isLocalRepo) {
            // 本地仓库：显示 Fork 风格的 Local Changes 面板
            return <LocalChangesPanel />;
          }
          
          // 非本地仓库：显示原有的 Commit/Changes/FileTree 标签页
          return (
            <>
              {/* Fork 风格标签页切换 */}
              <div className="flex border-b border-panel-border bg-[#1e2127]">
                <button
                  onClick={() => setRightPanelTab('commit')}
                  className={`flex-1 py-2 px-4 text-xs font-medium transition-colors relative ${
                    rightPanelTab === 'commit' 
                      ? 'text-[#9cdcfe]' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Commit
                  {rightPanelTab === 'commit' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#9cdcfe]" />
                  )}
                </button>
                <button
                  onClick={() => setRightPanelTab('changes')}
                  className={`flex-1 py-2 px-4 text-xs font-medium transition-colors relative ${
                    rightPanelTab === 'changes' 
                      ? 'text-[#9cdcfe]' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Changes
                  {rightPanelTab === 'changes' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#9cdcfe]" />
                  )}
                </button>
                <button
                  onClick={() => setRightPanelTab('filetree')}
                  className={`flex-1 py-2 px-4 text-xs font-medium transition-colors relative ${
                    rightPanelTab === 'filetree' 
                      ? 'text-[#9cdcfe]' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  File Tree
                  {rightPanelTab === 'filetree' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#9cdcfe]" />
                  )}
                </button>
              </div>

              {/* Fork 风格：每个标签页对应单一完整视图 */}
              <div className="flex-1 flex overflow-hidden">
                {rightPanelTab === 'commit' ? (
                  // Commit 模式：完整的提交详情面板（包含可展开的文件列表）
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <CommitDetailPanel
                      detail={selectedCommitDetail}
                      isExpanded={showCommitDetail}
                      onToggle={() => setShowCommitDetail(!showCommitDetail)}
                      onViewFileDiff={handleViewFileDiff}
                      onViewFileHistory={handleViewFileHistory}
                    />
                  </div>
                ) : rightPanelTab === 'changes' ? (
                  // Changes 模式：完全复刻 Fork 风格
                  <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
                    {/* ========== 顶部信息栏 - Fork 风格 ========== */}
                    {selectedCommitDetail && (
                      <div className="bg-[#252526] border-b border-[#3c3c3c] px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white" style={{ backgroundColor: '#6e7681' }}>
                            {selectedCommitDetail.commit.authorName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-300">{selectedCommitDetail.commit.authorName}</span>
                            <span className="text-xs text-gray-500 font-mono">{selectedCommitDetail.commit.shortOid}</span>
                            <span className="text-xs text-gray-500">{formatDate(selectedCommitDetail.commit.authorTimestamp)}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 truncate max-w-md">
                          {selectedCommitDetail.commit.fullMessage.split('\n')[0]}
                        </div>
                      </div>
                    )}

                    {/* ========== 文件树 + Diff 区域 ========== */}
                    <div className="flex-1 flex overflow-hidden">
                      {/* 左侧文件树 */}
                      <div className="w-[280px] flex-shrink-0 border-r border-[#3c3c3c] flex flex-col overflow-hidden bg-[#1e1e1e]">
                        <div className="flex-1 overflow-auto">
                          {selectedCommitDetail?.files.length ? (
                            <ChangesFileTree
                              files={selectedCommitDetail.files}
                              selectedFile={selectedFile}
                              onFileSelect={(path) => setSelectedFile(path)}
                            />
                          ) : (
                            <div className="h-full flex items-center justify-center text-gray-500 text-xs p-4">
                              选择一个提交查看变更
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 右侧 Diff 视图 */}
                      <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
                        {/* Diff 头部 */}
                        <div className="bg-[#252526] border-b border-[#3c3c3c] px-4 py-1.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Diff</span>
                            {selectedFile && (
                              <span className="text-xs text-[#9cdcfe] font-mono">— {selectedFile}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button className="p-1 text-gray-500 hover:text-gray-300 hover:bg-[#2a2d2e] rounded transition-colors" title="查看原始文件">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button className="p-1 text-gray-500 hover:text-gray-300 hover:bg-[#2a2d2e] rounded transition-colors" title="复制路径">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {/* Diff 内容 */}
                        <div className="flex-1 overflow-hidden">
                          {selectedFile && fileDiff ? (
                            <div className="h-full overflow-auto">
                              <div className="bg-[#1a1a1a]">
                                {/* Diff 内容 */}
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs font-mono">
                                    <tbody>
                                      {fileDiff.map((line, index) => (
                                        <tr key={index} className={line.type === 'header' ? 'bg-[#252526]' : ''}>
                                          {/* 旧行号 */}
                                          <td className="w-10 px-3 text-right select-none" style={{ backgroundColor: line.type === 'remove' ? '#3c1a1a' : line.type === 'add' ? '#1a3a1a' : 'transparent', color: '#8b949e' }}>
                                            {line.oldLine || ''}
                                          </td>
                                          {/* 新行号 */}
                                          <td className="w-10 px-3 text-right select-none" style={{ backgroundColor: line.type === 'add' ? '#1a3a1a' : line.type === 'remove' ? '#3c1a1a' : 'transparent', color: '#8b949e' }}>
                                            {line.newLine || ''}
                                          </td>
                                          {/* 内容 */}
                                          <td className="flex-1 px-3" style={{ 
                                            backgroundColor: line.type === 'add' ? '#1a3a1a' : line.type === 'remove' ? '#3c1a1a' : 'transparent',
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
                              </div>
                            </div>
                          ) : selectedFile ? (
                            <div className="h-full flex items-center justify-center text-gray-500">
                              <p className="text-sm">加载中...</p>
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">
                              <p className="text-sm">选择一个文件查看差异</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // File Tree 模式：完整文件树
                  <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
                    {/* 顶部信息栏 */}
                    <div className="bg-[#252526] border-b border-[#3c3c3c] px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white" style={{ backgroundColor: '#6e7681' }}>
                          {selectedCommitDetail?.commit.authorName.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-300">{selectedCommitDetail?.commit.authorName || 'Unknown'}</span>
                          <span className="text-xs text-gray-500 font-mono">{selectedCommitDetail?.commit.shortOid || 'N/A'}</span>
                          <span className="text-xs text-gray-500">{selectedCommitDetail ? formatDate(selectedCommitDetail.commit.authorTimestamp) : ''}</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 truncate max-w-md">
                        {selectedCommitDetail?.commit.fullMessage.split('\n')[0] || ''}
                      </div>
                    </div>

                    {/* 文件树 + 文件内容区域 */}
                    <div className="flex-1 flex overflow-hidden">
                      {/* 左侧文件树 */}
                      <div className="w-[280px] flex-shrink-0 border-r border-[#3c3c3c] flex flex-col overflow-hidden bg-[#1e1e1e]">
                        <div className="flex-1 overflow-auto">
                          <RepositoryFileTree
                            selectedFile={selectedFile}
                            onFileSelect={(path) => setSelectedFile(path)}
                          />
                        </div>
                      </div>

                      {/* 右侧文件内容 */}
                      <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
                        {/* 文件内容头部 */}
                        <div className="bg-[#252526] border-b border-[#3c3c3c] px-4 py-1.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">File</span>
                            {selectedFile && (
                              <span className="text-xs text-[#9cdcfe] font-mono">— {selectedFile}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button className="p-1 text-gray-500 hover:text-gray-300 hover:bg-[#2a2d2e] rounded transition-colors" title="查看文件历史">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            <button className="p-1 text-gray-500 hover:text-gray-300 hover:bg-[#2a2d2e] rounded transition-colors" title="复制路径">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {/* 文件内容 */}
                        <div className="flex-1 overflow-auto">
                          {isLoadingContent ? (
                            <div className="h-full flex items-center justify-center text-gray-500">
                              <p className="text-sm">加载中...</p>
                            </div>
                          ) : selectedFile && fileContent ? (
                            <div className="p-4 font-mono text-xs text-gray-300 whitespace-pre-wrap">
                              {fileContent}
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">
                              <p className="text-sm">选择一个文件查看内容</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          );
        })()}
      </div>

      {/* ========== 弹窗层 ========== */}
        <div>
          {showFileHistory && fileHistory && (
            <FileHistory
              filePath={fileHistory.filePath}
              commits={fileHistory.commits}
              stats={fileHistory.stats}
              onClose={() => setShowFileHistory(false)}
              onViewDiff={handleViewFileDiff}
            />
          )}

          <CherryPickDialog
            visible={showCherryPick}
            initialOid={cherryPickOid}
            onClose={() => { setShowCherryPick(false); setCherryPickOid(undefined); }}
            onRefresh={refresh}
          />

          {showPushPull === 'push' && (
            <PushDialog
              isOpen={true}
              onClose={() => setShowPushPull(null)}
              onPush={async (options) => {
                await window.electronAPI.git.push({ force: options.force, forceWithLease: options.forceWithLease, setUpstream: options.setUpstream });
                await refresh();
              }}
              remote="origin"
              branch={currentRepo?.currentBranch || undefined}
              hasUpstream={true}
              i18n={zhCN}
            />
          )}
          {showPushPull === 'pull' && (
            <PullDialog
              isOpen={true}
              onClose={() => setShowPushPull(null)}
              onPull={async (options) => {
                await window.electronAPI.git.pull({ rebase: options.rebase });
                await refresh();
              }}
              i18n={zhCN}
            />
          )}
          {showPushPull === 'fetch' && (
            <FetchDialog
              isOpen={true}
              onClose={() => setShowPushPull(null)}
              onFetch={async (options) => {
                await window.electronAPI.git.fetch({ remote: options.fetchAll ? undefined : 'origin', prune: options.prune });
                await refresh();
              }}
              i18n={zhCN}
            />
          )}

          {showRebase && rebaseOid && (
            <InteractiveRebaseDialog
              visible={showRebase}
              onto={rebaseOid}
              onClose={() => { setShowRebase(false); setRebaseOid(undefined); }}
              onRefresh={refresh}
            />
          )}

          <StashDialog
            isOpen={showStashDialog}
            onClose={() => setShowStashDialog(false)}
            onSuccess={refresh}
          />

          {showBlame && blameFilePath && (
            <BlameView
              visible={showBlame}
              filePath={blameFilePath}
              onClose={() => { setShowBlame(false); setBlameFilePath(undefined); }}
            />
          )}

          <ConflictResolutionPanel
            visible={showConflict}
            conflictType={conflictType}
            onClose={() => setShowConflict(false)}
            onRefresh={refresh}
          />

          <ConflictWarningDialog
            visible={showConflictWarning}
            type={conflictWarningData.type}
            branch={conflictWarningData.branch}
            files={conflictWarningData.files}
            onConfirm={async () => { setShowConflictWarning(false); }}
            onCancel={() => setShowConflictWarning(false)}
          />

          <ReflogPanel visible={showReflog} onClose={() => setShowReflog(false)} />
          <TagPanel visible={showTagPanel} onClose={() => setShowTagPanel(false)} onRefresh={refresh} />
          <TerminalPanel visible={showTerminal} onClose={() => setShowTerminal(false)} cwd={currentRepo?.path} />
          <GiteePanel visible={showGitee} onClose={() => setShowGitee(false)} repoPath={currentRepo?.path} />
          <ReflogVisualPanel visible={showReflogVisual} onClose={() => setShowReflogVisual(false)} onRefresh={refresh} />
          <ShortcutsDialog visible={showShortcuts} onClose={() => setShowShortcuts(false)} />
          <CommandPreviewDialog
            visible={showCmdPreview}
            commands={cmdPreviewCommands}
            onConfirm={() => {
              setShowCmdPreview(false);
              if (pendingCmdAction) pendingCmdAction();
              setPendingCmdAction(null);
            }}
            onCancel={() => {
              setShowCmdPreview(false);
              setPendingCmdAction(null);
            }}
          />
        </div>
      </div>
      </DragDropProvider>
  );
}

export default MainLayout;
