/**
 * 左侧边栏组件
 * 包含仓库列表、分支列表、标签列表、Stash 列表
 * 支持折叠、右键菜单、分组、过滤、收藏等功能
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRepoStore } from '../../stores/repoStore';
import { zhCN } from '../../i18n/zh-CN';
import { useContextMenu, type MenuItem } from '../contextmenu/ContextMenu';
import type { BranchTrackingMap, BranchTrackingStatus } from '@shared/types/git';

interface SidebarProps {
  onOpenRepo: () => void;
}

type SectionType = 'repositories' | 'branches' | 'tags' | 'stashes';

// localStorage key for pinned branches
const PINNED_BRANCHES_KEY = 'gitgui-pinned-branches';

function Sidebar({ onOpenRepo }: SidebarProps) {
  const i18n = zhCN;
  const { branches, tags, stashes } = useRepoStore();

  // 折叠状态
  const [expandedSections, setExpandedSections] = useState<Set<SectionType>>(
    new Set(['repositories', 'branches'])
  );

  // 切换展开状态
  const toggleSection = (section: SectionType) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(section)) {
      newSet.delete(section);
    } else {
      newSet.add(section);
    }
    setExpandedSections(newSet);
  };

  const isExpanded = (section: SectionType) => expandedSections.has(section);

  return (
    <div className="flex flex-col h-full">
      {/* 仓库标题栏 */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-panel-border">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {i18n.sidebar.repositories}
        </span>
        <button
          onClick={onOpenRepo}
          className="btn-icon"
          title={i18n.sidebar.addRepo}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {/* 仓库列表 */}
        <Section
          title={i18n.sidebar.repositories}
          expanded={isExpanded('repositories')}
          onToggle={() => toggleSection('repositories')}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          }
        >
          <RepoSection />
        </Section>

        {/* 分支列表 */}
        <Section
          title={i18n.branch.local}
          expanded={isExpanded('branches')}
          onToggle={() => toggleSection('branches')}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        >
          <BranchSection />
        </Section>

        {/* 标签列表 */}
        {tags && tags.length > 0 && (
          <Section
            title="标签"
            expanded={isExpanded('tags')}
            onToggle={() => toggleSection('tags')}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
            }
          >
            <TagsSection />
          </Section>
        )}

        {/* Stash 列表 */}
        {stashes && stashes.length > 0 && (
          <Section
            title={`Stash (${stashes.length})`}
            expanded={isExpanded('stashes')}
            onToggle={() => toggleSection('stashes')}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            }
          >
            <StashSection />
          </Section>
        )}
      </div>
    </div>
  );
}

// ========== 辅助函数 ==========

/**
 * 解析分支路径，返回文件夹名和分支名
 * 例如: "feature/auth" -> { folder: "feature", name: "auth" }
 *      "main" -> { folder: "", name: "main" }
 */
function parseBranchPath(branchName: string): { folder: string; name: string } {
  const parts = branchName.split('/');
  if (parts.length > 1) {
    return {
      folder: parts.slice(0, -1).join('/'),
      name: parts[parts.length - 1],
    };
  }
  return { folder: '', name: branchName };
}

/**
 * 渲染上游状态图标
 */
function UpstreamStatusIcon({ status }: { status: BranchTrackingStatus }) {
  switch (status.state) {
    case 'up-to-date':
      return (
        <span className="text-green-500" title={zhCN.branchManage.upstreamStatus.upToDate}>
          ✓
        </span>
      );
    case 'ahead':
      return (
        <span className="text-blue-500" title={`${zhCN.branchManage.upstreamStatus.ahead} ${status.ahead}`}>
          ↑{status.ahead}
        </span>
      );
    case 'behind':
      return (
        <span className="text-orange-500" title={`${zhCN.branchManage.upstreamStatus.behind} ${status.behind}`}>
          ↓{status.behind}
        </span>
      );
    case 'ahead-behind':
      return (
        <span className="text-purple-500" title={`↑${status.ahead} ↓${status.behind}`}>
          ↑{status.ahead}↓{status.behind}
        </span>
      );
    case 'diverged':
      return (
        <span className="text-red-500" title={zhCN.branchManage.upstreamStatus.diverged}>
          ⇄
        </span>
      );
    case 'no-upstream':
    default:
      return (
        <span className="text-gray-500 opacity-50" title={zhCN.branchManage.upstreamStatus.noUpstream}>
          ◎
        </span>
      );
  }
}

// ========== 组件定义 ==========

// 折叠区块组件
interface SectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, expanded, onToggle, icon, children }: SectionProps) {
  return (
    <div className="border-b border-panel-border">
      <div
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-sidebar-hover transition-colors duration-200"
      >
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {icon}
        <span className="flex-1 text-xs font-medium text-gray-300">{title}</span>
      </div>
      {expanded && (
        <div className="pb-1 overflow-hidden transition-all duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

// 仓库列表组件
function RepoSection() {
  const { repos, activeRepoId, currentRepo, setActiveRepo } = useRepoStore();

  const { showContextMenu, ContextMenuWrapper } = useContextMenu(() => {
    const items: MenuItem[] = [
      {
        id: 'open-in-explorer',
        label: '在资源管理器中打开',
        onClick: () => {
          if (currentRepo) {
            window.electronAPI.shell.openPath(currentRepo.path);
          }
        },
      },
      {
        id: 'copy-path',
        label: '复制路径',
        onClick: () => {
          if (currentRepo) {
            navigator.clipboard.writeText(currentRepo.path);
          }
        },
      },
      { id: 'divider-1', label: '', divider: true },
      {
        id: 'remove',
        label: '从列表中移除',
        onClick: () => {
          if (activeRepoId) {
            useRepoStore.getState().closeRepo(activeRepoId);
          }
        },
      },
    ];
    return items;
  });

  if (repos.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-gray-500">
        暂无打开的仓库
      </div>
    );
  }

  return (
    <>
      {repos.map((repo) => (
        <div
          key={repo.id}
          onClick={() => setActiveRepo(repo.id)}
          onContextMenu={showContextMenu}
          className={`
            flex items-center gap-2 px-3 py-1 cursor-pointer transition-colors
            ${activeRepoId === repo.id ? 'bg-sidebar-active' : 'hover:bg-sidebar-hover'}
          `}
        >
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">{repo.name}</div>
            <div className="text-xs text-gray-500 truncate">
            {(() => {
              const parts = repo.path.split(/[/\\]/);
              return parts.length > 2 ? '.../' + parts.slice(-2).join('/') : repo.path;
            })()}
            </div>
          </div>
          {repo.currentBranch && (
            <span className="text-xs text-primary-400">{repo.currentBranch}</span>
          )}
        </div>
      ))}
      {ContextMenuWrapper}
    </>
  );
}

// 分支列表组件
function BranchSection() {
  const { branches } = useRepoStore();
  
  // 分支跟踪状态
  const [trackingStatus, setTrackingStatus] = useState<BranchTrackingMap>({});
  
  // 搜索过滤
  const [filterText, setFilterText] = useState('');
  const filterInputRef = useRef<HTMLInputElement>(null);
  
  // 收藏的分支
  const [pinnedBranches, setPinnedBranches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(PINNED_BRANCHES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  // 折叠的文件夹
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // 加载跟踪状态
  useEffect(() => {
    const loadTrackingStatus = async () => {
      try {
        const status = await window.electronAPI.git.getBranchTrackingStatus();
        setTrackingStatus(status);
      } catch (error) {
        console.error('Failed to load tracking status:', error);
      }
    };
    loadTrackingStatus();
  }, [branches]);

  // 键盘快捷键：/ 聚焦搜索框
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.closest('.sidebar-section')) {
        e.preventDefault();
        filterInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 切换文件夹折叠状态
  const toggleFolder = useCallback((folder: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  }, []);

  // 切换收藏状态
  const togglePinned = useCallback((branchName: string) => {
    setPinnedBranches(prev => {
      const next = prev.includes(branchName)
        ? prev.filter(b => b !== branchName)
        : [...prev, branchName];
      localStorage.setItem(PINNED_BRANCHES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // 过滤分支
  const filteredBranches = useMemo(() => {
    if (!filterText) return branches;
    const search = filterText.toLowerCase();
    return branches.filter(b => b.name.toLowerCase().includes(search));
  }, [branches, filterText]);

  // 分类分支
  const { pinnedList, localBranches, remoteBranches } = useMemo(() => {
    const pinnedList: typeof branches = [];
    const localBranches: typeof branches = [];
    const remoteBranches: typeof branches = [];

    for (const branch of filteredBranches) {
      if (branch.remote) {
        remoteBranches.push(branch);
      } else if (pinnedBranches.includes(branch.name)) {
        pinnedList.push(branch);
      } else {
        localBranches.push(branch);
      }
    }

    return { pinnedList, localBranches, remoteBranches };
  }, [filteredBranches, pinnedBranches]);

  // 分组本地分支
  const groupedLocalBranches = useMemo(() => {
    const groups = new Map<string, typeof localBranches>();
    const rootBranches: typeof localBranches = [];

    for (const branch of localBranches) {
      const { folder, name } = parseBranchPath(branch.name);
      if (folder) {
        if (!groups.has(folder)) {
          groups.set(folder, []);
        }
        groups.get(folder)!.push({ ...branch, name: `${folder}/${name}` });
      } else {
        rootBranches.push(branch);
      }
    }

    return { groups, rootBranches };
  }, [localBranches]);

  // 分组远程分支
  const groupedRemoteBranches = useMemo(() => {
    const groups = new Map<string, typeof remoteBranches>();
    const rootBranches: typeof remoteBranches = [];

    for (const branch of remoteBranches) {
      // 远程分支格式: origin/xxx
      const match = branch.name.match(/^origin\/(.+)$/);
      if (match) {
        const path = match[1];
        const { folder, name } = parseBranchPath(path);
        const fullPath = folder ? `origin/${folder}/${name}` : `origin/${name}`;
        
        if (folder) {
          const groupKey = `origin/${folder}`;
          if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
          }
          groups.get(groupKey)!.push({ ...branch, name: fullPath });
        } else {
          rootBranches.push({ ...branch, name: `origin/${name}` });
        }
      } else {
        rootBranches.push(branch);
      }
    }

    return { groups, rootBranches };
  }, [remoteBranches]);

  // 右键菜单
  const { showContextMenu, ContextMenuWrapper } = useContextMenu(() => {
    const items: MenuItem[] = [
      {
        id: 'new-branch',
        label: '新建分支',
        shortcut: 'Ctrl+B',
        onClick: async () => {
          const name = await window.electronAPI.fs.showInputBox({
            title: '新建分支',
            prompt: '请输入分支名称',
          });
          if (name) {
            await window.electronAPI.git.createBranch(name);
          }
        },
      },
    ];
    return items;
  });

  // 分支项组件
  const BranchItem = ({ branch, showStatus = true }: { branch: typeof branches[0]; showStatus?: boolean }) => {
    const branchStatus = trackingStatus[branch.name];
    const isPinned = pinnedBranches.includes(branch.name);

    const { showContextMenu: showBranchMenu, ContextMenuWrapper: BranchMenu } = useContextMenu(() => {
      const items: MenuItem[] = [
        {
          id: 'checkout',
          label: '切换到此分支',
          onClick: () => window.electronAPI.git.checkout(branch.name),
        },
        {
          id: 'pin',
          label: isPinned ? '取消收藏' : '收藏分支',
          onClick: () => togglePinned(branch.name),
        },
        { id: 'divider-1', label: '', divider: true },
        {
          id: 'merge',
          label: '合并到当前分支',
          onClick: () => {
            // TODO: 实现合并
          },
        },
        {
          id: 'rebase',
          label: '变基到当前分支',
          onClick: () => {
            // TODO: 实现变基
          },
        },
        { id: 'divider-2', label: '', divider: true },
        {
          id: 'rename',
          label: '重命名',
          onClick: () => {
            // TODO: 实现重命名
          },
        },
        {
          id: 'delete',
          label: '删除',
          onClick: () => {
            window.electronAPI.git.deleteBranch(branch.name);
          },
        },
      ];
      return items;
    });

    return (
      <>
        <div
          onContextMenu={showBranchMenu}
          onClick={() => window.electronAPI.git.checkout(branch.name)}
          className={`
            flex items-center gap-2 px-3 py-1 cursor-pointer transition-colors group
            ${branch.current ? 'text-primary-400' : 'hover:bg-sidebar-hover'}
          `}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-sm truncate flex-1">{branch.name}</span>
          {showStatus && branchStatus && (
            <UpstreamStatusIcon status={branchStatus} />
          )}
          {branch.current && (
            <span className="text-xs text-primary-500">当前</span>
          )}
        </div>
        {BranchMenu}
      </>
    );
  };

  // 文件夹项组件
  const FolderItem = ({ 
    folder, 
    branches 
  }: { 
    folder: string; 
    branches: typeof localBranches;
  }) => {
    const isCollapsed = collapsedFolders.has(folder);
    const branchCount = branches.length;

    return (
      <div>
        <div
          onClick={() => toggleFolder(folder)}
          className="flex items-center gap-2 px-3 py-1 cursor-pointer hover:bg-sidebar-hover transition-colors"
        >
          <svg
            className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="text-sm text-gray-400 truncate flex-1">{folder}/</span>
          <span className="text-xs text-gray-500">({branchCount})</span>
        </div>
        {!isCollapsed && (
          <div className="ml-4">
            {branches.map(branch => (
              <BranchItem key={branch.name} branch={branch} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* 搜索过滤框 */}
      <div className="px-3 py-2">
        <div className="relative">
          <input
            ref={filterInputRef}
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={zhCN.branchManage.filter.placeholder}
            className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-primary-500"
          />
          {filterText && (
            <button
              onClick={() => setFilterText('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 收藏的分支 */}
      {pinnedList.length > 0 && (
        <div className="mb-2">
          <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
            <span>⭐</span>
            <span>{zhCN.branchManage.pinned.title}</span>
          </div>
          {pinnedList.map(branch => (
            <BranchItem key={branch.name} branch={branch} />
          ))}
        </div>
      )}

      {/* 本地分支 */}
      {groupedLocalBranches.rootBranches.map(branch => (
        <BranchItem key={branch.name} branch={branch} />
      ))}
      
      {/* 本地分支文件夹 */}
      {Array.from(groupedLocalBranches.groups.entries()).map(([folder, branches]) => (
        <FolderItem key={folder} folder={folder} branches={branches} />
      ))}

      {/* 远程分支 */}
      {groupedRemoteBranches.rootBranches.length > 0 && (
        <>
          <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase mt-2">
            {zhCN.branch.remote}
          </div>
          {groupedRemoteBranches.rootBranches.map(branch => (
            <div
              key={branch.name}
              onClick={() => window.electronAPI.git.checkout(branch.name)}
              className="flex items-center gap-2 px-3 py-1 cursor-pointer hover:bg-sidebar-hover transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <span className="text-sm truncate text-gray-400 pl-2">↳ {branch.name}</span>
            </div>
          ))}
        </>
      )}

      {/* 远程分支文件夹 */}
      {Array.from(groupedRemoteBranches.groups.entries()).map(([folder, branches]) => (
        <div key={folder}>
          <div
            onClick={() => toggleFolder(folder)}
            className="flex items-center gap-2 px-3 py-1 cursor-pointer hover:bg-sidebar-hover transition-colors"
          >
            <svg
              className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${collapsedFolders.has(folder) ? '' : 'rotate-90'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <span className="text-sm text-gray-400 truncate flex-1">{folder}/</span>
            <span className="text-xs text-gray-500">({branches.length})</span>
          </div>
          {!collapsedFolders.has(folder) && (
            <div className="ml-4">
              {branches.map(branch => (
                <div
                  key={branch.name}
                  onClick={() => window.electronAPI.git.checkout(branch.name)}
                  className="flex items-center gap-2 px-3 py-1 cursor-pointer hover:bg-sidebar-hover transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <span className="text-sm truncate text-gray-400 pl-2">↳ {branch.name.replace(/^origin\//, '')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* 空状态 */}
      {filteredBranches.length === 0 && (
        <div className="px-3 py-2 text-xs text-gray-500">
          {zhCN.branchManage.filter.noMatch}
        </div>
      )}

      {ContextMenuWrapper}
    </>
  );
}

// 标签列表组件
function TagsSection() {
  const { tags } = useRepoStore();

  const { showContextMenu, ContextMenuWrapper } = useContextMenu(() => {
    const items: MenuItem[] = [
      {
        id: 'checkout',
        label: '检出此标签',
        onClick: () => {
          // TODO: 实现检出标签
        },
      },
      {
        id: 'push',
        label: '推送标签',
        onClick: () => {
          // TODO: 实现推送标签
        },
      },
      {
        id: 'delete',
        label: '删除标签',
        onClick: () => {
          // TODO: 实现删除标签
        },
      },
    ];
    return items;
  });

  return (
    <>
      {tags.map((tag) => (
        <div
          key={tag.name}
          onContextMenu={showContextMenu}
          className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-sidebar-hover transition-colors"
        >
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span className="text-sm truncate text-gray-300">{tag.name}</span>
        </div>
      ))}
      {ContextMenuWrapper}
    </>
  );
}

// Stash 列表组件
function StashSection() {
  const { stashes } = useRepoStore();

  const { showContextMenu, ContextMenuWrapper } = useContextMenu(() => {
    const items: MenuItem[] = [
      {
        id: 'apply',
        label: '应用',
        onClick: () => {
          // TODO: 实现应用 stash
        },
      },
      {
        id: 'pop',
        label: '弹出',
        onClick: () => {
          // TODO: 实现弹出 stash
        },
      },
      {
        id: 'drop',
        label: '删除',
        onClick: () => {
          // TODO: 实现删除 stash
        },
      },
    ];
    return items;
  });

  return (
    <>
      {stashes.map((stash, index) => (
        <div
          key={stash.id || index}
          onContextMenu={showContextMenu}
          className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-sidebar-hover transition-colors"
        >
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">
              {stash.message || `Stash #${index}`}
            </div>
            <div className="text-xs text-gray-500">
              {stash.date || index === 0 ? '刚刚' : `${index} 分钟前`}
            </div>
          </div>
        </div>
      ))}
      {ContextMenuWrapper}
    </>
  );
}

export default Sidebar;
