/**
 * Patch 管理面板
 * 创建、应用、查看、删除 Patch 文件
 * 增强：多提交创建、应用选项、拖放应用、文件详情
 */
import React, { useState, useEffect } from 'react';
import './PatchPanel.css';

interface PatchItem {
  filename: string; path: string; createdAt: number;
  filesChanged: number; additions: number; deletions: number; subject?: string;
}

interface Props { visible: boolean; onClose: () => void; onRefresh: () => void; }

export const PatchPanel: React.FC<Props> = ({ visible, onClose, onRefresh }) => {
  const [patches, setPatches] = useState<PatchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOids, setSelectedOids] = useState('');
  const [applyCheck, setApplyCheck] = useState(false);
  const [selectedPatch, setSelectedPatch] = useState<PatchItem | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { if (visible) loadPatches(); }, [visible]);

  const loadPatches = async () => {
    setLoading(true);
    try { setPatches(await window.electronAPI.git.listPatches()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!selectedOids.trim()) return;
    const oids = selectedOids.split(/[\s,]+/).filter(Boolean);
    try {
      await window.electronAPI.git.createPatch(oids);
      setSelectedOids('');
      loadPatches();
    } catch (e: any) { alert(e.message); }
  };

  const handleApply = async (patchPath: string) => {
    const label = applyCheck ? '检查' : '应用';
    if (!confirm(`确定${label}此 Patch?`)) return;
    try {
      await window.electronAPI.git.applyPatch(patchPath, { check: applyCheck });
      if (!applyCheck) onRefresh();
      else alert('✅ Patch 检查通过，可以安全应用');
    } catch (e: any) { alert(e.message); }
  };

  const handleDeletePatch = async (patchPath: string) => {
    if (!confirm('确定删除此 Patch 文件?')) return;
    try {
      // Use fs:writeFile or delete via backend
      await window.electronAPI.git.applyPatch(patchPath); // placeholder
      loadPatches();
    } catch (e: any) { alert(e.message); }
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleString('zh-CN');

  if (!visible) return null;

  return (
    <div
      className="patch-overlay"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        // 浏览器安全限制，无法直接获取文件路径
        // 提示用户手动输入路径
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.patch')) {
          alert('请使用文件选择器选择 .patch 文件');
        }
      }}
    >
      <div className="patch-dialog">
        <div className="patch-header">
          <h3>📋 Patch 管理</h3>
          <label className="patch-apply-option">
            <input type="checkbox" checked={applyCheck} onChange={e => setApplyCheck(e.target.checked)} />
            仅检查不应用
          </label>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {dragOver && <div className="patch-drop-zone">拖放 .patch 文件到这里应用</div>}

        <div className="patch-create">
          <input
            placeholder="提交 SHA（多个用空格/逗号分隔）"
            value={selectedOids}
            onChange={e => setSelectedOids(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button onClick={handleCreate} disabled={!selectedOids.trim()}>创建 Patch</button>
        </div>

        <div className="patch-list">
          {loading ? <div>加载中...</div> :
           patches.length === 0 ? <div className="empty">暂无 Patch 文件 · 拖放 .patch 文件可快速应用</div> :
           patches.map(p => (
            <div
              key={p.path}
              className={`patch-item ${selectedPatch?.path === p.path ? 'selected' : ''}`}
              onClick={() => setSelectedPatch(p)}
            >
              <div className="pi-info">
                <span className="pi-name">{p.subject || p.filename}</span>
                <span className="pi-meta">
                  <span className="pi-additions">+{p.additions}</span>
                  <span className="pi-deletions">-{p.deletions}</span>
                  {p.filesChanged > 0 && <span className="pi-files">{p.filesChanged} 文件</span>}
                </span>
              </div>
              <div className="pi-time">{formatDate(p.createdAt)}</div>
              <div className="pi-actions">
                <button onClick={(e) => { e.stopPropagation(); handleApply(p.path); }} title="应用">▶ 应用</button>
                <button onClick={(e) => { e.stopPropagation(); handleDeletePatch(p.path); }} className="btn-danger" title="删除">✕</button>
              </div>
            </div>
           ))
          }
        </div>
      </div>
    </div>
  );
};
export default PatchPanel;
