/**
 * 仓库管理器（增强版）
 * 分组、颜色标签、统计信息、收藏、搜索
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
  const [repoGroups, setRepoGroups] = useState<Record<string, string>>({}); // repoId -> groupName
  const [repoColors, setRepoColors] = useState<Record<string, string>>({}); // repoId -> color
  const [stats, setStats] = useState<any>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);

  // 从 localStorage 恢复收藏和分组
  useEffect(() => {
    try {
      const fav = localStorage.getItem('gitscope_favorites');
      if (fav) setFavoriteIds(new Set(JSON.parse(fav)));
      const groups = localStorage.getItem('gitscope_repo_groups');
      if (groups) setRepoGroups(JSON.parse(groups));
      const colors = localStorage.getItem('gitscope_repo_colors');
      if (colors) setRepoColors(JSON.parse(colors));
    } catch {}
  }, []);

  const toggleFavorite = (repoId: string) => {
    const next = new Set(favoriteIds);
    if (next.has(repoId)) next.delete(repoId); else next.add(repoId);
    setFavoriteIds(next);
    localStorage.setItem('gitscope_favorites', JSON.stringify([...next]));
  };

  const setGroup = (repoId: string, group: string) => {
    const next = { ...repoGroups, [repoId]: group };
    if (!group) delete next[repoId];
    setRepoGroups(next);
    localStorage.setItem('gitscope_repo_groups', JSON.stringify(next));
  };

  const setColor = (repoId: string, color: string) => {
    const next = { ...repoColors, [repoId]: color };
    if (!color) delete next[repoId];
    setRepoColors(next);
    localStorage.setItem('gitscope_repo_colors', JSON.stringify(next));
  };

  const handleViewStats = async () => {
    try { setStats(await window.electronAPI.git.getRepoStats()); }
    catch (e) { console.error(e); }
  };

  // 构建分组数据
  const groupedRepos = useMemo(() => {
    const repoItems: RepoItem[] = repos.map(r => ({
      id: r.id, name: r.name, path: r.path,
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
  }, [repos, searchQuery, favoriteIds, repoGroups, repoColors]);

  if (!visible) return null;

  const allGroups = Object.keys(groupedRepos.groups);

  return (
    <div className="rm-overlay">
      <div className="rm-dialog">
        <div className="rm-header">
          <h3>📁 仓库管理器</h3>
          <div className="rm-search-bar">
            <input placeholder="搜索仓库..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="rm-view-toggle">
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>☰</button>
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}>⊞</button>
          </div>
          <button className="btn-stats" onClick={handleViewStats}>📊 统计</button>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="rm-content">
          <div className="rm-sidebar">
            {/* 收藏 */}
            {groupedRepos.favorites.length > 0 && (
              <div className="rm-group">
                <div className="rm-group-header">⭐ 收藏 ({groupedRepos.favorites.length})</div>
                {groupedRepos.favorites.map(r => (
                  <div
                    key={r.id}
                    className={`rm-repo-item ${activeRepoId === r.id ? 'active' : ''}`}
                    onClick={() => { onSelectRepo(r.path); onClose(); }}
                    style={{ borderLeftColor: r.color || 'transparent' }}
                  >
                    <span className="rm-repo-name">{r.name}</span>
                    <span className="rm-repo-branch">{r.branch}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 分组 */}
            {allGroups.map(g => (
              <div key={g} className="rm-group">
                <div className="rm-group-header">📂 {g} ({groupedRepos.groups[g].length})</div>
                {groupedRepos.groups[g].map(r => (
                  <div
                    key={r.id}
                    className={`rm-repo-item ${activeRepoId === r.id ? 'active' : ''}`}
                    onClick={() => { onSelectRepo(r.path); onClose(); }}
                    style={{ borderLeftColor: r.color || 'transparent' }}
                  >
                    <span className="rm-repo-name">{r.name}</span>
                    <span className="rm-repo-branch">{r.branch}</span>
                    <button className="rm-star-btn" onClick={(e) => { e.stopPropagation(); toggleFavorite(r.id); }}>
                      {r.isFavorite ? '⭐' : '☆'}
                    </button>
                  </div>
                ))}
              </div>
            ))}

            {/* 未分组 */}
            {groupedRepos.ungrouped.length > 0 && (
              <div className="rm-group">
                <div className="rm-group-header">📂 全部仓库 ({groupedRepos.ungrouped.length})</div>
                {groupedRepos.ungrouped.map(r => (
                  <div
                    key={r.id}
                    className={`rm-repo-item ${activeRepoId === r.id ? 'active' : ''}`}
                    onClick={() => { onSelectRepo(r.path); onClose(); }}
                    style={{ borderLeftColor: r.color || 'transparent' }}
                  >
                    <span className="rm-repo-name">{r.name}</span>
                    <span className="rm-repo-branch">{r.branch}</span>
                    <button className="rm-star-btn" onClick={(e) => { e.stopPropagation(); toggleFavorite(r.id); }}>
                      {r.isFavorite ? '⭐' : '☆'}
                    </button>
                  </div>
                ))}
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
              {repos.length === 0 ? '打开仓库开始使用' : `共 ${repos.length} 个仓库`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default RepoManagerDialog;
