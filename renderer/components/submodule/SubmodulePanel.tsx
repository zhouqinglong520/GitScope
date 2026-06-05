/**
 * 子模块管理面板
 * 查看、添加、初始化、更新、同步、删除子模块
 */
import React, { useState, useEffect } from 'react';
import './SubmodulePanel.css';

interface SubmoduleItem {
  name: string; path: string; url: string; currentOid?: string;
  trackedOid?: string; status: string; branch?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const SubmodulePanel: React.FC<Props> = ({ visible, onClose, onRefresh }) => {
  const [submodules, setSubmodules] = useState<SubmoduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addPath, setAddPath] = useState('');
  const [operating, setOperating] = useState<string | null>(null);

  useEffect(() => {
    if (visible) loadSubmodules();
  }, [visible]);

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
      setShowAddForm(false); setAddUrl(''); setAddPath('');
      loadSubmodules();
      onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setOperating(null); }
  };

  const handleInit = async (path: string) => {
    setOperating(`init-${path}`);
    try {
      await window.electronAPI.git.initSubmodule(path);
      loadSubmodules();
    } catch (e: any) { alert(e.message); }
    finally { setOperating(null); }
  };

  const handleUpdate = async (path: string) => {
    setOperating(`update-${path}`);
    try {
      await window.electronAPI.git.updateSubmodule(path);
      loadSubmodules();
    } catch (e: any) { alert(e.message); }
    finally { setOperating(null); }
  };

  const handleSync = async (path: string) => {
    setOperating(`sync-${path}`);
    try {
      await window.electronAPI.git.syncSubmodule(path);
      loadSubmodules();
    } catch (e: any) { alert(e.message); }
    finally { setOperating(null); }
  };

  const handleRemove = async (path: string) => {
    if (!confirm(`确定删除子模块 ${path}?`)) return;
    setOperating(`remove-${path}`);
    try {
      await window.electronAPI.git.removeSubmodule(path);
      loadSubmodules(); onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setOperating(null); }
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    'unchanged': { color: '#4CAF50', label: '正常' },
    'modified': { color: '#FF9800', label: '已修改' },
    'out-of-date': { color: '#FF5252', label: '过期' },
    'initialized': { color: '#2196F3', label: '已初始化' },
    'uninitialized': { color: '#999', label: '未初始化' },
  };

  if (!visible) return null;

  return (
    <div className="submodule-overlay">
      <div className="submodule-dialog">
        <div className="submodule-header">
          <h3>子模块管理</h3>
          <button className="btn-add" onClick={() => setShowAddForm(!showAddForm)}>+ 添加</button>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {showAddForm && (
          <div className="submodule-add-form">
            <input placeholder="仓库 URL" value={addUrl} onChange={e => setAddUrl(e.target.value)} />
            <input placeholder="本地路径" value={addPath} onChange={e => setAddPath(e.target.value)} />
            <button onClick={handleAdd} disabled={operating === 'add'}>添加子模块</button>
          </div>
        )}

        <div className="submodule-list">
          {loading ? <div className="loading">加载中...</div> :
           submodules.length === 0 ? <div className="empty">暂无子模块</div> :
           submodules.map(sm => {
             const cfg = statusConfig[sm.status] || { color: '#999', label: sm.status };
             return (
               <div key={sm.path} className="submodule-item">
                 <div className="sm-status" style={{ color: cfg.color }}>● {cfg.label}</div>
                 <div className="sm-info">
                   <span className="sm-name">{sm.name}</span>
                   <span className="sm-path">{sm.path}</span>
                   {sm.branch && <span className="sm-branch">↗ {sm.branch}</span>}
                 </div>
                 <div className="sm-actions">
                   <button onClick={() => handleInit(sm.path)} disabled={!!operating}>初始化</button>
                   <button onClick={() => handleUpdate(sm.path)} disabled={!!operating}>更新</button>
                   <button onClick={() => handleSync(sm.path)} disabled={!!operating}>同步</button>
                   <button className="btn-danger" onClick={() => handleRemove(sm.path)} disabled={!!operating}>删除</button>
                 </div>
               </div>
             );
           })}
        </div>
      </div>
    </div>
  );
};

export default SubmodulePanel;
