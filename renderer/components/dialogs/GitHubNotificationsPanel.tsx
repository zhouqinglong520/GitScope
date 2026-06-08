/**
 * P1-6: GitHub 通知面板 — Fork 风格
 * 在侧边栏展示 GitHub/GitLab 通知
 * 支持配置 GitHub Token + 定时拉取
 */

import React, { useState, useEffect, useCallback } from 'react';

const COLOR = {
  card: '#1e2229', cardBorder: '#2d333b', inputBg: '#0d1117', inputBorder: '#30363d',
  text: '#e6edf3', textMuted: '#8b949e', textFaint: '#484f58',
  accent: '#00d4aa', accentDim: '#00d4aa22',
  btnBg: '#21262d', btnBorder: '#30363d', divider: '#21262d',
  overlay: 'rgba(0,0,0,0.65)',
};

interface GitHubNotification {
  id: string;
  subject: { title: string; type: string; url: string };
  repository: { name: string; full_name: string };
  reason: string;
  updated_at: string;
  unread: boolean;
}

interface NotificationsPanelProps {
  onClose: () => void;
}

export function GitHubNotificationsPanel({ onClose }: NotificationsPanelProps) {
  const [token, setToken] = useState('');
  const [notifications, setNotifications] = useState<GitHubNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try { const saved = localStorage.getItem('majie_github_token'); if (saved) setToken(saved); } catch {}
  }, []);

  useEffect(() => {
    if (token) {
      fetchNotifications(token);
    }
  }, [token]);

  const fetchNotifications = async (t: string) => {
    if (!t) return;
    setLoading(true); setError('');
    try {
      const data = await window.electronAPI.git.getGitHubNotifications(t);
      setNotifications(data || []);
    } catch (e: any) { setError(e.message || '获取通知失败'); }
    finally { setLoading(false); }
  };

  const handleSaveToken = () => {
    try { localStorage.setItem('majie_github_token', token); } catch {}
    if (token) fetchNotifications(token);
  };

  const handleRefresh = () => {
    if (token) fetchNotifications(token);
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  const reasonMap: Record<string, string> = {
    assign: '已分配',
    author: '作者',
    comment: '评论',
    invitation: '邀请',
    mention: '提及',
    review_requested: '审查请求',
    security_alert: '安全警告',
    state_change: '状态变更',
    subscribed: '已订阅',
    team_mention: '团队提及',
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'PullRequest': return '🔀';
      case 'Issue': return '❗';
      case 'Commit': return '📦';
      case 'Release': return '🏷️';
      default: return '📝';
    }
  };

  const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = COLOR.accent; e.currentTarget.style.boxShadow = `0 0 0 2px ${COLOR.accentDim}`; };
  const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = COLOR.inputBorder; e.currentTarget.style.boxShadow = 'none'; };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLOR.overlay, backdropFilter: 'blur(6px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 500, maxHeight: 600, background: COLOR.card, border: `1px solid ${COLOR.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 12px', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: COLOR.text }}>
            <svg width="16" height="16" fill="none" stroke={COLOR.accent} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            GitHub 通知
            {unreadCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, background: '#58a6ff', color: '#fff', padding: '1px 7px', borderRadius: 10 }}>{unreadCount}</span>}
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={handleRefresh} disabled={loading || !token} style={{ background: 'none', border: `1px solid ${COLOR.inputBorder}`, color: COLOR.textMuted, cursor: (loading || !token) ? 'not-allowed' as const : 'pointer' as const, fontSize: 12, padding: '4px 10px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: loading ? 'rotate(360deg)' : 'none', transition: 'transform 0.3s' }}><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              刷新
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: COLOR.textMuted, cursor: 'pointer', fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>✕</button>
          </div>
        </div>

        {/* Token 配置 */}
        <div style={{ padding: '0 24px 12px', flexShrink: 0, borderBottom: `1px solid ${COLOR.divider}` }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: COLOR.textMuted, marginBottom: 6 }}>GitHub Personal Access Token</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ flex: 1, boxSizing: 'border-box' as const, background: COLOR.inputBg, border: `1px solid ${COLOR.inputBorder}`, borderRadius: 6, padding: '6px 12px', color: COLOR.text, fontSize: 12, outline: 'none' as const }} type="password" placeholder="ghp_xxxxxxxxxxxx" value={token} onChange={e => setToken(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
            <button onClick={handleSaveToken} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, background: COLOR.btnBg, color: COLOR.accent, border: `1px solid ${COLOR.accentDim}`, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>保存</button>
          </div>
          <div style={{ fontSize: 10, color: COLOR.textFaint, marginTop: 4 }}>
            需要 <code style={{ color: COLOR.textMuted }}>notifications</code> 权限。
            <a href="https://github.com/settings/tokens/new?scopes=notifications" target="_blank" rel="noreferrer" style={{ color: COLOR.accent, marginLeft: 4 }}>创建 Token →</a>
          </div>
        </div>

        {/* 通知列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {!token && (
            <div style={{ textAlign: 'center', padding: '32px 24px', color: COLOR.textFaint, fontSize: 13 }}>
              请先配置 GitHub Token 以查看通知
            </div>
          )}
          {loading && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: COLOR.textMuted, fontSize: 13 }}>加载中...</div>
          )}
          {!loading && token && notifications.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: COLOR.accent, fontSize: 13 }}>✓ 没有未读通知</div>
          )}
          {!loading && notifications.map(n => (
            <div key={n.id} style={{ padding: '8px 24px', borderBottom: `1px solid ${COLOR.divider}`, display: 'flex', gap: 10, alignItems: 'flex-start', background: n.unread ? COLOR.accentDim.replace('22', '08') : 'transparent', cursor: 'pointer' }} onClick={() => { if (n.subject.url) window.electronAPI.shell.openExternal(n.subject.url.replace('api.github.com/repos', 'github.com').replace('/pulls/', '/pull/').replace('/issues/', '/issues/')); }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 2 }}>{typeIcon(n.subject.type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: n.unread ? COLOR.text : COLOR.textMuted, fontWeight: n.unread ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{n.subject.title}</div>
                <div style={{ fontSize: 11, color: COLOR.textFaint, marginTop: 2, display: 'flex', gap: 8 }}>
                  <span>{n.repository.full_name}</span>
                  <span style={{ color: COLOR.accent }}>{reasonMap[n.reason] || n.reason}</span>
                  <span>{new Date(n.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
              {n.unread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#58a6ff', flexShrink: 0, marginTop: 6 }} />}
            </div>
          ))}
        </div>

        {error && <div style={{ padding: '8px 24px', fontSize: 12, color: COLOR.danger, background: '#f8514922', borderTop: `1px solid ${COLOR.divider}` }}>⚠ {error}</div>}
      </div>
    </div>
  );
}
