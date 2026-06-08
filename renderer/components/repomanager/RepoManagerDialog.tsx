/**
 * 仓库管理器（增强版）
 * 分组、颜色标签、统计信息、收藏、搜索、克隆、重命名
 * 接入 repoStore 数据
 */
import React, { useState, useEffect, useMemo } from 'react';
import './RepoManagerDialog.css';

interface RepoGroup { name: string; repos: RepoItem[]; }
interface RepoItem {
  id: string; name: string; path: string; branch: string;
  group?: string; color?: string; isFavorite: boolean;
  lastOpened?: number; commitCount?: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectRepo: (path: string) => void;
  repos: Array<{ id: string; name: string; path: string; branch?: string; lastOpened?: number }>;
  activeRepoId?: string;
}

const GROUP_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#FF5722', '#00BCD4', '#795548', '#607D8B'];

export const RepoManagerDialog: React.FC<Props> = ({ visible, onClose, onSelectRepo, repos, activeRepoId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [repoGroups, setRepoGroups] = useState<Record<string, string>>({});
  const [repoColors, setRepoColors] = useState<Record<string, string>>({});
  const [repoRenames, setRepoRenames] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<any>(null);
  const [showClone, setShowClone] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [clonePath, setClonePath] = useState('');
  const [cloneBranch, setCloneBranch] = useState('');
  const [cloning, setCloning] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextRepo, setContextRepo] = useState<string | null>(null);

  // 从 localStorage 恢复
  useEffect(() => {
    try {
      const fav = localStorage.getItem('majie_favorites');
      if (fav) setFavoriteIds(new Set(JSON.parse(fav)));
      const groups = localStorage.getItem('majie_repo_groups');
      if (groups) setRepoGroups(JSON.parse(groups));
      const colors = localStorage.getItem('majie_repo_colors');
      if (colors) setRepoColors(JSON.parse(colors));
      const renames = localStorage.getItem('majie_repo_renames');
      if (renames) setRepoRenames(JSON.parse(renames));
    } catch {}
  }, []);

  const toggleFavorite = (repoId: string) => {
    const next = new Set(favoriteIds);
    if (next.has(repoId)) next.delete(repoId); else next.add(repoId);
    setFavoriteIds(next);
    localStorage.setItem('majie_favorites', JSON.stringify([...next]));
  };

  const setGroup = (repoId: string, group: string) => {
    const next = { ...repoGroups, [repoId]: group };
    if (!group) delete next[repoId];
    setRepoGroups(next);
    localStorage.setItem('majie_repo_groups', JSON.stringify(next));
  };

  const setColor = (repoId: string, color: string) => {
    const next = { ...repoColors, [repoId]: color };
    if (!color) delete next[repoId];
    setRepoColors(next);
    localStorage.setItem('majie_repo_colors', JSON.stringify(next));
  };

  const handleRename = (repoId: string) => {
    if (!renameValue.trim()) return;
    const next = { ...repoRenames, [repoId]: renameValue.trim() };
    setRepoRenames(next);
    localStorage.setItem('majie_repo_renames', JSON.stringify(next));
    setRenamingId(null);
  };

  const handleClone = async () => {
    if (!cloneUrl || !clonePath) return;
    setCloning(true);
    try {
      await window.electronAPI.git.clone(cloneUrl, clonePath);
      setShowClone(false);
      setCloneUrl('');
      setClonePath('');
      setCloneBranch('');
    } catch (e: any) { alert(e.message); }
    finally { setCloning(false); }
  };

  const handleViewStats = async () => {
    try { setStats(await window.electronAPI.git.getRepoStats()); }
    catch (e) { console.error(e); }
  };

  // 构建分组数据
  const groupedRepos = useMemo(() => {
    const repoItems: RepoItem[] = repos.map(r => ({
      id: r.id, name: repoRenames[r.id] || r.name, path: r.path,
      branch: r.branch || 'main',
      group: repoGroups[r.id],
      color: repoColors[r.id],
      isFavorite: favoriteIds.has(r.id),
      lastOpened: r.lastOpened,
    }));

    const filtered = searchQuery
      ? repoItems.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.path.toLowerCase().includes(searchQuery.toLowerCase()))
      : repoItems;

    const groups: Record<string, RepoItem[]> = {};
    const ungrouped: RepoItem[] = [];

    filtered.forEach(r => {
      if (r.group) {
        if (!groups[r.group]) groups[r.group] = [];
        groups[r.group].push(r);
      } else {
        ungrouped.push(r);
      }
    });

    return { groups, ungrouped, favorites: filtered.filter(r => r.isFavorite) };
  }, [repos, searchQuery, favoriteIds, repoGroups, repoColors, repoRenames]);

  if (!visible) return null;

  const allGroups = Object.keys(groupedRepos.groups);

  const renderRepoItem = (r: RepoItem) => (
    <div
      key={r.id}
      className={`rm-repo-item ${activeRepoId === r.id ? 'active' : ''}`}
      onClick={() => { onSelectRepo(r.path); onClose(); }}
      style={{ borderLeftColor: r.color || 'transparent' }}
      onContextMenu={(e) => { e.preventDefault(); setContextRepo(contextRepo === r.id ? null : r.id); }}
    >
      <button className="rm-star-btn" onClick={(e) => { e.stopPropagation(); toggleFavorite(r.id); }}>
        {r.isFavorite ? '⭐' : '☆'}
      </button>
      {renamingId === r.id ? (
        <input
          className="rm-rename-input"
          value={renameValue}
          onChange={e => setRenameValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRename(r.id)}
          onBlur={() => setRenamingId(null)}
          onClick={e => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <span className="rm-repo-name">{r.name}</span>
      )}
      <span className="rm-repo-branch">{r.branch}</span>
      {/* 右键菜单（简化内联） */}
      {contextRepo === r.id && (
        <div className="rm-context-menu" onClick={e => e.stopPropagation()}>
          <button onClick={() => { setRenamingId(r.id); setRenameValue(r.name); setContextRepo(null); }}>重命名</button>
          <div className="rm-color-row">
            {GROUP_COLORS.map(c => (
              <span key={c} className="rm-color-dot" style={{ background: c }} onClick={() => { setColor(r.id, c); setContextRepo(null); }} />
            ))}
            <span className="rm-color-dot rm-color-clear" onClick={() => { setColor(r.id, ''); setContextRepo(null); }}>✕</span>
          </div>
          <input
            placeholder="分组名"
            className="rm-group-input"
            onKeyDown={e => { if (e.key === 'Enter') { setGroup(r.id, (e.target as HTMLInputElement).value); setContextRepo(null); } }}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="rm-overlay">
      <div className="rm-dialog">
        <div className="rm-header">
          <h3>仓库管理器</h3>
          <button className="rm-clone-btn" onClick={() => setShowClone(!showClone)}>+ 克隆</button>
          <div className="rm-search-bar">
            <input placeholder="搜索仓库..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="rm-view-toggle">
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>☰</button>
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}>⊞</button>
          </div>
          <button className="btn-stats" onClick={handleViewStats}>统计</button>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {/* 克隆表单 */}
        {showClone && (
          <div className="rm-clone-form">
            <div className="rm-clone-row">
              <label>仓库 URL</label>
              <input placeholder="https://github.com/user/repo.git" value={cloneUrl} onChange={e => setCloneUrl(e.target.value)} />
            </div>
            <div className="rm-clone-row">
              <label>本地路径</label>
              <input placeholder="目标文件夹路径" value={clonePath} onChange={e => setClonePath(e.target.value)} />
            </div>
            <div className="rm-clone-row">
              <label>分支（可选）</label>
              <input placeholder="如 main" value={cloneBranch} onChange={e => setCloneBranch(e.target.value)} />
            </div>
            <div className="rm-clone-actions">
              <button onClick={() => setShowClone(false)}>取消</button>
              <button className="rm-clone-start" onClick={handleClone} disabled={cloning || !cloneUrl || !clonePath}>
                {cloning ? '克隆中...' : '开始克隆'}
              </button>
            </div>
          </div>
        )}

        <div className="rm-content">
          <div className="rm-sidebar">
            {/* 收藏 */}
            {groupedRepos.favorites.length > 0 && (
              <div className="rm-group">
                <div className="rm-group-header">⭐ 收藏 ({groupedRepos.favorites.length})</div>
                {groupedRepos.favorites.map(r => renderRepoItem(r))}
              </div>
            )}

            {/* 分组 */}
            {allGroups.map(g => (
              <div key={g} className="rm-group">
                <div className="rm-group-header">📂 {g} ({groupedRepos.groups[g].length})</div>
                {groupedRepos.groups[g].map(r => renderRepoItem(r))}
              </div>
            ))}

            {/* 未分组 */}
            {groupedRepos.ungrouped.length > 0 && (
              <div className="rm-group">
                <div className="rm-group-header">📂 全部仓库 ({groupedRepos.ungrouped.length})</div>
                {groupedRepos.ungrouped.map(r => renderRepoItem(r))}
              </div>
            )}
          </div>

          <div className="rm-main">
            {stats && (
              <div className="rm-stats">
                <div className="rm-stat-item"><span>提交数</span><span>{stats.commitCount}</span></div>
                <div className="rm-stat-item"><span>分支数</span><span>{stats.branchCount}</span></div>
                <div className="rm-stat-item"><span>标签数</span><span>{stats.tagCount}</span></div>
                <div className="rm-stat-item"><span>贡献者</span><span>{stats.contributorCount}</span></div>
                {stats.totalSize && <div className="rm-stat-item"><span>仓库大小</span><span>{(stats.totalSize / 1024 / 1024).toFixed(1)} MB</span></div>}
              </div>
            )}
            <div className="rm-empty">
              {repos.length === 0 ? '打开或克隆仓库开始使用' : `共 ${repos.length} 个仓库`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default RepoManagerDialog;
