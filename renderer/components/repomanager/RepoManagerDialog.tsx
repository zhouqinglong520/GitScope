/**
 * 仓库管理器（增强版）
 * 分组、颜色标签、统计信息、收藏
 */
import React, { useState, useEffect } from 'react';
import './RepoManagerDialog.css';

interface RepoGroup { name: string; repos: RepoItem[]; }
interface RepoItem {
  id: string; name: string; path: string; branch: string;
  group?: string; color?: string; isFavorite: boolean;
  lastOpened?: number;
}

interface Props { visible: boolean; onClose: () => void; onSelectRepo: (id: string) => void; }

export const RepoManagerDialog: React.FC<Props> = ({ visible, onClose, onSelectRepo }) => {
  const [groups, setGroups] = useState<RepoGroup[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      // TODO: 从 repoStore 加载分组数据
      // loadGroups();
    }
  }, [visible]);

  const handleViewStats = async (path: string) => {
    try { setStats(await window.electronAPI.git.getRepoStats()); }
    catch (e) { console.error(e); }
  };

  if (!visible) return null;

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
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="rm-content">
          <div className="rm-sidebar">
            <div className="rm-group">
              <div className="rm-group-header">⭐ 收藏</div>
              {/* Favorite repos */}
            </div>
            <div className="rm-group">
              <div className="rm-group-header">📂 全部仓库</div>
              {/* All repos grouped */}
            </div>
          </div>

          <div className="rm-main">
            {stats && (
              <div className="rm-stats">
                <div className="rm-stat-item"><span>提交数</span><span>{stats.commitCount}</span></div>
                <div className="rm-stat-item"><span>分支数</span><span>{stats.branchCount}</span></div>
                <div className="rm-stat-item"><span>标签数</span><span>{stats.tagCount}</span></div>
                <div className="rm-stat-item"><span>贡献者</span><span>{stats.contributorCount}</span></div>
              </div>
            )}
            <div className="rm-repo-list">
              {/* Repo items will be populated from store */}
              <div className="rm-empty">从侧栏选择或打开仓库</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default RepoManagerDialog;
