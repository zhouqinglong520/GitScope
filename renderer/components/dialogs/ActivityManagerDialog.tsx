/**
 * P2-8: 操作活动管理器
 * 记录和展示所有 Git 操作的历史，支持筛选和清空
 */
import React, { useState, useEffect, useCallback } from 'react';

interface ActivityEntry { id: string; action: string; detail: string; timestamp: number; status: 'running' | 'success' | 'failed'; }

const C = {
  card: '#1e2229', border: '#2d333b', inputBg: '#0d1117', inputBorder: '#30363d',
  focus: '#00d4aa', text: '#e6edf3', muted: '#8b949e', faint: '#484f58',
  danger: '#f85149', dangerBg: '#f8514922', accent: '#00d4aa', accentBg: '#00d4aa22',
  success: '#3fb950', successBg: '#3fb95022', overlay: 'rgba(0,0,0,0.65)',
  btn: '#21262d', btnBorder: '#30363d', btnHover: '#30363d',
};

const STATUS_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  running: { icon: '⏳', color: '#e8c547', bg: '#e8c54722', label: '执行中' },
  success: { icon: '✓', color: C.success, bg: C.successBg, label: '成功' },
  failed: { icon: '✕', color: C.danger, bg: C.dangerBg, label: '失败' },
};

const ACTION_ICONS: Record<string, string> = {
  commit: '✏️', push: '↑', pull: '↓', fetch: '↻', merge: '⊕', rebase: '⟳',
  checkout: '↗', branch: '⑂', tag: '🏷', stash: '📦', clone: '⬇', reset: '⏪',
  cherry_pick: '🍒', revert: '↩', bisect: '🔍', flow: '🌊', default: '⚡',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getActionIcon(action: string): string {
  const key = action.toLowerCase().replace(/[- ]/g, '_');
  for (const [k, v] of Object.entries(ACTION_ICONS)) { if (key.includes(k)) return v; }
  return ACTION_ICONS.default;
}

interface Props { onClose: () => void; }

export const ActivityManagerDialog: React.FC<Props> = ({ onClose }) => {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'running' | 'success' | 'failed'>('all');

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try { setActivities(await window.electronAPI.git.getActivityLog(100)); }
    catch { setActivities([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  const handleClear = async () => {
    await window.electronAPI.git.clearActivityLog();
    setActivities([]);
  };

  const filtered = filter === 'all' ? activities : activities.filter(a => a.status === filter);
  const runningCount = activities.filter(a => a.status === 'running').length;
  const failedCount = activities.filter(a => a.status === 'failed').length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, width: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ color: C.text, fontSize: 15, fontWeight: 600, margin: 0 }}>操作活动管理器</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {runningCount > 0 && <span style={{ color: '#e8c547', fontSize: 11, background: '#e8c54722', padding: '2px 8px', borderRadius: 10 }}>{runningCount} 执行中</span>}
            {failedCount > 0 && <span style={{ color: C.danger, fontSize: 11, background: C.dangerBg, padding: '2px 8px', borderRadius: 10 }}>{failedCount} 失败</span>}
            <button onClick={handleClear} style={{ fontSize: 11, padding: '4px 10px', background: C.btn, color: C.muted, border: `1px solid ${C.btnBorder}`, borderRadius: 6, cursor: 'pointer' }}>清空</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
        </div>

        {/* 筛选 Tab */}
        <div style={{ display: 'flex', gap: 0, padding: '8px 20px 0', borderBottom: `1px solid ${C.border}` }}>
          {(['all', 'success', 'failed', 'running'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', fontSize: 12, cursor: 'pointer',
              background: 'none', border: 'none', borderBottom: filter === f ? `2px solid ${C.accent}` : '2px solid transparent',
              color: filter === f ? C.accent : C.muted, fontWeight: filter === f ? 600 : 400,
            }}>
              {f === 'all' ? '全部' : f === 'running' ? '执行中' : f === 'success' ? '成功' : '失败'}
            </button>
          ))}
        </div>

        {/* 活动列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: C.muted, padding: 40 }}>加载中...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.faint, padding: 40, fontSize: 13 }}>暂无操作记录</div>
          ) : (
            filtered.map(act => {
              const sc = STATUS_CONFIG[act.status] || STATUS_CONFIG.running;
              return (
                <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, borderLeft: `3px solid ${sc.color}`, background: sc.bg, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>{getActionIcon(act.action)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{act.action}</span>
                      <span style={{ fontSize: 10, color: sc.color, background: sc.bg, padding: '1px 6px', borderRadius: 4, border: `1px solid ${sc.color}33` }}>{sc.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.detail}</div>
                  </div>
                  <span style={{ fontSize: 11, color: C.faint, flexShrink: 0, fontFamily: 'monospace' }}>{formatTime(act.timestamp)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
