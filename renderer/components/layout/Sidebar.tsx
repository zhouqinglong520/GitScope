/**
 * 左侧边栏组件
 * 包含仓库列表、分支列表、标签列表、Stash 列表
 * 支持折叠和右键菜单
 */

import React, { useState } from 'react';
import { useRepoStore } from '../../stores/repoStore';
import { zhCN } from '../../i18n/zh-CN';
import { useContextMenu, type MenuItem } from '../contextmenu/ContextMenu';

interface SidebarProps {
  onOpenRepo: () => void;
}

type SectionType = 'repositories' | 'branches' | 'tags' | 'stashes';

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
  const { repos, activeRepoId, currentRepo, setActiveRepo, openRepo } = useRepoStore();

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

  const localBranches = branches.filter((b) => !b.remote);
  const remoteBranches = branches.filter((b) => b.remote);

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
      {
        id: 'checkout',
        label: '切换到此分支',
        onClick: () => {
          // TODO: 实现切换分支
        },
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
          // TODO: 实现删除
        },
      },
    ];
    return items;
  });

  return (
    <>
      {/* 本地分支 */}
      {localBranches.map((branch) => (
        <div
          key={branch.name}
          onContextMenu={showContextMenu}
          onClick={() => window.electronAPI.git.checkout(branch.name)}
          className={`
            flex items-center gap-2 px-3 py-1 cursor-pointer transition-colors
            ${branch.current ? 'text-primary-400' : 'hover:bg-sidebar-hover'}
          `}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-sm truncate flex-1">{branch.name}</span>
          {branch.current && (
            <span className="text-xs text-primary-500">当前</span>
          )}
        </div>
      ))}

      {/* 远程分支 */}
      {remoteBranches.length > 0 && (
        <>
          <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase mt-2">
            {zhCN.branch.remote}
          </div>
          {remoteBranches.map((branch) => (
            <div
              key={branch.name}
              onContextMenu={showContextMenu}
              onClick={() => window.electronAPI.git.checkout(branch.name)}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-sidebar-hover transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <span className="text-sm truncate text-gray-400 pl-2">↳ {branch.name}</span>
            </div>
          ))}
        </>
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
