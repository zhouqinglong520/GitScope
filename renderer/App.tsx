/**
 * 主应用组件
 * Fork 风格布局：简化标题栏 + 多仓库 Tab + 工具栏
 */

import React, { useState, useEffect } from 'react';
import { PushDialog, PullDialog, FetchDialog } from './components/operations/PushPullDialog';
import MainLayout from './components/layout/MainLayout';
import Sidebar from './components/layout/Sidebar';
import QuickLaunch, { type QuickLaunchCommand } from './components/quicklaunch/QuickLaunch';
import StashDialog from './components/stash/StashDialog';
import { useRepoStore } from './stores/repoStore';
import { useMenuEvents } from './hooks/useMenuEvents';
import { useI18, setLocale, getLocale } from './i18n';
import { ImageDiffView } from './components/imagediff/ImageDiffView';
import { FileHistoryPanel } from './components/filehistory/FileHistoryPanel';
import { InteractiveRebaseDialog } from './components/rebase/InteractiveRebaseDialog';
import SubmodulePanel from './components/submodule/SubmodulePanel';
import WorktreePanel from './components/worktree/WorktreePanel';
import LfsPanel from './components/lfs/LfsPanel';
import SettingsDialog from './components/settings/SettingsDialog';
import CustomActionsPanel from './components/customactions/CustomActionsPanel';
import ReflogPanel from './components/reflog/ReflogPanel';
import { NotificationToast, notify } from './components/notification/NotificationToast';
import BisectPanel from './components/bisect/BisectPanel';
import PatchPanel from './components/patch/PatchPanel';
import RepoManagerDialog from './components/repomanager/RepoManagerDialog';

// i18n hook with locale switching support
function useI18n() {
  const { messages } = useI18();
  return messages;
}

function App() {
  const i18n = useI18n();
  const [locale, setLocaleState] = useState(getLocale());

  // 监听主进程菜单事件
  useMenuEvents();
  const {
    repos,
    activeRepoId,
    currentRepo,
    sidebarCollapsed,
    setActiveRepo,
    openRepo,
    closeRepo,
    isLoading,
    error,
    toggleSidebar,
    refresh,
    branchTrackingStatus,
    currentBranch,
  } = useRepoStore();

  const [showQuickLaunch, setShowQuickLaunch] = useState(false);
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [showPullDialog, setShowPullDialog] = useState(false);
  const [showFetchDialog, setShowFetchDialog] = useState(false);
  const [hasUpstream, setHasUpstream] = useState(false);
  const [showStashDialog, setShowStashDialog] = useState(false);
  const [sidebarWidth] = useState(220);
  const [imageDiffInfo, setImageDiffInfo] = useState<any>(null);
  const [fileHistoryPath, setFileHistoryPath] = useState<string | null>(null);
  const [showRebaseDialog, setShowRebaseDialog] = useState(false);
  const [rebaseUpstream, setRebaseUpstream] = useState('');
  const [showSubmodulePanel, setShowSubmodulePanel] = useState(false);
  const [showWorktreePanel, setShowWorktreePanel] = useState(false);
  const [showLfsPanel, setShowLfsPanel] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showCustomActions, setShowCustomActions] = useState(false);
  const [showReflog, setShowReflog] = useState(false);
  const [showBisect, setShowBisect] = useState(false);
  const [showPatchPanel, setShowPatchPanel] = useState(false);
  const [showRepoManager, setShowRepoManager] = useState(false);

  // 获取当前分支的跟踪状态
  const currentBranchTracking = currentBranch ? branchTrackingStatus[currentBranch.name] : null;

  // 处理打开仓库
  const handleOpenRepo = async () => {
    const path = await window.electronAPI.fs.selectFolder();
    if (path) {
      await openRepo(path);
      notify('打开仓库', path, 'info');
    }
  };

  // 处理关闭仓库 Tab
  const handleCloseRepo = (repoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    closeRepo(repoId);
  };

  // 处理 Pull
  const handlePull = async (options?: { rebase?: boolean }) => {
    if (currentRepo) {
      try {
        await window.electronAPI.git.pull({ rebase: options?.rebase });
        await refresh();
        notify('Pull 成功', '已拉取远程更新', 'success');
      } catch (error) {
        console.error('Pull failed:', error);
        notify('Pull 失败', String(error), 'error');
      }
    }
  };

  // 快速 Pull（使用保存的偏好设置）
  const handleQuickPull = async () => {
    const rebase = localStorage.getItem('gitgui-pull-rebase') === 'true';
    await handlePull({ rebase });
  };

  // 处理 Push
  const handlePush = async (options?: { force?: boolean; forceWithLease?: boolean; setUpstream?: boolean }) => {
    if (currentRepo) {
      try {
        await window.electronAPI.git.push(options);
        notify('Push 成功', '已推送到远程仓库', 'success');
        await refresh();
        await checkUpstream();
      } catch (error) {
        console.error('Push failed:', error);
      }
    }
  };

  // 快速 Push（点击按钮直接执行，带确认）
  const handleQuickPush = async () => {
    if (currentRepo) {
      if (!hasUpstream) {
        // 没有上游，弹出对话框让用户选择
        setShowPushDialog(true);
      } else {
        try {
          await window.electronAPI.git.push();
        notify('Push 成功', '已推送到远程仓库', 'success');
          await refresh();
        } catch (error) {
          console.error('Push failed:', error);
        }
      }
    }
  };

  // 检查当前分支是否有上游
  const checkUpstream = async () => {
    if (currentRepo?.currentBranch) {
      try {
        const upstream = await window.electronAPI.git.getUpstream(currentRepo.currentBranch);
        setHasUpstream(!!upstream);
      } catch {
        setHasUpstream(false);
      }
    }
  };

  useEffect(() => {
    if (currentRepo) {
      checkUpstream();
    }
  }, [currentRepo, currentBranch]);

  // 处理 Fetch
  const handleFetch = async (options: { prune?: boolean; fetchAll?: boolean } = {}) => {
    if (currentRepo) {
      try {
        if (options?.fetchAll) {
          await window.electronAPI.git.fetchAll({ prune: options.prune });
        notify('Fetch 成功', '已获取远程更新', 'success');
        } else {
          await window.electronAPI.git.fetch({ prune: options.prune });
        notify('Fetch 成功', '已获取远程更新', 'success');
        }
        await refresh();
      } catch (error) {
        console.error('Fetch failed:', error);
      }
    }
  };

  // 快速 Fetch（点击按钮直接执行）
  const handleQuickFetch = async () => {
    const prune = localStorage.getItem('gitgui-fetch-prune') === 'true';
    await handleFetch({ prune });
  };

  // Quick Launch 命令
  const quickLaunchCommands: QuickLaunchCommand[] = [
    {
      id: 'clone',
      label: '克隆仓库',
      description: '克隆一个新的远程仓库',
      category: '仓库',
      shortcut: 'Ctrl+Shift+O',
      action: async () => {
        const url = await window.electronAPI.fs.showInputBox({
          title: '克隆仓库',
          prompt: '请输入仓库 URL',
        });
        if (url) {
          console.log('Clone:', url);
        }
      },
    },
    {
      id: 'new-branch',
      label: '新建分支',
      description: '创建一个新的分支',
      category: '分支',
      shortcut: 'Ctrl+B',
      action: async () => {
        const name = await window.electronAPI.fs.showInputBox({
          title: '新建分支',
          prompt: '请输入分支名称',
        });
        if (name) {
          await window.electronAPI.git.createBranch(name);
        notify('分支创建', `已创建分支 ${name}`, 'success');
        }
      },
    },
    {
      id: 'switch-branch',
      label: '切换分支',
      description: '切换到其他分支',
      category: '分支',
      shortcut: 'Ctrl+Shift+1',
      action: () => {
        // TODO: 实现分支选择器
      },
    },
    {
      id: 'commit-all',
      label: '提交所有更改',
      description: '暂存并提交所有更改',
      category: '提交',
      shortcut: 'Ctrl+Enter',
      action: () => {
        // TODO: 实现提交所有
      },
    },
    {
      id: 'push',
      label: '推送',
      description: '推送到远程仓库',
      category: '远程',
      shortcut: 'Ctrl+P',
      action: handlePush,
    },
    {
      id: 'pull',
      label: '拉取',
      description: '从远程仓库拉取',
      category: '远程',
      shortcut: 'Ctrl+Shift+P',
      action: handlePull,
    },
    {
      id: 'fetch',
      label: '获取',
      description: '获取远程更新',
      category: '远程',
      action: handleFetch,
    },
    {
      id: 'stash',
      label: '暂存更改',
      description: '暂存当前更改',
      category: '暂存',
      shortcut: 'Ctrl+Shift+S',
      action: async () => {
        if (currentRepo) {
          setShowStashDialog(true);
        }
      },
    },
    {
      id: 'stash-pop',
      label: '恢复暂存',
      description: '恢复最近暂存的更改',
      category: '暂存',
      action: async () => {
        if (currentRepo) {
          await window.electronAPI.git.stashPop();
        notify('Stash Pop', '已恢复暂存的更改', 'success');
        }
      },
    },
    {
      id: 'create-tag',
      label: '创建标签',
      description: '创建新的标签',
      category: '标签',
      action: async () => {
        if (currentRepo) {
          const name = await window.electronAPI.fs.showInputBox({
            title: '创建标签',
            prompt: '输入标签名称',
          });
          if (name) {
            await window.electronAPI.git.createTag(name);
          }
        }
      },
    },
    {
      id: 'open-terminal',
      label: '在终端中打开',
      description: '打开系统终端',
      category: '工具',
      shortcut: 'Ctrl+`',
      action: async () => {
        if (currentRepo) {
          await window.electronAPI.shell.openTerminal(currentRepo.path);
        }
      },
    },
    {
      id: 'refresh',
      label: '刷新',
      description: '刷新仓库状态',
      category: '工具',
      shortcut: 'F5',
      action: async () => {
        if (currentRepo) {
          await refresh();
        }
      },
    },
    // ========== P2 新增 Quick Launch 命令 ==========
    {
      id: 'interactive-rebase',
      label: '交互式 Rebase',
      description: '启动交互式 Rebase 编辑器',
      category: '变基',
      shortcut: 'Ctrl+Shift+R',
      action: async () => {
        if (currentRepo) {
          const upstream = await window.electronAPI.fs.showInputBox({
            title: '交互式 Rebase',
            prompt: '输入上游分支（如 origin/main）',
          });
          if (upstream) { setRebaseUpstream(upstream); setShowRebaseDialog(true); }
        }
      },
    },
    {
      id: 'submodules',
      label: '子模块管理',
      description: '管理 Git 子模块',
      category: '仓库',
      action: () => setShowSubmodulePanel(true),
    },
    {
      id: 'worktrees',
      label: 'Worktree 管理',
      description: '管理 Git Worktree',
      category: '仓库',
      action: () => setShowWorktreePanel(true),
    },
    {
      id: 'lfs',
      label: 'Git LFS',
      description: '管理 Git LFS',
      category: '仓库',
      action: () => setShowLfsPanel(true),
    },
    {
      id: 'settings',
      label: '偏好设置',
      description: '应用偏好设置',
      category: '工具',
      shortcut: 'Ctrl+,',
      action: () => setShowSettingsDialog(true),
    },
    {
      id: 'custom-actions',
      label: '自定义操作',
      description: '管理自定义 Shell 命令',
      category: '工具',
      action: () => setShowCustomActions(true),
    },
    {
      id: 'reflog',
      label: 'Reflog',
      description: '查看操作历史',
      category: '工具',
      action: () => setShowReflog(true),
    },
    {
      id: 'bisect',
      label: 'Bisect 二分查找',
      description: '定位引入 Bug 的提交',
      category: '调试',
      action: () => setShowBisect(true),
    },
    {
      id: 'patches',
      label: 'Patch 管理',
      description: '创建和应用 Patch',
      category: '工具',
      action: () => setShowPatchPanel(true),
    },
    {
      id: 'repo-manager',
      label: '仓库管理器',
      description: '管理所有仓库',
      category: '仓库',
      action: () => setShowRepoManager(true),
    },
  ];

  // 全局键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K 或 Ctrl+Shift+P: Quick Launch
      if ((e.ctrlKey && e.key === 'k') || (e.ctrlKey && e.shiftKey && e.key === 'p')) {
        e.preventDefault();
        setShowQuickLaunch(true);
      }

      // Ctrl+O: 打开仓库
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        handleOpenRepo();
      }

      // Ctrl+W: 关闭当前 Tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (activeRepoId) {
          closeRepo(activeRepoId);
        }
      }

      // Ctrl+B: 切换侧边栏
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeRepoId, closeRepo, toggleSidebar]);

  // 监听最大化状态变化
  useEffect(() => {
    const unsubscribe = window.electronAPI.window.onMaximizeChange((isMaximized) => {
      console.log('窗口最大化状态:', isMaximized);
    });
    return unsubscribe;
  }, []);


  // Image Diff handler
  const handleImageDiff = async (filePath: string, oldOid?: string, newOid?: string) => {
    try {
      const info = await window.electronAPI.git.getImageDiff(filePath, oldOid, newOid);
      if (info) {
        setImageDiffInfo(info);
      }
    } catch (err) {
      console.error('Failed to load image diff:', err);
    }
  };

  // File History handler
  const handleFileHistory = (filePath: string) => {
    setFileHistoryPath(filePath);
  };

  const handleCloseFileHistory = () => {
    setFileHistoryPath(null);
  };

  const handleViewFileDiff = (oid: string, filePath: string) => {
    console.log('View file diff for commit:', oid);
  };

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-white overflow-hidden">
      {/* 简化标题栏 */}
      <header className="h-9 bg-[#323233] flex items-center justify-between px-3 drag-region border-b border-[#3c3c3c]">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 no-drag">
            <span className="text-primary-400 font-bold text-lg">◈</span>
            <span className="font-semibold text-sm">GitScope 码界</span>
          </div>
        </div>

        {/* 窗口控件 */}
        <div className="flex items-center no-drag">
          <button
            onClick={() => window.electronAPI.window.minimize()}
            className="w-10 h-7 flex items-center justify-center hover:bg-[#3c3c3c] transition-colors"
            title={i18n.window.minimize}
          >
            <span className="text-xs">─</span>
          </button>
          <button
            onClick={() => window.electronAPI.window.maximize()}
            className="w-10 h-7 flex items-center justify-center hover:bg-[#3c3c3c] transition-colors"
            title={i18n.window.maximize}
          >
            <span className="text-xs">□</span>
          </button>
          <button
            onClick={() => window.electronAPI.window.close()}
            className="w-10 h-7 flex items-center justify-center hover:bg-red-600 transition-colors"
            title={i18n.window.close}
          >
            <span className="text-xs">✕</span>
          </button>
        </div>
      </header>

      {/* 多仓库 Tab 标签页 */}
      {repos.length > 0 && (
        <div className="h-9 bg-[#252526] flex items-center border-b border-[#3c3c3c]">
          {/* Tab 列表 */}
          <div className="flex-1 flex items-center overflow-x-auto">
            {repos.map((repo) => (
              <div
                key={repo.id}
                onClick={() => setActiveRepo(repo.id)}
                className={`
                  group relative flex items-center gap-2 px-4 h-full cursor-pointer border-r border-[#3c3c3c]
                  ${activeRepoId === repo.id
                    ? 'bg-[#1e1e1e] text-white border-b-2 border-b-primary-500'
                    : 'bg-[#2d2d30] text-gray-400 hover:text-white hover:bg-[#333337]'
                  }
                `}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="text-sm max-w-[120px] truncate">{repo.name}</span>
                
                {/* 关闭按钮 */}
                <button
                  onClick={(e) => handleCloseRepo(repo.id, e)}
                  className="ml-1 w-5 h-5 flex items-center justify-center rounded hover:bg-[#3c3c3c] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <span className="text-xs">✕</span>
                </button>

                {/* 当前分支标签 */}
                {activeRepoId === repo.id && repo.currentBranch && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary-600/30 text-primary-400 rounded">
                    {repo.currentBranch}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* 添加仓库按钮 */}
          <button
            onClick={handleOpenRepo}
            className="flex-shrink-0 w-9 h-full flex items-center justify-center hover:bg-[#3c3c3c] transition-colors"
            title={i18n.toolbar.openRepo}
          >
            <span className="text-lg">+</span>
          </button>
        </div>
      )}

      {/* 工具栏 */}
      {currentRepo && (
        <div className="h-10 bg-[#252526] flex items-center justify-between px-3 border-b border-panel-border">
          <div className="flex items-center gap-1">
            {/* Fetch */}
            <button
              onClick={() => setShowFetchDialog(true)}
              className="btn-icon flex items-center gap-1.5 px-2"
              title={`${i18n.toolbar.fetch} (Ctrl+Shift+F)`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-xs">{i18n.toolbar.fetch}</span>
            </button>

            {/* Pull */}
            <button
              onClick={() => setShowPullDialog(true)}
              className="btn-icon flex items-center gap-1.5 px-2 relative"
              title={`${i18n.toolbar.pull} (Ctrl+Shift+P)`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span className="text-xs">{i18n.toolbar.pull}</span>
              {/* Ahead/Behind 徽章 */}
              {currentBranchTracking && currentBranchTracking.behind > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  ↓{currentBranchTracking.behind}
                </span>
              )}
            </button>

            {/* Push */}
            <button
              onClick={handleQuickPush}
              className="btn-icon flex items-center gap-1.5 px-2 relative"
              title={`${i18n.toolbar.push} (Ctrl+P)`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span className="text-xs">{i18n.toolbar.push}</span>
              {/* Ahead 徽章 */}
              {currentBranchTracking && currentBranchTracking.ahead > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  ↑{currentBranchTracking.ahead}
                </span>
              )}
            </button>

            <div className="h-5 w-px bg-[#3c3c3c] mx-2" />

            {/* Stash */}
            <button
              onClick={() => setShowStashDialog(true)}
              className="btn-icon flex items-center gap-1.5 px-2"
              title={i18n.stash.create}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <span className="text-xs">Stash</span>
            </button>

            <div className="h-5 w-px bg-[#3c3c3c] mx-2" />

            {/* 分支选择器 */}
            <button
              className="btn-icon flex items-center gap-1.5 px-2"
              title={i18n.branch.current}
            >
              <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xs text-primary-400 font-medium">
                {currentRepo.currentBranch}
              </span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* 右侧：Quick Launch */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuickLaunch(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#3c3c3c] hover:bg-[#4f4f4f] rounded text-xs text-gray-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Quick Launch</span>
              <kbd className="px-1.5 py-0.5 bg-[#252526] rounded text-[10px]">Ctrl+K</kbd>
            </button>
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧边栏（可折叠） */}
        {currentRepo && !sidebarCollapsed && (
          <aside
            className="bg-sidebar-bg border-r border-panel-border flex flex-col overflow-hidden"
            style={{ width: sidebarWidth, minWidth: sidebarWidth }}
          >
            <Sidebar onOpenRepo={handleOpenRepo} />
          </aside>
        )}

        {/* 主区域 */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {currentRepo ? (
            <MainLayout />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                {isLoading ? (
                  <div className="text-gray-400">{i18n.common.loading}</div>
                ) : error ? (
                  <div className="text-red-400 mb-4">{error}</div>
                ) : null}
                <button
                  onClick={handleOpenRepo}
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  {i18n.toolbar.openRepo}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 状态栏 */}
      <footer className="h-6 bg-[#1a1a2e] flex items-center justify-between px-3 text-xs">
        <div className="flex items-center gap-4">
          {currentRepo && currentBranchTracking && (
            <>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-primary-200">{currentRepo.currentBranch}</span>
              </span>
              {/* 显示 ahead/behind 状态 */}
              {currentBranchTracking.state === 'up-to-date' && (
                <span className="text-green-400">✓ {i18n.branchManage.upstreamStatus.upToDate}</span>
              )}
              {currentBranchTracking.state === 'ahead' && (
                <span className="text-blue-400">↑{currentBranchTracking.ahead} {i18n.branchManage.upstreamStatus.ahead}</span>
              )}
              {currentBranchTracking.state === 'behind' && (
                <span className="text-orange-400">↓{currentBranchTracking.behind} {i18n.branchManage.upstreamStatus.behind}</span>
              )}
              {currentBranchTracking.state === 'ahead-behind' && (
                <span className="text-purple-400">↑{currentBranchTracking.ahead}↓{currentBranchTracking.behind}</span>
              )}
              {currentBranchTracking.state === 'no-upstream' && (
                <span className="text-gray-400">{i18n.branchManage.upstreamStatus.noUpstream}</span>
              )}
            </>
          )}
          {currentRepo && !currentBranchTracking && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-primary-200">{currentRepo.currentBranch}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span className="text-gray-400">{new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}</span>
          {currentRepo && (
            <span className="text-primary-200 max-w-[300px] truncate">{currentRepo.path}</span>
          )}
        </div>
      </footer>

      {/* Push 对话框 */}
      <PushDialog
        isOpen={showPushDialog}
        onClose={() => setShowPushDialog(false)}
        onPush={handlePush}
        remote="origin"
        branch={currentRepo?.currentBranch}
        hasUpstream={hasUpstream}
        i18n={i18n}
      />

      {/* Pull 对话框 */}
      <PullDialog
        isOpen={showPullDialog}
        onClose={() => setShowPullDialog(false)}
        onPull={handlePull}
        i18n={i18n}
      />

      {/* Fetch 对话框 */}
      <FetchDialog
        isOpen={showFetchDialog}
        onClose={() => setShowFetchDialog(false)}
        onFetch={handleFetch}
        i18n={i18n}
      />

      {/* Quick Launch 弹窗 */}
      <QuickLaunch
        isOpen={showQuickLaunch}
        onClose={() => setShowQuickLaunch(false)}
        commands={quickLaunchCommands}
      />

      {/* Stash 对话框 */}
      <StashDialog
        isOpen={showStashDialog}
        onClose={() => setShowStashDialog(false)}
        onSuccess={refresh}
      />
    
        {/* Image Diff Overlay */}
        {imageDiffInfo && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
            <div className="w-[80%] h-[80%] bg-gray-900 rounded-lg overflow-hidden">
              <ImageDiffView diffInfo={imageDiffInfo} onClose={() => setImageDiffInfo(null)} />
            </div>
          </div>
        )}

        {/* File History Panel */}
        {fileHistoryPath && (
          <div className="fixed right-0 top-0 bottom-0 w-[350px] z-40 shadow-xl border-l border-gray-700">
            <FileHistoryPanel
              filePath={fileHistoryPath}
              onViewDiff={handleViewFileDiff}
              onClose={handleCloseFileHistory}
            />
          </div>
        )}

        {/* ========== P2 新增对话框 ========== */}

        {/* 交互式 Rebase */}
        <InteractiveRebaseDialog
          visible={showRebaseDialog}
          upstream={rebaseUpstream}
          onClose={() => setShowRebaseDialog(false)}
          onComplete={refresh}
        />

        {/* 子模块管理 */}
        <SubmodulePanel
          visible={showSubmodulePanel}
          onClose={() => setShowSubmodulePanel(false)}
          onRefresh={refresh}
        />

        {/* Worktree 管理 */}
        <WorktreePanel
          visible={showWorktreePanel}
          onClose={() => setShowWorktreePanel(false)}
        />

        {/* Git LFS */}
        <LfsPanel
          visible={showLfsPanel}
          onClose={() => setShowLfsPanel(false)}
        />

        {/* 偏好设置 */}
        <SettingsDialog
          visible={showSettingsDialog}
          onClose={() => setShowSettingsDialog(false)}
          onLocaleChange={(loc) => setLocaleState(loc)}
        />

        {/* 自定义操作 */}
        <CustomActionsPanel
          visible={showCustomActions}
          onClose={() => setShowCustomActions(false)}
        />

        {/* Reflog */}
        <ReflogPanel
          visible={showReflog}
          onClose={() => setShowReflog(false)}
        />

        {/* Bisect 二分查找 */}
        <BisectPanel
          visible={showBisect}
          onClose={() => setShowBisect(false)}
          onRefresh={refresh}
        />

        {/* Patch 管理 */}
        <PatchPanel
          visible={showPatchPanel}
          onClose={() => setShowPatchPanel(false)}
          onRefresh={refresh}
        />

        {/* 仓库管理器 */}
        <RepoManagerDialog
          visible={showRepoManager}
          onClose={() => setShowRepoManager(false)}
          onSelectRepo={(path) => { openRepo(path); setShowRepoManager(false); }}
          repos={repos.map(r => ({ id: r.id, name: r.name, path: r.path, branch: r.currentBranch }))}
          activeRepoId={activeRepoId || undefined}
        />

        {/* 通知 Toast */}
        <NotificationToast />

</div>
  );
}

export default App;
