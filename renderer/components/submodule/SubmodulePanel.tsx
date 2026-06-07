/**
 * 子模块管理面板（增强版）
 * 查看、添加、Diff查看、批量更新、同步、删除子模块
 */
import React, { useState, useEffect } from 'react';
import './SubmodulePanel.css';

interface SubmoduleItem {
  name: string; path: string; url: string; currentOid?: string;
  trackedOid?: string; status: string; branch?: string;
  commitCount?: number; ahead?: number; behind?: number;
}

interface Props { visible: boolean; onClose: () => void; onRefresh: () => void; }

export const SubmodulePanel: React.FC<Props> = ({ visible, onClose, onRefresh }) => {
  const [submodules, setSubmodules] = useState<SubmoduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addPath, setAddPath] = useState('');
  const [addBranch, setAddBranch] = useState('');
  const [operating, setOperating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [diffPath, setDiffPath] = useState<string | null>(null);

  useEffect(() => { if (visible) loadSubmodules(); }, [visible]);

  const loadSubmodules = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.git.listSubmodulesEnhanced();
      setSubmodules(result);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!addUrl || !addPath) return;
    setOperating('add');
    try {
      await window.electronAPI.git.addSubmodule(addUrl, addPath);
      setShowAddForm(false); setAddUrl(''); setAddPath(''); setAddBranch('');
      loadSubmodules(); onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setOperating(null); }
  };

  const handleInit = async (path: string) => {
    setOperating(`init-${path}`);
    try { await window.electronAPI.git.initSubmodule(path); loadSubmodules(); }
    catch (e: any) { alert(e.message); }
    finally { setOperating(null); }
  };

  const handleUpdate = async (path: string) => {
    setOperating(`update-${path}`);
    try { await window.electronAPI.git.updateSubmodule(path); loadSubmodules(); }
    catch (e: any) { alert(e.message); }
    finally { setOperating(null); }
  };

  const handleSync = async (path: string) => {
    setOperating(`sync-${path}`);
    try { await window.electronAPI.git.syncSubmodule(path); loadSubmodules(); }
    catch (e: any) { alert(e.message); }
    finally { setOperating(null); }
  };

  const handleRemove = async (path: string) => {
    if (!confirm(`确定删除子模块 ${path}?`)) return;
    setOperating(`remove-${path}`);
    try { await window.electronAPI.git.removeSubmodule(path); loadSubmodules(); onRefresh(); }
    catch (e: any) { alert(e.message); }
    finally { setOperating(null); }
  };

  // 批量更新
  const handleBatchUpdate = async () => {
    if (selectedForBatch.size === 0) return;
    setOperating('batch');
    try {
      for (const path of selectedForBatch) {
        await window.electronAPI.git.updateSubmodule(path);
      }
      setSelectedForBatch(new Set());
      loadSubmodules();
    } catch (e: any) { alert(e.message); }
    finally { setOperating(null); }
  };

  // 查看子模块 Diff
  const handleViewDiff = (path: string) => {
    setDiffPath(diffPath === path ? null : path);
  };

  const toggleSelect = (path: string) => {
    const next = new Set(selectedForBatch);
    if (next.has(path)) next.delete(path); else next.add(path);
    setSelectedForBatch(next);
  };

  const selectAll = () => {
    const filtered = getFiltered();
    if (selectedForBatch.size === filtered.length) {
      setSelectedForBatch(new Set());
    } else {
      setSelectedForBatch(new Set(filtered.map(s => s.path)));
    }
  };

  const getFiltered = () => {
    if (filterStatus === 'all') return submodules;
    return submodules.filter(s => s.status === filterStatus);
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    'unchanged': { color: '#4CAF50', label: '正常' },
    'modified': { color: '#FF9800', label: '已修改' },
    'out-of-date': { color: '#FF5252', label: '过期' },
    'initialized': { color: '#2196F3', label: '已初始化' },
    'uninitialized': { color: '#999', label: '未初始化' },
  };

  const shortSha = (sha?: string) => sha ? sha.substring(0, 7) : '-';

  if (!visible) return null;

  const filtered = getFiltered();

  return (
    <div className="submodule-overlay">
      <div className="sm-dialog" style={{ width: 640 }}>
        <div className="submodule-header">
          <h3>子模块管理</h3>
          <button className="btn-add" onClick={() => setShowAddForm(!showAddForm)}>+ 添加</button>
          {selectedForBatch.size > 0 && (
            <button className="btn-batch" onClick={handleBatchUpdate} disabled={operating === 'batch'}>
              {operating === 'batch' ? '更新中...' : `批量更新 (${selectedForBatch.size})`}
            </button>
          )}
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {showAddForm && (
          <div className="submodule-add-form">
            <div className="sm-form-row">
              <label>仓库 URL</label>
              <input placeholder="https://github.com/..." value={addUrl} onChange={e => setAddUrl(e.target.value)} />
            </div>
            <div className="sm-form-row">
              <label>本地路径</label>
              <input placeholder="libs/my-lib" value={addPath} onChange={e => setAddPath(e.target.value)} />
            </div>
            <div className="sm-form-row">
              <label>分支（可选）</label>
              <input placeholder="main" value={addBranch} onChange={e => setAddBranch(e.target.value)} />
            </div>
            <div className="sm-form-actions">
              <button onClick={() => setShowAddForm(false)}>取消</button>
              <button className="btn-primary" onClick={handleAdd} disabled={operating === 'add' || !addUrl || !addPath}>
                添加子模块
              </button>
            </div>
          </div>
        )}

        {/* 过滤栏 */}
        <div className="sm-filter-bar">
          <button className={filterStatus === 'all' ? 'active' : ''} onClick={() => setFilterStatus('all')}>全部 ({submodules.length})</button>
          <button className={filterStatus === 'modified' ? 'active' : ''} onClick={() => setFilterStatus('modified')}>已修改</button>
          <button className={filterStatus === 'out-of-date' ? 'active' : ''} onClick={() => setFilterStatus('out-of-date')}>过期</button>
          <button className={filterStatus === 'uninitialized' ? 'active' : ''} onClick={() => setFilterStatus('uninitialized')}>未初始化</button>
          <button className="sm-select-all" onClick={selectAll}>
            {selectedForBatch.size === filtered.length && filtered.length > 0 ? '取消全选' : '全选'}
          </button>
        </div>

        <div className="submodule-list">
          {loading ? <div className="loading">加载中...</div> :
           filtered.length === 0 ? <div className="empty">暂无子模块</div> :
           filtered.map(sm => {
             const cfg = statusConfig[sm.status] || { color: '#999', label: sm.status };
             const isSelected = selectedForBatch.has(sm.path);
             return (
               <div key={sm.path} className={`sm-item ${expanded === sm.path ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`}>
                 <div className="sm-item-header" onClick={() => setExpanded(expanded === sm.path ? null : sm.path)}>
                   <input type="checkbox" checked={isSelected} onClick={e => { e.stopPropagation(); toggleSelect(sm.path); }} readOnly />
                   <div className="sm-status-dot" style={{ color: cfg.color }}>●</div>
                   <div className="sm-info">
                     <span className="sm-name">{sm.name}</span>
                     <span className="sm-path-text">{sm.path}</span>
                   </div>
                   <span className="sm-status-tag" style={{ color: cfg.color }}>{cfg.label}</span>
                   {sm.ahead !== undefined && sm.ahead > 0 && <span className="sm-ahead">↑{sm.ahead}</span>}
                   {sm.behind !== undefined && sm.behind > 0 && <span className="sm-behind">↓{sm.behind}</span>}
                   <span className="sm-expand-icon">{expanded === sm.path ? '▼' : '▶'}</span>
                 </div>
                 {expanded === sm.path && (
                   <div className="sm-detail">
                     <div className="sm-detail-row">
                       <span className="sm-detail-label">URL</span>
                       <span className="sm-detail-value sm-url">{sm.url}</span>
                     </div>
                     <div className="sm-detail-row">
                       <span className="sm-detail-label">当前</span>
                       <span className="sm-detail-value sm-sha">{shortSha(sm.currentOid)}</span>
                     </div>
                     <div className="sm-detail-row">
                       <span className="sm-detail-label">追踪</span>
                       <span className="sm-detail-value sm-sha">{shortSha(sm.trackedOid)}</span>
                     </div>
                     {sm.branch && (
                       <div className="sm-detail-row">
                         <span className="sm-detail-label">分支</span>
                         <span className="sm-detail-value">{sm.branch}</span>
                       </div>
                     )}
                     {/* Diff 信息 */}
                     {diffPath === sm.path && (
                       <div className="sm-diff-info">
                         {sm.currentOid !== sm.trackedOid ? (
                           <div className="sm-diff-changed">
                             <span>当前: {shortSha(sm.currentOid)}</span>
                             <span>→</span>
                             <span>追踪: {shortSha(sm.trackedOid)}</span>
                           </div>
                         ) : (
                           <div className="sm-diff-same">子模块与追踪一致</div>
                         )}
                       </div>
                     )}
                     <div className="sm-detail-actions">
                       <button onClick={() => handleViewDiff(sm.path)}>Diff</button>
                       <button onClick={() => handleInit(sm.path)} disabled={!!operating}>初始化</button>
                       <button onClick={() => handleUpdate(sm.path)} disabled={!!operating}>更新</button>
                       <button onClick={() => handleSync(sm.path)} disabled={!!operating}>同步</button>
                       <button className="btn-danger" onClick={() => handleRemove(sm.path)} disabled={!!operating}>删除</button>
                     </div>
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
export default SubmodulePanel;
