/**
 * Patch 管理面板
 * 创建、应用、查看 Patch 文件
 */
import React, { useState, useEffect } from 'react';
import './PatchPanel.css';

interface PatchItem { filename: string; path: string; createdAt: number; filesChanged: number; additions: number; deletions: number; subject?: string; }

interface Props { visible: boolean; onClose: () => void; onRefresh: () => void; }

export const PatchPanel: React.FC<Props> = ({ visible, onClose, onRefresh }) => {
  const [patches, setPatches] = useState<PatchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOid, setSelectedOid] = useState('');

  useEffect(() => { if (visible) loadPatches(); }, [visible]);

  const loadPatches = async () => {
    setLoading(true);
    try { setPatches(await window.electronAPI.git.listPatches()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!selectedOid) return;
    try {
      await window.electronAPI.git.createPatch([selectedOid]);
      loadPatches();
    } catch (e: any) { alert(e.message); }
  };

  const handleApply = async (path: string) => {
    if (!confirm('确定应用此 Patch?')) return;
    try { await window.electronAPI.git.applyPatch(path); onRefresh(); }
    catch (e: any) { alert(e.message); }
  };

  if (!visible) return null;

  return (
    <div className="patch-overlay">
      <div className="patch-dialog">
        <div className="patch-header">
          <h3>📋 Patch 管理</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="patch-create">
          <input placeholder="提交 SHA" value={selectedOid} onChange={e => setSelectedOid(e.target.value)} />
          <button onClick={handleCreate}>创建 Patch</button>
        </div>
        <div className="patch-list">
          {loading ? <div>加载中...</div> :
           patches.length === 0 ? <div className="empty">暂无 Patch 文件</div> :
           patches.map(p => (
            <div key={p.path} className="patch-item">
              <div className="pi-info">
                <span className="pi-name">{p.subject || p.filename}</span>
                <span className="pi-meta">{p.additions}+ / {p.deletions}-</span>
              </div>
              <button onClick={() => handleApply(p.path)}>应用</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default PatchPanel;
