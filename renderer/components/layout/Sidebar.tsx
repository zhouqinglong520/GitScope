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

  const [expandedSections, setExpandedSections] = useState<Set<SectionType>>(
    new Set(['repositories', 'branches'])
  );

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
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-elevated)' }}>
      {/* 仓库标题栏 */}
      <div className="h-9 flex items-center justify-between px-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-overlay)' }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
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
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div
        onClick={onToggle}
        className="sidebar-section-header"
        style={{ padding: '6px 12px' }}
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
          style={{ color: 'var(--text-faint)', transitionDuration: 'var(--duration-fast)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {icon && <span style={{ color: 'var(--text-muted)' }}>{icon}</span>}
        <span className="sidebar-section-title flex-1">{title}</span>
      </div>
      <div style={{
        maxHeight: expanded ? '1000px' : '0',
        overflow: 'hidden',
        transition: 'max-height var(--duration-slow) var(--ease-out)',
        opacity: expanded ? 1 : 0,
      }}>
        <div style={{ paddingBottom: 4 }}>{children}</div>
      </div>
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
          className={`sidebar-item ${activeRepoId === repo.id ? 'sidebar-item-active' : ''}`}
          style={{ paddingLeft: 28 }}
        >
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">{repo.name}</div>
            <div className="text-xs text-gray-500 truncate">{repo.path}</div>
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
  const { branches, refresh } = useRepoStore();

  const localBranches = branches.filter((b) => !b.remote);
  const remoteBranches = branches.filter((b) => b.remote);

  const checkoutLocalBranch = async (branchName: string) => {
    try {
      await window.electronAPI.git.checkout(branchName);
      await refresh();
    } catch (err) {
      console.error('[Sidebar] 切换分支失败:', err);
    }
  };

  const checkoutRemoteBranch = async (branchName: string) => {
    try {
      const localName = branchName.replace(/^origin\//, '');
      await window.electronAPI.git.createBranch(localName, branchName);
      await refresh();
    } catch (err) {
      console.error('[Sidebar] 从远程分支创建本地分支失败:', err);
    }
  };

  return (
    <>
      {/* 本地分支 */}
      {localBranches.map((branch) => (
        <BranchItem
          key={branch.name}
          branch={branch}
          onDoubleClick={() => checkoutLocalBranch(branch.name)}
          onRefresh={refresh}
        />
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
              onDoubleClick={() => checkoutRemoteBranch(branch.name)}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-sidebar-hover transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <span className="text-sm truncate text-gray-400">{branch.name}</span>
            </div>
          ))}
        </>
      )}
    </>
  );
}

// 分支项组件（修复：右键菜单正确传递 branchName）
function BranchItem({ branch, onDoubleClick, onRefresh }: {
  branch: { name: string; current: boolean };
  onDoubleClick: () => void;
  onRefresh: () => Promise<void>;
}) {
  const branchName = branch.name;

  const { showContextMenu, ContextMenuWrapper } = useContextMenu(() => {
    const items: MenuItem[] = [
      {
        id: 'new-branch',
        label: '新建分支',
        shortcut: 'Ctrl+B',
        onClick: async () => {
          try {
            const name = await window.electronAPI.fs.showInputBox({
              title: '新建分支',
              prompt: '请输入分支名称',
            });
            if (name) {
              await window.electronAPI.git.createBranch(name);
              await onRefresh();
            }
          } catch (err) {
            console.error('[Sidebar] 新建分支失败:', err);
          }
        },
      },
      {
        id: 'checkout',
        label: '切换到此分支',
        onClick: async () => {
          try {
            await window.electronAPI.git.checkout(branchName);
            await onRefresh();
          } catch (err) {
            console.error('[Sidebar] 切换分支失败:', err);
          }
        },
      },
      { id: 'divider-1', label: '', divider: true },
      {
        id: 'merge',
        label: '合并到当前分支',
        onClick: async () => {
          try {
            await window.electronAPI.git.merge(branchName);
            await onRefresh();
          } catch (err) {
            console.error('[Sidebar] 合并失败:', err);
          }
        },
      },
      {
        id: 'rebase',
        label: '变基到当前分支',
        onClick: () => {
          window.dispatchEvent(new CustomEvent('showInteractiveRebase', { detail: { oid: branchName } }));
        },
      },
      { id: 'divider-2', label: '', divider: true },
      {
        id: 'rename',
        label: '重命名',
        onClick: async () => {
          try {
            const newName = await window.electronAPI.fs.showInputBox({ title: '重命名分支', prompt: `重命名 ${branchName} 为` });
            if (newName) {
              await window.electronAPI.git.renameBranch(branchName, newName);
              await onRefresh();
            }
          } catch (err) {
            console.error('[Sidebar] 重命名失败:', err);
          }
        },
      },
      {
        id: 'delete',
        label: '删除',
        onClick: async () => {
          try {
            await window.electronAPI.git.deleteBranch(branchName, false);
            await onRefresh();
          } catch (err) {
            console.error('[Sidebar] 删除分支失败:', err);
          }
        },
      },
    ];
    return items;
  });

  return (
    <>
      <div
        onContextMenu={showContextMenu}
        onDoubleClick={onDoubleClick}
        className={`sidebar-item ${branch.current ? 'sidebar-item-active' : ''}`}
        style={{ paddingLeft: 28 }}
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="text-sm truncate flex-1">{branchName}</span>
        {branch.current && (
          <span className="sidebar-item-meta" style={{ color: 'var(--accent)' }}>●</span>
        )}
      </div>
      {ContextMenuWrapper}
    </>
  );
}

// 标签列表组件（修复：右键菜单正确传递 tagName）
function TagsSection() {
  const { tags, refresh } = useRepoStore();

  return (
    <>
      {tags.map((tag) => (
        <TagItem key={tag.name} tag={tag} onRefresh={refresh} />
      ))}
    </>
  );
}

function TagItem({ tag, onRefresh }: { tag: { name: string }; onRefresh: () => Promise<void> }) {
  const tagName = tag.name;

  const { showContextMenu, ContextMenuWrapper } = useContextMenu(() => {
    const items: MenuItem[] = [
      {
        id: 'checkout',
        label: '检出此标签',
        onClick: async () => {
          try {
            await window.electronAPI.git.checkout(tagName);
            await onRefresh();
          } catch (err) {
            console.error('[Sidebar] 检出标签失败:', err);
          }
        },
      },
      {
        id: 'push',
        label: '推送标签',
        onClick: async () => {
          try {
            await window.electronAPI.git.pushTag(tagName);
            await onRefresh();
          } catch (err) {
            console.error('[Sidebar] 推送标签失败:', err);
          }
        },
      },
      {
        id: 'delete',
        label: '删除标签',
        onClick: async () => {
          try {
            await window.electronAPI.git.deleteTag(tagName);
            await onRefresh();
          } catch (err) {
            console.error('[Sidebar] 删除标签失败:', err);
          }
        },
      },
    ];
    return items;
  });

  return (
    <>
      <div
        onContextMenu={showContextMenu}
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-sidebar-hover transition-colors"
      >
        <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <span className="text-sm truncate text-gray-300">{tagName}</span>
      </div>
      {ContextMenuWrapper}
    </>
  );
}

// Stash 列表组件（修复：右键菜单正确传递 stashIndex）
function StashSection() {
  const { stashes, refresh } = useRepoStore();

  return (
    <>
      {stashes.map((stash, index) => (
        <StashItem key={stash.id || index} stash={stash} index={index} onRefresh={refresh} />
      ))}
    </>
  );
}

function StashItem({ stash, index, onRefresh }: { stash: { id: string; message: string; date?: string }; index: number; onRefresh: () => Promise<void> }) {
  const stashIndex = index;

  const { showContextMenu, ContextMenuWrapper } = useContextMenu(() => {
    const items: MenuItem[] = [
      {
        id: 'apply',
        label: '应用',
        onClick: async () => {
          try {
            await window.