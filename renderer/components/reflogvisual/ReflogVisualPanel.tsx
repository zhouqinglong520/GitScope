/**
 * Reflog 可视化时间线面板
 * 图形化展示 Git 操作历史 + 时间线 + 操作类型色彩编码
 * 独家：可视化 reflog 时间线，替代所有竞品的纯文字列表
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ReflogEntry } from '../../../shared/types/git';
import './ReflogVisualPanel.css';

// ReflogEntry imported from shared

interface Props {
  visible: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

// 操作类型分组和配色
const ACTION_GROUPS: Record<string, { color: string; bg: string; icon: string; group: string }> = {
  commit:     { color: '#6cc644', bg: 'rgba(108,198,68,0.12)',  icon: '📝', group: '提交' },
  rebase:     { color: '#b47ccf', bg: 'rgba(180,124,207,0.12)', icon: '🔄', group: '变基' },
  merge:      { color: '#5799da', bg: 'rgba(87,153,218,0.12)',  icon: '🔀', group: '合并' },
  checkout:   { color: '#52c4e8', bg: 'rgba(82,196,232,0.12)',  icon: '🔀', group: '检出' },
  reset:      { color: '#e85d75', bg: 'rgba(232,93,117,0.12)',  icon: '⏪', group: '重置' },
  'cherry-pick': { color: '#e2a855', bg: 'rgba(226,168,85,0.12)', icon: '🍒', group: '摘取' },
  pull:       { color: '#5799da', bg: 'rgba(87,153,218,0.12)',  icon: '⬇️', group: '远程' },
  push:       { color: '#6cc644', bg: 'rgba(108,198,68,0.12)',  icon: '⬆️', group: '远程' },
  clone:      { color: '#72d6c9', bg: 'rgba(114,214,201,0.12)', icon: '📋', group: '远程' },
  stash:      { color: '#f0c674', bg: 'rgba(240,198,116,0.12)', icon: '📦', group: '暂存' },
  branch:     { color: '#6cc644', bg: 'rgba(108,198,68,0.12)',  icon: '🌿', group: '分支' },
  tag:        { color: '#e2a855', bg: 'rgba(226,168,85,0.12)',  icon: '🏷️', group: '标签' },
};

function getActionMeta(action: string) {
  const key = action.toLowerCase().split(' ')[0];
  return ACTION_GROUPS[key] || { color: '#8b949e', bg: 'rgba(139,148,158,0.12)', icon: '📌', group: '其他' };
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export const ReflogVisualPanel: React.FC<Props> = ({ visible, onClose, onRefresh }) => {
  const [entries, setEntries] = useState<ReflogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [resetMode, setResetMode] = useState<'soft' | 'mixed' | 'hard'>('mixed');
  const [previewOid, setPreviewOid] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<{ oid: string; shortOid: string; mode: string } | null>(null);

  useEffect(() => { if (visible) loadReflog(); }, [visible]);

  const loadReflog = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.git.getReflog();
      setEntries(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // 按时间分组（今天 / 昨天 / 本周 / 更早）
  const groupedEntries = useMemo(() => {
    let filtered = entries;
    if (filter) {
      const q = filter.toLowerCase();
      filtered = filtered.filter(e =>
        e.message.toLowerCase().includes(q) ||
        e.shortOid.includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.ref.toLowerCase().includes(q)
      );
    }
    if (filterGroup !== 'all') {
      filtered = filtered.filter(e => getActionMeta(e.action).group === filterGroup);
    }

    const groups: { label: string; entries: ReflogEntry[] }[] = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
    const yesterdayStart = todayStart - 86400;
    const weekStart = todayStart - 604800;

    const today: ReflogEntry[] = [];
    const yesterday: ReflogEntry[] = [];
    const thisWeek: ReflogEntry[] = [];
    const older: ReflogEntry[] = [];

    for (const e of filtered) {
      if (e.timestamp >= todayStart) today.push(e);
      else if (e.timestamp >= yesterdayStart) yesterday.push(e);
      else if (e.timestamp >= weekStart) thisWeek.push(e);
      else older.push(e);
    }

    if (today.length) groups.push({ label: '今天', entries: today });
    if (yesterday.length) groups.push({ label: '昨天', entries: yesterday });
    if (thisWeek.length) groups.push({ label: '本周', entries: thisWeek });
    if (older.length) groups.push({ label: '更早', entries: older });

    return groups;
  }, [entries, filter, filterGroup]);

  // 统计每组数量
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      const group = getActionMeta(e.action).group;
      counts[group] = (counts[group] || 0) + 1;
    }
    return counts;
  }, [entries]);

  const handleReset = async () => {
    if (!showConfirm) return;
    const { oid, mode } = showConfirm;
    try {
      await window.electronAPI.git.resetTo(oid, mode as any);
      setShowConfirm(null);
      setPreviewOid(null);
      loadReflog();
      onRefresh?.();
    } catch (e: any) { alert(e.message); }
  };

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha).catch(() => {});
  };

  if (!visible) return null;

  return (
    <div className="rvp-overlay">
      <div className="rvp-dialog">
        {/* Header */}
        <div className="rvp-header">
          <div className="rvp-header-left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <h3 className="rvp-title">操作历史</h3>
            <span className="rvp-subtitle">可视化 Reflog</span>
          </div>
          <button className="rvp-close" onClick={onClose}>✕</button>
        </div>

        {/* Toolbar */}
        <div className="rvp-toolbar">
          <div className="rvp-filter">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              className="rvp-filter-input"
              placeholder="搜索操作/SHA/引用..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
          <div className="rvp-group-filters">
            <button
              className={`rvp-group-btn ${filterGroup === 'all' ? 'active' : ''}`}
              onClick={() => setFilterGroup('all')}
            >
              全部
            </button>
            {Object.entries(groupCounts).sort((a, b) => b[1] - a[1]).map(([group, count]) => (
              <button
                key={group}
                className={`rvp-group-btn ${filterGroup === group ? 'active' : ''}`}
                onClick={() => setFilterGroup(group)}
              >
                {group} ({count})
              </button>
            ))}
          </div>
          <div className="rvp-toolbar-right">
            <select
              className="rvp-reset-mode"
              value={resetMode}
              onChange={e => setResetMode(e.target.value as any)}
            >
              <option value="soft">Soft Reset</option>
              <option value="mixed">Mixed Reset</option>
              <option value="hard">Hard Reset</option>
            </select>
            <button className="rvp-refresh-btn" onClick={loadReflog}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="rvp-timeline">
          {loading ? (
            <div className="rvp-loading">加载中...</div>
          ) : groupedEntries.length === 0 ? (
            <div className="rvp-empty">暂无操作记录</div>
          ) : (
            groupedEntries.map(group => (
              <div key={group.label} className="rvp-group">
                <div className="rvp-group-label">{group.label}</div>
                {group.entries.map((entry, idx) => {
                  const meta = getActionMeta(entry.action);
                  const isLast = idx === group.entries.length - 1;
                  const isPreview = previewOid === entry.oid;

                  return (
                    <div
                      key={`${entry.oid}-${idx}`}
                      className={`rvp-entry ${isPreview ? 'rvp-entry-preview' : ''}`}
                      onMouseEnter={() => setPreviewOid(entry.oid)}
                      onMouseLeave={() => setPreviewOid(null)}
                    >
                      {/* Timeline line */}
                      <div className="rvp-timeline-line">
                        <div
                          className="rvp-dot"
                          style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}40` }}
                        />
                        {!isLast && <div className="rvp-connector" />}
                      </div>

                      {/* Content */}
                      <div className="rvp-entry-content">
                        <div className="rvp-entry-top">
                          <span className="rvp-action-badge" style={{ color: meta.color, background: meta.bg }}>
                            {meta.icon} {entry.action}
                          </span>
                          <span
                            className="rvp-sha"
                            title={entry.oid}
                            onClick={() => handleCopySha(entry.oid)}
                          >
                            {entry.shortOid}
                          </span>
                          {entry.ref && <span className="rvp-ref">{entry.ref}</span>}
                          <span className="rvp-time">{formatTime(entry.timestamp)}</span>
                        </div>
                        <div className="rvp-entry-bottom">
                          <span className="rvp-message">{entry.message || entry.action}</span>
                          <span className="rvp-date-full">{formatDate(entry.timestamp)}</span>
                        </div>

                        {/* Hover actions */}
                        <div className="rvp-entry-actions">
                          <button
                            className="rvp-action-btn"
                            title={`重置到此 (${resetMode})`}
                            onClick={() => setShowConfirm({ oid: entry.oid, shortOid: entry.shortOid, mode: resetMode })}
                          >
                            ⏪ 重置
                          </button>
                          <button
                            className="rvp-action-btn"
                            title="复制 SHA"
                            onClick={() => handleCopySha(entry.oid)}
                          >
                            📋 复制
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="rvp-footer">
          <span className="rvp-footer-info">共 {entries.length} 条操作记录</span>
          <span className="rvp-footer-hint">悬停查看详情 · 点击 ⏪ 回滚到该节点</span>
        </div>

        {/* Confirm Dialog */}
        {showConfirm && (
          <div className="rvp-confirm-overlay">
            <div className="rvp-confirm">
              <div className="rvp-confirm-title">⚠️ 确认重置</div>
              <div className="rvp-confirm-body">
                <p>即将执行 <strong>{showConfirm.mode}</strong> 重置到 <code>{showConfirm.shortOid}</code></p>
                <p className="rvp-confirm-desc">
                  {showConfirm.mode === 'soft' && '保留暂存区和工作区更改'}
                  {showConfirm.mode === 'mixed' && '保留工作区更改，清除暂存区'}
                  {showConfirm.mode === 'hard' && '⚠️ 丢弃所有更改，此操作不可撤销！'}
                </p>
              </div>
              <div className="rvp-confirm-actions">
                <button className="rvp-btn-cancel" onClick={() => setShowConfirm(null)}>取消</button>
                <button
                  className={`rvp-btn-confirm ${showConfirm.mode === 'hard' ? 'rvp-btn-danger' : ''}`}
                  onClick={handleReset}
                >
                  确认重置
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReflogVisualPanel;
