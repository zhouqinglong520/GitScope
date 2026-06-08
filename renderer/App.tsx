/**
 * 主应用组件
 * Fork 风格布局：简化标题栏 + 多仓库 Tab + 工具栏
 */

import React, { useState, useEffect } from 'react';
import MainLayout from './components/layout/MainLayout';
import Sidebar from './components/layout/Sidebar';
import QuickLaunch, { type QuickLaunchCommand } from './components/quicklaunch/QuickLaunch';
import { useRepoStore } from './stores/repoStore';
import { useMenuEvents } from './hooks/useMenuEvents';
import { zhCN } from './i18n/zh-CN';

// 简单的 i18n hook
function useI18n() {
  return zhCN;
}

function App() {
  const i18n = useI18n();

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
    ahead,
    behind,
  } = useRepoStore();

  const [showQuickLaunch, setShowQuickLaunch] = useState(false);
  const [sidebarWidth] = useState(220);

  // 处理打开仓库
  const handleOpenRepo = async () => {
    const path = await window.electronAPI.fs.selectFolder();
    if (path) {
      await openRepo(path);
    }
  };

  // 处理关闭仓库 Tab
  const handleCloseRepo = (repoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    closeRepo(repoId);
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
          // TODO: 实现克隆功能
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
      action: async () => {
        if (currentRepo) {
          await window.electronAPI.git.push();
        }
      },
    },
    {
      id: 'pull',
      label: '拉取',
      description: '从远程仓库拉取',
      category: '远程',
      shortcut: 'Ctrl+Shift+P',
      action: async () => {
        if (currentRepo) {
          await window.electronAPI.git.pull();
        }
      },
    },
    {
      id: 'fetch',
      label: '获取',
      description: '获取远程更新',
      category: '远程',
      action: async () => {
        if (currentRepo) {
          await window.electronAPI.git.fetch();
        }
      },
    },
    {
      id: 'stash',
      label: '暂存更改',
      description: '暂存当前更改',
      category: '暂存',
      shortcut: 'Ctrl+Shift+S',
      action: async () => {
        if (currentRepo) {
          const message = await window.electronAPI.fs.showInputBox({
            title: 'Stash',
            prompt: '输入 stash 备注（可选）',
          });
          await window.electronAPI.git.stash(message ? { message } : undefined);
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
          await window.electronAPI.git.refresh();
        }
      },
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

  return (
    <div className="h-screen flex flex-col bg-[#10141a] text-white overflow-hidden">
      {/* 简化标题栏 */}
      <header className="h-9 bg-[#1e2229] flex items-center justify-between px-3 drag-region border-b border-[#252b34]">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 no-drag">
            <svg className="w-4 h-4 text-[var(--accent)]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            <span className="font-semibold text-sm text-gradient">Majie</span>
          </div>
        </div>

        {/* 窗口控件 */}
        <div className="flex items-center no-drag">
          <button
            onClick={() => window.electronAPI.window.minimize()}
            className="w-10 h-7 flex items-center justify-center hover:bg-[#252b34] transition-colors"
            title={i18n.window.minimize}
          >
            <span className="text-xs">─</span>
          </button>
          <button
            onClick={() => window.electronAPI.window.maximize()}
            className="w-10 h-7 flex items-center justify-center hover:bg-[#252b34] transition-colors"
            title={i18n.window.maximize}
          >
            <span className="text-xs">□</span>
          </button>
          <button
            onClick={() => window.electronAPI.window.close()}
            className="w-10 h-7 flex items-center justify-center hover:bg-[#e81123] transition-colors"
            title={i18n.window.close}
          >
            <span className="text-xs">✕</span>
          </button>
        </div>
      </header>

      {/* 多仓库 Tab 标签页 */}
      {repos.length > 0 && (
        <div className="h-9 bg-[#171b22] flex items-center border-b border-[#252b34]">
          {/* Tab 列表 */}
          <div className="flex-1 flex items-center overflow-x-auto">
            {repos.map((repo) => (
              <div
                key={repo.id}
                onClick={() => setActiveRepo(repo.id)}
                className={`
                  group relative flex items-center gap-2 px-4 h-full cursor-pointer border-r border-[#252b34]
                  ${activeRepoId === repo.id
                    ? 'bg-[#10141a] text-white border-b-2 border-b-primary-500'
                    : 'bg-[#1e2229] text-gray-400 hover:text-white hover:bg-[#333337]'
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
                  className="ml-1 w-5 h-5 flex items-center justify-center rounded hover:bg-[#252b34] opacity-0 group-hover:opacity-100 transition-opacity"
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
            className="flex-shrink-0 w-9 h-full flex items-center justify-center hover:bg-[#252b34] transition-colors"
            title={i18n.toolbar.openRepo}
          >
            <span className="text-lg">+</span>
          </button>
        </div>
      )}

      {/* 工具栏 */}
      {currentRepo && (
        <div className="h-10 bg-[#171b22] flex items-center justify-between px-3 border-b border-panel-border">
          <div className="flex items-center gap-1">
            {/* Fetch */}
            <button
              onClick={async () => {
                console.log('[App] 点击了 Fetch 按钮');
                try {
                  await window.electronAPI.git.fetch();
                  console.log('[App] Fetch 成功');
                  // 刷新仓库 UI 数据
                  await refresh();
                } catch (err) {
                  console.error('[App] Fetch 失败:', err);
                }
              }}
              className="btn-icon flex items-center gap-1.5 px-2 text-xs"
              title={`${i18n.toolbar.fetch} (Ctrl+Shift+F)`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-xs">{i18n.toolbar.fetch}</span>
            </button>

            {/* Pull */}
            <button
              onClick={async () => {
                console.log('[App] 点击了 Pull 按钮');
                try {
                  await window.electronAPI.git.pull();
                  console.log('[App] Pull 成功');
                  // 刷新仓库 UI 数据
                  await refresh();
                } catch (err) {
                  console.error('[App] Pull 失败:', err);
                }
              }}
              className="btn-icon flex items-center gap-1.5 px-2"
              title={`${i18n.toolbar.pull} (Ctrl+Shift+P)`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span className="text-xs">{i18n.toolbar.pull}</span>
              {behind > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-600 text-white">
                  ↓ {behind}
                </span>
              )}
            </button>

            {/* Push */}
            <button
              onClick={async () => {
                console.log('[App] 点击了 Push 按钮');
                try {
                  await window.electronAPI.git.push();
                  console.log('[App] Push 成功');
                  // 刷新仓库 UI 数据
                  await refresh();
                } catch (err) {
                  console.error('[App] Push 失败:', err);
                }
              }}
              className="btn-icon flex items-center gap-1.5 px-2"
              title={`${i18n.toolbar.push} (Ctrl+P)`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span className="text-xs">{i18n.toolbar.push}</span>
              {ahead > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-green-600 text-white">
                  ↑ {ahead}
                </span>
              )}
            </button>

            <div className="h-5 w-px bg-[#252b34] mx-2" />

            {/* Stash */}
            <button
              onClick={async () => {
                console.log('[App] 点击了 Stash 按钮');
                try {
                  const message = await window.electronAPI.fs.showInputBox({
                    title: 'Stash',
                    prompt: '输入 stash 备注（可选）',
                  });
                  if (message !== null) {
                    await window.electronAPI.git.stash(message ? { message } : undefined);
                    console.log('[App] Stash 成功');
                    // 刷新仓库 UI 数据
                    await refresh();
                  }
                } catch (err) {
                  console.error('[App] Stash 失败:', err);
                }
              }}
              className="btn-icon flex items-center gap-1.5 px-2"
              title="Stash"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <span className="text-xs">Stash</span>
            </button>

            <div className="h-5 w-px bg-[#252b34] mx-2" />

            {/* 分支选择器 */}
            <button
              onClick={async () => {
                const branchName = await window.electronAPI.fs.showInputBox({
                  title: '切换分支',
                  prompt: '请输入要切换的分支名称',
                  defaultValue: currentRepo.currentBranch || undefined,
                });
                if (branchName) {
                  try {
                    await window.electronAPI.git.checkout(branchName);
                    await refresh();
                  } catch (err) {
                    console.error('[App] 切换分支失败:', err);
                  }
                }
              }}
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
              className="flex items-center gap-2 px-3 py-1.5 bg-[#252b34] hover:bg-[#2f353e] rounded text-xs text-gray-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Quick Launch</span>
              <kbd className="px-1.5 py-0.5 bg-[#171b22] rounded text-[10px]">Ctrl+K</kbd>
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
            <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
              <div className="text-center animate-fade-in">
                <svg className="w-20 h-20 mx-auto mb-4 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                {isLoading ? (
                  <div className="text-[var(--text-muted)] mb-4">{i18n.common.loading}</div>
                ) : error ? (
                  <div className="text-[var(--danger)] mb-4">{error}</div>
                ) : (
                  <p className="text-[var(--text-muted)] text-sm mb-6">打开一个 Git 仓库开始工作</p>
                )}
                <button
                  onClick={handleOpenRepo}
                  className="btn btn-primary px-6"
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
      <footer className="h-[22px] flex items-center justify-between px-3 text-[11px] select-none" style={{ background: 'var(--accent)', color: 'rgba(255,255,255,0.9)' }}>
        <div className="flex items-center gap-3">
          {currentRepo && (
            <>
              <span className="flex items-center gap-1 font-medium">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {currentRepo.currentBranch}
              </span>
              {ahead > 0 && <span className="opacity-80">↑{ahead}</span>}
              {behind > 0 && <span className="opacity-80">↓{behind}</span>}
              {ahead === 0 && behind === 0 && <span className="opacity-60">同步</span>}
            </>
          )}
        </div>
        <div className="flex items-center gap-3 opacity-80">
          <span>UTF-8</span>
          <span>LF</span>
          {currentRepo && (
            <span className="max-w-[250px] truncate">{currentRepo.path}</span>
          )}
        </div>
      </footer>

      {/* Quick Launch 弹窗 */}
      <QuickLaunch
        isOpen={showQuickLaunch}
        onClose={() => setShowQuickLaunch(false)}
        commands={quickLaunchCommands}
      />
    </div>
  );
}

export default App;
