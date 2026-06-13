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
import CommitDetailPanel from '../commitdetail/CommitDetailPanel';
import DiffFileTree from '../difftree/DiffFileTree';
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
import { useI18 } from '../../i18n';
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

      {/* ========== 中栏：提交图 + 提交列表 ========== */}
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

        {/* 分支信息栏 */}
        <div className="h-8 flex items-center px-3" style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {branches.map((branch) => (
              <span
                key={branch.name}
                className={`badge ${branch.current ? 'badge-green' : 'badge-gray'} text-xs`}
              >
                {branch.name}
              </span>
            ))}
          </div>
        </div>

        {/* 提交图搜索/筛选栏 */}
        <div className="h-9 flex items-center gap-2 px-3" style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
          <input
            className="input px-2 py-1 text-xs w-40"
            placeholder={t('commitGraph.searchPlaceholder') || '搜索提交...'}
            value={graphSearch}
            onChange={e => { setGraphSearch(e.target.value); updateCommitFilter({ search: e.target.value }); }}
          />
          <div className="flex gap-1">
            {(['all', 'today', 'week', 'month'] as const).map(d => {
              const labels: Record<string, string> = { all: t('commitGraph.filterAll') || '全部', today: t('commitGraph.today') || '今天', week: t('commitGraph.thisWeek') || '本周', month: t('commitGraph.thisMonth') || '本月' };
              return (
                <button
                  key={d}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${graphDateFilter === d ? 'text-white' : ''}`}
                  style={{ background: graphDateFilter === d ? 'var(--accent)' : 'transparent', color: graphDateFilter === d ? 'white' : 'var(--text-muted)' }}
                  onClick={() => { setGraphDateFilter(d); const now = Date.now() / 1000; if (d === 'all') updateCommitFilter({ startDate: undefined, endDate: undefined }); else if (d === 'today') updateCommitFilter({ startDate: now - 86400 }); else if (d === 'week') updateCommitFilter({ startDate: now - 604800 }); else if (d === 'month') updateCommitFilter({ startDate: now - 2592000 }); }}
                >{labels[d]}</button>
              );
            })}
          </div>
          <span className="text-[11px] ml-auto" style={{ color: 'var(--text-faint)' }}>{filteredCommits.length} 提交</span>
        </div>

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
        {/* 上半：提交详情（可折叠） */}
        <div style={{ height: `${detailRatio * 100}%` }} className="flex flex-col overflow-hidden border-b border-panel-border">
          <CommitDetailPanel
            detail={selectedCommitDetail}
            isExpanded={showCommitDetail}
            onToggle={() => setShowCommitDetail(!showCommitDetail)}
            onViewFileDiff={handleViewFileDiff}
            onViewFileHistory={handleViewFileHistory}
          />
        </div>

        {/* 详情/Diff 拖拽条 */}
        <div
          onMouseDown={handleDetailMouseDown}
          className="resize-handle flex-shrink-0"
        />

        {/* 下半：文件列表 + Diff */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左：文件列表（Fork 模式：选中提交时显示提交文件，否则显示工作区状态） */}
          <div className="w-[260px] flex-shrink-0 border-r border-panel-border flex flex-col overflow-hidden">
            <div className="panel-header">
              {selectedCommit ? t('detail.fileChanges') : t('detail.fileChanges')}
            </div>
            <div className="flex-1 overflow-hidden">
              {selectedCommit ? (
                selectedCommitDetail ? (
                  <DiffFileTree
                    files={selectedCommitDetail.files.map(f => ({
                      path: f.path,
                      oldPath: f.oldPath,
                      status: f.status,
                      additions: f.additions,
                      deletions: f.deletions,
                    }))}
                    selectedFile={selectedFile}
                    onFileSelect={(path) => {
                      setSelectedFile(path);
                    }}
                    onViewDiff={(oid, path) => {
                      setSelectedFile(path);
                    }}
                    onViewHistory={handleViewFileHistory}
                    commitOid={selectedCommit}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                    <div className="text-center">
                      <svg className="w-6 h-6 mx-auto mb-2 animate-spin opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <p className="text-xs">加载提交详情...</p>
                    </div>
                  </div>
                )
              ) : (
                <StatusPanel
                  status={status}
                  onFileSelect={(path) => {
                    setSelectedFile(path);
                    setSelectedCommit(null);
                  }}
                  selectedFile={selectedFile}
                  onStage={handleStage}
                  onUnstage={handleUnstage}
                  onStageAll={handleStageAll}
                  onUnstageAll={handleUnstageAll}
                  onViewHistory={handleViewFileHistory}
                  onRefresh={refresh}
                />
              )}
            </div>
          </div>

          {/* 右：Diff 对比 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="panel-header flex items-center gap-2">
              <span>{t('detail.diff')}</span>
              {selectedFile && (
                <span style={{ fontSize: 11, color: '#9cdcfe', fontFamily: 'monospace', fontWeight: 400 }}>
                  — {selectedFile.split('/').pop()}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              {selectedFile || selectedCommit ? (
                <DiffView
                  commitOid={selectedCommit}
                  filePath={selectedFile}
                  isStaged={!!status && status.staged.some(f => f.path === selectedFile)}
                  onRefresh={refresh}
                  onStageFile={handleStage}
                  onUnstageFile={handleUnstage}
                  onDiscardFile={async (path) => {
                    try {
                      await window.electronAPI.git.discardChanges(path);
                      await refresh();
                    } catch (e: any) { alert('Discard failed: ' + e.message); }
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                  <div className="text-center animate-fade-in">
                    <svg className="w-16 h-16 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">选择一个文件查看差异</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>或选择一个提交查看变更</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 底部常驻提交栏 */}
        <CommitBar
          hasStaged={!!status && status.staged.length > 0}
          onCommit={handleCommit}
          isCommitting={isCommitting}
          stagedCount={status?.staged.length || 0}
        />
      </div>

      {/* ========== 弹窗层 ========== */}
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
    </DragDropProvider>
  );
}

export default MainLayout;
