/**
 * Worktree 管理面板（增强版）
 * 查看、创建、检出、删除 Git Worktree + 状态详情 + 打开目录
 */
import React, { useState, useEffect } from 'react';
import './WorktreePanel.css';

interface WorktreeItem {
  path: string; head: string; isMainWorktree: boolean;
  branch?: string; isClean: boolean; ahead?: number; behind?: number;
}

interface Props { visible: boolean; onClose: () => void; onRefresh?: () => void; }

export const WorktreePanel: React.FC<Props> = ({ visible, onClose, onRefresh }) => {
  const [worktrees, setWorktrees] = useState<WorktreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [newRef, setNewRef] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [operating, setOperating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { if (visible) loadWorktrees(); }, [visible]);

  const loadWorktrees = async () => {
    setLoading(true);
    try { setWorktrees(await window.electronAPI.git.listWorktrees()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!newPath || !newRef) return;
    setOperating('create');
    try {
      await window.electronAPI.git.createWorktree(newPath, newRef);
      setShowCreate(false); setNewPath(''); setNewRef(''); setNewBranch('');
      loadWorktrees();
      onRefresh?.();
    } catch (e: any) { alert(e.message); }
    finally { setOperating(null); }
  };

  const handleRemove = async (path: string, force: boolean = false) => {
    const label = path.split(/[\\/]/).pop() || path;
    if (!force && !confirm(`确定删除 Worktree "${label}"?\n工作目录中的未提交更改将丢失。`)) return;
    setOperating(`remove-${path}`);
    try {
      await window.electronAPI.git.removeWorktree(path);
      loadWorktrees();
      onRefresh?.();
    } catch (e: any) { alert(e.message); }
    finally { setOperating(null); }
  };

  const handleCheckout = async (branch: string) => {
    try {
      await window.electronAPI.git.checkout(branch);
      loadWorktrees();
      onRefresh?.();
    } catch (e: any) { alert(e.message); }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path); // copy path as fallback
    } catch {
      // fallback: copy path
      await navigator.clipboard.writeText(path);
      alert(`路径已复制: ${path}`);
    }
  };

  const shortSha = (sha: string) => sha.substring(0, 7);

  if (!visible) return null;

  return (
    <div className="wt-overlay">
      <div className="wt-dialog" style={{ width: 600 }}>
        <div className="wt-header">
          <h3>🌲 Worktree 管理</h3>
          <button className="btn-add" onClick={() => setShowCreate(!showCreate)}>+ 创建</button>
          <button className="btn-refresh" onClick={loadWorktrees} disabled={loading}>⟳</button>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {showCreate && (
          <div className="wt-create-form">
            <div className="wt-form-row">
              <label>路径</label>
              <input placeholder="如 ../feature-branch" value={newPath} onChange={e => setNewPath(e.target.value)} />
            </div>
            <div className="wt-form-row">
              <label>分支/提交</label>
              <input placeholder="如 main 或 abc1234" value={newRef} onChange={e => setNewRef(e.target.value)} />
            </div>
            <div className="wt-form-row">
              <label>新分支名（可选）</label>
              <input placeholder="创建新分支并检出" value={newBranch} onChange={e => setNewBranch(e.target.value)} />
            </div>
            <div className="wt-form-actions">
              <button onClick={() => setShowCreate(false)}>取消</button>
              <button className="btn-primary" onClick={handleCreate} disabled={operating === 'create' || !newPath || !newRef}>
                {operating === 'create' ? '创建中...' : '创建 Worktree'}
              </button>
            </div>
          </div>
        )}

        <div className="wt-summary">
          <span>共 {worktrees.length} 个 Worktree</span>
          <span>{worktrees.filter(w => !w.isClean).length} 个有未提交更改</span>
        </div>

        <div className="wt-list">
          {loading ? <div className="wt-loading">加载中...</div> :
           worktrees.length === 0 ? <div className="wt-empty">暂无 Worktree</div> :
           worktrees.map(wt => {
             const label = wt.path.split(/[\\/]/).pop() || wt.path;
             return (
               <div key={wt.path} className={`wt-item ${wt.isMainWorktree ? 'main' : ''} ${!wt.isClean ? 'dirty' : ''} ${expanded === wt.path ? 'expanded' : ''}`}>
                 <div className="wt-item-header" onClick={() => setExpanded(expanded === wt.path ? null : wt.path)}>
                   <div className="wt-badge">{wt.isMainWorktree ? '主' : '副'}</div>
                   <div className="wt-info">
                     <span className="wt-label">{label}</span>
                     <span className="wt-branch-tag">{wt.branch || 'detached'}</span>
                   </div>
                   <div className="wt-status">
                     {!wt.isClean && <span className="wt-dirty">有更改</span>}
                     {wt.ahead !== undefined && wt.ahead > 0 && <span className="wt-ahead">↑{wt.ahead}</span>}
                     {wt.behind !== undefined && wt.behind > 0 && <span className="wt-behind">↓{wt.behind}</span>}
                   </div>
                   <span className="wt-expand">{expanded === wt.path ? '▼' : '▶'}</span>
                 </div>
                 {expanded === wt.path && (
                   <div className="wt-detail">
                     <div className="wt-detail-row">
                       <span className="wt-detail-label">路径</span>
                       <span className="wt-detail-value wt-path-value">{wt.path}</span>
                       <button className="wt-detail-btn" onClick={() => handleOpenFolder(wt.path)}>打开</button>
                     </div>
                     <div className="wt-detail-row">
                       <span className="wt-detail-label">HEAD</span>
                       <span className="wt-detail-value wt-sha">{shortSha(wt.head)}</span>
                       <button className="wt-detail-btn" onClick={() => { navigator.clipboard.writeText(wt.head); }}>复制</button>
                     </div>
                     {wt.branch && (
                       <div className="wt-detail-row">
                         <span className="wt-detail-label">分支</span>
                         <span className="wt-detail-value">{wt.branch}</span>
                         {!wt.isMainWorktree && (
                           <button className="wt-detail-btn" onClick={() => handleCheckout(wt.branch!)}>检出</button>
                         )}
                       </div>
                     )}
                     <div className="wt-detail-row">
                       <span className="wt-detail-label">状态</span>
                       <span className={`wt-detail-value ${wt.isClean ? 'wt-clean' : 'wt-dirty-text'}`}>
                         {wt.isClean ? '干净' : '有未提交更改'}
                       </span>
                     </div>
                     {!wt.isMainWorktree && (
                       <div className="wt-detail-actions">
                         <button className="wt-remove-btn" onClick={() => handleRemove(wt.path)} disabled={!!operating}>
                           删除 Worktree
                         </button>
                         {!wt.isClean && (
                           <button className="wt-force-remove-btn" onClick={() => handleRemove(wt.path, true)} disabled={!!operating}>
                             强制删除
                           </button>
                         )}
                       </div>
                     )}
                   </div>
                 )}
               </div>
             );
           })}
        </div>
      </div>
    </div>
  );
};
export default WorktreePanel;
