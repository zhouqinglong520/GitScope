/**
 * Reflog 查看面板
 * 查看 Git 操作历史、回滚到任意状态
 * 增强：时间格式化、操作类型图标、批量选择
 */
import React, { useState, useEffect } from 'react';
import './ReflogPanel.css';

interface ReflogEntry {
  oid: string; shortOid: string; action: string;
  ref: string; message: string; timestamp: number; author: string;
}

interface Props { visible: boolean; onClose: () => void; onRefresh?: () => void; }

const ACTION_ICONS: Record<string, string> = {
  'commit': '📝', 'rebase': '🔄', 'merge': '🔀', 'checkout': '🔀',
  'reset': '⏪', 'cherry-pick': '🍒', 'pull': '⬇️', 'push': '⬆️',
  'clone': '📋', 'stash': '📦', 'branch': '🌿', 'tag': '🏷️',
};

const formatTime = (ts: number): string => {
  const d = new Date(ts * 1000);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return d.toLocaleDateString('zh-CN');
};

export const ReflogPanel: React.FC<Props> = ({ visible, onClose, onRefresh }) => {
  const [entries, setEntries] = useState<ReflogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [resetMode, setResetMode] = useState<'soft' | 'mixed' | 'hard'>('mixed');

  useEffect(() => { if (visible) loadReflog(); }, [visible]);

  const loadReflog = async () => {
    setLoading(true);
    try { setEntries(await window.electronAPI.git.getReflog()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleReset = async (oid: string) => {
    const modeLabel = { soft: '软重置（保留暂存区和工作区）', mixed: '混合重置（保留工作区）', hard: '硬重置（⚠️ 丢弃所有更改）' }[resetMode];
    if (!confirm(`确定 ${modeLabel} 到 ${oid.substring(0, 7)}?\n${resetMode === 'hard' ? '此操作不可撤销！' : ''}`)) return;
    try {
      await window.electronAPI.git.resetTo(oid, resetMode);
      loadReflog();
      onRefresh?.();
    } catch (e: any) { alert(e.message); }
  };

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha).catch(() => {});
  };

  const filtered = filter ? entries.filter(e =>
    e.message.toLowerCase().includes(filter.toLowerCase()) ||
    e.shortOid.includes(filter) ||
    e.action.toLowerCase().includes(filter.toLowerCase()) ||
    e.ref.toLowerCase().includes(filter.toLowerCase())
  ) : entries;

  if (!visible) return null;

  return (
    <div className="reflog-overlay">
      <div className="reflog-dialog">
        <div className="reflog-header">
          <h3>📋 Reflog</h3>
          <input className="reflog-filter" placeholder="搜索操作/SHA/引用..." value={filter} onChange={e => setFilter(e.target.value)} />
          <div className="reflog-reset-mode">
            <label>重置模式:</label>
            <select value={resetMode} onChange={e => setResetMode(e.target.value as any)}>
              <option value="soft">Soft</option>
              <option value="mixed">Mixed</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="reflog-meta">
          <span>共 {filtered.length} 条记录</span>
          <button className="reflog-refresh" onClick={loadReflog}>🔄 刷新</button>
        </div>
        <div className="reflog-list">
          {loading ? <div>加载中...</div> :
           filtered.length === 0 ? <div className="empty">暂无记录</div> :
           filtered.map((e, i) => {
             const icon = ACTION_ICONS[e.action] || '📌';
             return (
               <div key={i} className="reflog-item">
                 <span className="reflog-icon">{icon}</span>
                 <span className="reflog-sha" title={e.oid} onClick={() => handleCopySha(e.oid)} style={{ cursor: 'pointer' }}>{e.shortOid}</span>
                 <span className="reflog-msg">{e.action || e.message}</span>
                 {e.ref && <span className="reflog-ref">{e.ref}</span>}
                 <span className="reflog-time">{formatTime(e.timestamp)}</span>
                 <div className="reflog-actions">
                   <button className="reflog-reset-btn" onClick={() => handleReset(e.oid)} title={`重置到此 (${resetMode})`}>⏪</button>
                 </div>
               </div>
             );
           })
          }
        </div>
      </div>
    </div>
  );
};
export default ReflogPanel;
