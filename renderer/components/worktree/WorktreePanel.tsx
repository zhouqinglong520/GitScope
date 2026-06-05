/**
 * Worktree 管理面板
 * 查看、创建、删除 Git Worktree
 */
import React, { useState, useEffect } from 'react';
import './WorktreePanel.css';

interface WorktreeItem {
  path: string; head: string; isMainWorktree: boolean;
  branch?: string; isClean: boolean;
}

interface Props { visible: boolean; onClose: () => void; }

export const WorktreePanel: React.FC<Props> = ({ visible, onClose }) => {
  const [worktrees, setWorktrees] = useState<WorktreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [newRef, setNewRef] = useState('');

  useEffect(() => { if (visible) loadWorktrees(); }, [visible]);

  const loadWorktrees = async () => {
    setLoading(true);
    try { setWorktrees(await window.electronAPI.git.listWorktrees()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!newPath || !newRef) return;
    try {
      await window.electronAPI.git.createWorktree(newPath, newRef);
      setShowCreate(false); setNewPath(''); setNewRef('');
      loadWorktrees();
    } catch (e: any) { alert(e.message); }
  };

  const handleRemove = async (path: string) => {
    if (!confirm(`确定删除 Worktree ${path}?`)) return;
    try { await window.electronAPI.git.removeWorktree(path, true); loadWorktrees(); }
    catch (e: any) { alert(e.message); }
  };

  if (!visible) return null;

  return (
    <div className="worktree-overlay">
      <div className="worktree-dialog">
        <div className="wt-header">
          <h3>Worktree 管理</h3>
          <button className="btn-add" onClick={() => setShowCreate(!showCreate)}>+ 创建</button>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        {showCreate && (
          <div className="wt-create-form">
            <input placeholder="路径" value={newPath} onChange={e => setNewPath(e.target.value)} />
            <input placeholder="分支/提交" value={newRef} onChange={e => setNewRef(e.target.value)} />
            <button onClick={handleCreate}>创建</button>
          </div>
        )}
        <div className="wt-list">
          {loading ? <div>加载中...</div> :
           worktrees.map(wt => (
            <div key={wt.path} className={`wt-item ${wt.isMainWorktree ? 'main' : ''}`}>
              <div className="wt-badge">{wt.isMainWorktree ? '主' : '副'}</div>
              <div className="wt-info">
                <span className="wt-path">{wt.path}</span>
                <span className="wt-branch">{wt.branch || 'detached'}</span>
              </div>
              {!wt.isMainWorktree && (
                <button className="btn-danger-sm" onClick={() => handleRemove(wt.path)}>删除</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default WorktreePanel;
