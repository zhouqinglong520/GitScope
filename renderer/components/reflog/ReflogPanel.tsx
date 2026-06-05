/**
 * Reflog 查看面板
 * 查看 Git 操作历史、回滚到任意状态
 */
import React, { useState, useEffect } from 'react';
import './ReflogPanel.css';

interface ReflogEntry { oid: string; shortOid: string; action: string; ref: string; message: string; timestamp: number; author: string; }

interface Props { visible: boolean; onClose: () => void; }

export const ReflogPanel: React.FC<Props> = ({ visible, onClose }) => {
  const [entries, setEntries] = useState<ReflogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => { if (visible) loadReflog(); }, [visible]);

  const loadReflog = async () => {
    setLoading(true);
    try { setEntries(await window.electronAPI.git.getReflog()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleReset = async (ref: string) => {
    if (!confirm(`确定重置到 ${ref}?`)) return;
    try { await window.electronAPI.git.resetTo(ref, 'mixed'); loadReflog(); }
    catch (e: any) { alert(e.message); }
  };

  const filtered = filter ? entries.filter(e =>
    e.message.toLowerCase().includes(filter.toLowerCase()) ||
    e.shortOid.includes(filter) ||
    e.action.toLowerCase().includes(filter.toLowerCase())
  ) : entries;

  if (!visible) return null;

  return (
    <div className="reflog-overlay">
      <div className="reflog-dialog">
        <div className="reflog-header">
          <h3>Reflog</h3>
          <input className="reflog-filter" placeholder="搜索..." value={filter} onChange={e => setFilter(e.target.value)} />
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="reflog-list">
          {loading ? <div>加载中...</div> :
           filtered.map((e, i) => (
            <div key={i} className="reflog-item">
              <span className="reflog-sha">{e.shortOid}</span>
              <span className="reflog-msg">{e.action || e.message}</span>
              <span className="reflog-ref">{e.ref}</span>
              <button className="reflog-reset-btn" onClick={() => handleReset(e.oid)}>重置到此</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default ReflogPanel;
