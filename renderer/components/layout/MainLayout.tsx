/**
 * 主布局组件
 * 上半部分：提交筛选栏 + 提交图
 * 下半部分：提交详情面板 + 暂存区 + Diff 对比（同屏显示）
 * 底部：常驻提交栏
 * 支持上下拖拽调整高度
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import CommitGraph from '../graph/CommitGraph';
import StatusPanel from '../commit/StatusPanel';
import DiffView from '../diff/DiffView';
import CommitBar from '../commitbar/CommitBar';
import CommitFilterBar from '../filter/CommitFilterBar';
import CommitDetailPanel from '../commitdetail/CommitDetailPanel';
import FileHistory from '../filehistory/FileHistory';
import CherryPickDialog from '../operations/CherryPickDialog';
import PushPullDialog from '../operations/PushPullDialog';
import InteractiveRebaseDialog from '../rebase/InteractiveRebaseDialog';
import StashDialog from '../stash/StashDialog';
import BlameView from '../blame/BlameView';
import ConflictResolutionPanel from '../conflict/ConflictResolutionPanel';
import ConflictWarningDialog from '../conflict/ConflictWarningDialog';
import ReflogPanel from '../reflog/ReflogPanel';
import TerminalPanel from '../terminal/TerminalPanel';
import TagPanel from '../branch/TagPanel';
import { useRepoStore } from '../../stores/repoStore';
import { useI18 } from '../../i18n';

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
  } = useRepoStore();

  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  // 分栏比例状态
  const [splitRatio, setSplitRatio] = useState(0.35); // 提交图占 35%
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // 拖拽调整分栏高度
  const handleMouseDown = useCallback(() => {
    isDraggingRef.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const relativeY = e.clientY - containerRect.top;
      const newRatio = Math.min(Math.max(relativeY / containerRect.height, 0.2), 0.6);

      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
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
      // 获取提交详情
      await getCommitDetail(oid);
    } else {
      setShowCommitDetail(false);
    }
  }, [getCommitDetail, setShowCommitDetail]);

  // 处理刷新
  const handleRefresh = async () => {
    await refresh();
  };

  // 处理提交
  const handleCommit = async (message: string, options?: { amend?: boolean; sign?: boolean }) => {
    setIsCommitting(true);
    try {
      const commitArgs: string[] = [];
      if (options?.amend) commitArgs.push('--amend');
      if (options?.sign) commitArgs.push('-S');
      await window.electronAPI.git.commit(message, { amend: options?.amend, sign: options?.sign });
      await refresh();
    } catch (error) {
      console.error('提交失败:', error);
      throw error;
    } finally {
      setIsCommitting(false);
    }
  };

  // 处理暂存文件
  const handleStage = async (path: string) => {
    await stageFile(path);
  };

  // 处理取消暂存
  const handleUnstage = async (path: string) => {
    await unstageFile(path);
  };

  // 处理暂存所有
  const handleStageAll = async () => {
    await stageAll();
  };

  // 处理取消暂存所有
  const handleUnstageAll = async () => {
    await unstageAll();
  };

  // 处理查看文件历史
  const handleViewFileHistory = async (filePath: string) => {
    await getFileHistory(filePath);
  };

  // 处理查看文件 diff
  const handleViewFileDiff = (oid: string, filePath: string) => {
    setSelectedFile(filePath);
    setSelectedCommit(oid);
  };

  // 右键菜单回调 - 创建分支
  const handleCreateBranch = useCallback(async (oid: string) => {
    const branchName = await window.electronAPI.fs.showInputBox({
      title: '创建分支',
      prompt: '输入分支名称:',
    });
    if (branchName) {
      await window.electronAPI.git.createBranch(branchName, oid);
      await refresh();
    }
  }, [refresh]);

  // 右键菜单回调 - 创建标签
  const handleCreateTag = useCallback(async (oid: string) => {
    const tagName = await window.electronAPI.fs.showInputBox({
      title: '创建标签',
      prompt: '输入标签名称:',
    });
    if (tagName) {
      await window.electronAPI.git.createTag(tagName, oid);
      await refresh();
    }
  }, [refresh]);

  // 右键菜单回调 - 检出提交
  const handleCheckout = useCallback(async (oid: string) => {
    await window.electronAPI.git.checkout(oid);
    await refresh();
  }, [refresh]);

  // 右键菜单回调 - 重置
  const handleReset = useCallback(async (oid: string) => {
    // 简化实现，实际应该显示模式选择对话框
    await window.electronAPI.git.checkout(oid);
    await refresh();
  }, [refresh]);

  // 右键菜单回调 - Cherry-pick
  const handleCherryPick = useCallback((oid: string) => {
    setCherryPickOid(oid);
    setShowCherryPick(true);
  }, []);

  // 右键菜单回调 - Revert
  const handleRevert = useCallback(async (oid: string) => {
    try {
      await window.electronAPI.git.revert(oid);
      await refresh();
    } catch (err) {
      console.error('Revert failed:', err);
    }
  }, []);

  // 右键菜单回调 - 保存为 Patch
  const handleSavePatch = useCallback(async (oid: string) => {
    try {
      await window.electronAPI.git.createPatch([oid]);
      alert('Patch 已创建');
    } catch (e: any) { alert('创建 Patch 失败: ' + e.message); }
  }, []);

  // 右键菜单回调 - Interactive Rebase
  const handleInteractiveRebase = useCallback(async (
    oid: string,
    action: 'reword' | 'squash' | 'fixup' | 'drop'
  ) => {
    setRebaseOid(oid);
    setShowRebase(true);
  }, []);


  // 监听 CustomEvent 显示面板
  useEffect(() => {
    const handlers: Record<string, EventListener> = {
      showRemotesManager: () => setShowPushPull('fetch'),
      showInteractiveRebase: (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.oid) { setRebaseOid(detail.oid); }
        setShowRebase(true);
      },
      showReflog: () => setShowReflog(true),
      showSubmodulesManager: () => {},  // TODO: add SubmodulePanel
      showBranchSelector: () => {},  // TODO: add BranchSelector
      showGitignoreEditor: () => {},  // TODO: add gitignore editor
      showShortcuts: () => {},  // TODO: add shortcuts dialog
      toggleTerminal: () => setShowTerminal(prev => !prev),
      'menu:toggleTerminal': () => setShowTerminal(prev => !prev),
    };
    for (const [event, handler] of Object.entries(handlers)) {
      window.addEventListener(event, handler);
    }
    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        window.removeEventListener(event, handler);
      }
    };
  }, []);
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 主内容区域（可拖拽分栏） */}
      <div
        ref={containerRef}
        className="flex-1 flex flex-col overflow-hidden"
        style={{ height: 'calc(100% - 180px)' }} // 预留底部提交栏空间
      >
        {/* 上半部分：筛选栏 + 提交图 */}
        <div
          className="flex flex-col border-b border-panel-border"
          style={{ height: `${splitRatio * 100}%` }}
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
                  className={`badge ${
                    branch.current ? 'badge-green' : 'badge-gray'
                  } text-xs`}
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
              commits={filteredCommits}
              branches={branches}
              currentBranch={currentRepo?.currentBranch || undefined}
              selectedCommit={selectedCommit}
              onCommitSelect={handleCommitSelect}
              onCreateBranch={handleCreateBranch}
              onCreateTag={handleCreateTag}
              onCheckout={handleCheckout}
              onReset={handleReset}
              onCherryPick={handleCherryPick}
              onRevert={handleRevert}
              onSavePatch={handleSavePatch}
              onInteractiveRebase={handleInteractiveRebase}
            />
          </div>
        </div>

        {/* 拖拽条 */}
        <div
          onMouseDown={handleMouseDown}
          className="resize-handle flex-shrink-0"
        />

        {/* 下半部分：提交详情 + 暂存区 + Diff */}
        <div
          className="flex-1 flex flex-col overflow-hidden"
          style={{ height: `${(1 - splitRatio) * 100}%` }}
        >
          {/* 提交详情面板（可折叠） */}
          <CommitDetailPanel
            detail={selectedCommitDetail}
            isExpanded={showCommitDetail}
            onToggle={() => setShowCommitDetail(!showCommitDetail)}
            onViewFileDiff={handleViewFileDiff}
            onViewFileHistory={handleViewFileHistory}
          />

          {/* 暂存区 + Diff */}
          <div className="flex-1 flex overflow-hidden">
            {/* 左侧：暂存区 */}
            <div className="w-[300px] flex-shrink-0 border-r border-panel-border flex flex-col overflow-hidden">
              <div className="panel-header">
                {t('detail.fileChanges')}
              </div>
              <div className="flex-1 overflow-hidden">
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
              </div>
            </div>

            {/* 右侧：Diff 对比 */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="panel-header">
                {t('detail.diff')}
              </div>
              <div className="flex-1 overflow-hidden">
                {selectedFile || selectedCommit ? (
                  <DiffView
                    commitOid={selectedCommit}
                    filePath={selectedFile}
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
        </div>
      </div>

      {/* 底部常驻提交栏 */}
      <CommitBar
        hasStaged={!!status && status.staged.length > 0}
        onCommit={handleCommit}
        isCommitting={isCommitting}
        stagedCount={status?.staged.length || 0}
      />

      {/* 文件历史弹窗 */}
      {showFileHistory && fileHistory && (
        <FileHistory
          filePath={fileHistory.filePath}
          commits={fileHistory.commits}
          stats={fileHistory.stats}
          onClose={() => setShowFileHistory(false)}
          onViewDiff={handleViewFileDiff}
        />
      )}

      {/* Cherry-pick 对话框 */}
      <CherryPickDialog
        visible={showCherryPick}
        initialOid={cherryPickOid}
        onClose={() => { setShowCherryPick(false); setCherryPickOid(undefined); }}
        onRefresh={refresh}
      />


      {/* Push/Pull 对话框 */}
      {showPushPull && (
        <PushPullDialog
          mode={showPushPull}
          visible={true}
          onClose={() => setShowPushPull(null)}
          onRefresh={refresh}
        />
      )}

      {/* 交互式变基对话框 */}
      {showRebase && rebaseOid && (
        <InteractiveRebaseDialog
          visible={showRebase}
          onto={rebaseOid}
          onClose={() => { setShowRebase(false); setRebaseOid(undefined); }}
          onRefresh={refresh}
        />
      )}

      {/* Stash 管理对话框 */}
      <StashDialog
        visible={showStashDialog}
        onClose={() => setShowStashDialog(false)}
        onRefresh={refresh}
      />

      {/* Blame 视图 */}
      {showBlame && blameFilePath && (
        <BlameView
          visible={showBlame}
          filePath={blameFilePath}
          onClose={() => { setShowBlame(false); setBlameFilePath(undefined); }}
        />
      )}

      {/* 冲突解决面板 */}
      <ConflictResolutionPanel
        visible={showConflict}
        conflictType={conflictType}
        onClose={() => setShowConflict(false)}
        onRefresh={refresh}
      />

      {/* 冲突预警对话框 */}
      <ConflictWarningDialog
        visible={showConflictWarning}
        type={conflictWarningData.type}
        branch={conflictWarningData.branch}
        files={conflictWarningData.files}
        onConfirm={async () => {
          setShowConflictWarning(false);
          // 执行实际操作由调用方处理
        }}
        onCancel={() => setShowConflictWarning(false)}
      />

      {/* Reflog 面板 */}
      <ReflogPanel
        visible={showReflog}
        onClose={() => setShowReflog(false)}
      />
      {/* 标签管理面板 */}
      <TagPanel
        visible={showTagPanel}
        onClose={() => setShowTagPanel(false)}
        onRefresh={refresh}
      />
      {/* 内置终端面板 */}
      <TerminalPanel
        visible={showTerminal}
        onClose={() => setShowTerminal(false)}
        cwd={currentRepo?.path}
      />
    </div>
  );
}

export default MainLayout;
