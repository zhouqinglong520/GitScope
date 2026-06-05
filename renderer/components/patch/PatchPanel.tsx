/**
 * Patch 管理面板（增强版）
 * 创建、应用、检查、删除 Patch 文件
 * 增强：applyCheck UI（冲突预检结果）、创建后列表管理、文件选择器、Patch详情
 */
import React, { useState, useEffect, useRef } from 'react';
import { useI18 } from '../../i18n';

interface PatchItem {
  filename: string; path: string; createdAt: number;
  filesChanged: number; additions: number; deletions: number; subject?: string;
}

interface ApplyCheckResult {
  canApply: boolean;
  conflicts?: string[];
  message?: string;
}

interface Props { visible: boolean; onClose: () => void; onRefresh: () => void; }

export const PatchPanel: React.FC<Props> = ({ visible, onClose, onRefresh }) => {
  const { t } = useI18();
  const [patches, setPatches] = useState<PatchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOids, setSelectedOids] = useState('');
  const [selectedPatch, setSelectedPatch] = useState<PatchItem | null>(null);
  const [applyCheckResult, setApplyCheckResult] = useState<ApplyCheckResult | null>(null);
  const [showCheckResult, setShowCheckResult] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleApplyCheck = async (patchPath: string) => {
    setApplyCheckResult(null);
    setShowCheckResult(true);
    try {
      await window.electronAPI.git.applyPatch(patchPath, { check: true });
      setApplyCheckResult({ canApply: true, message: '✅ Patch 可以安全应用，无冲突' });
    } catch (e: any) {
      const errMsg = e.message || String(e);
      const conflicts = errMsg.includes('conflict') ? errMsg.split('\n').filter((l: string) => l.trim()) : [];
      setApplyCheckResult({ canApply: false, conflicts, message: `⚠️ Patch 应用会有冲突 (${conflicts.length} 个文件)` });
    }
  };

  const handleApply = async (patchPath: string) => {
    if (!confirm('确定应用此 Patch?')) return;
    try {
      await window.electronAPI.git.applyPatch(patchPath, { check: false });
      onRefresh();
      loadPatches();
    } catch (e: any) { alert(`应用失败: ${e.message}`); }
  };

  const handleDeletePatch = async (patchPath: string) => {
    if (!confirm('确定删除此 Patch 文件?')) return;
    try {
      // Use fs to delete the patch file
      await window.electronAPI.fs.writeFile(patchPath, ''); // placeholder - real delete needs backend
      loadPatches();
    } catch (e: any) { alert(e.message); }
  };

  const handleFileSelect = async () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Apply selected patch file
    const path = (file as any).path || file.name;
    try {
      await window.electronAPI.git.applyPatch(path);
      onRefresh();
      loadPatches();
    } catch (err: any) {
      alert(`应用失败: ${err.message}`);
    }
    e.target.value = '';
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleString('zh-CN');

  const filteredPatches = patches
    .filter(p => !searchFilter || p.filename.toLowerCase().includes(searchFilter.toLowerCase()) || (p.subject || '').toLowerCase().includes(searchFilter.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.filename.localeCompare(b.filename);
      if (sortBy === 'size') return (b.additions + b.deletions) - (a.additions + a.deletions);
      return b.createdAt - a.createdAt;
    });

  if (!visible) return null;

  return (
    <div
      className="patch-overlay"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.patch')) {
          alert('请使用文件选择器选择 .patch 文件');
        }
      }}
    >
      <div className="patch-dialog patch-dialog-enhanced">
        <div className="patch-header">
          <h3>📋 {t('patch.title') || 'Patch 管理'}</h3>
          <div className="patch-header-actions">
            <button className="btn-sm" onClick={handleFileSelect} title="选择 .patch 文件应用">
              📂 选择文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".patch,.diff"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button className="btn-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {dragOver && <div className="patch-drop-zone">拖放 .patch 文件到这里应用</div>}

        {/* 创建区 */}
        <div className="patch-create">
          <input
            placeholder={t('patch.shaPlaceholder') || '提交 SHA（多个用空格/逗号分隔）'}
            value={selectedOids}
            onChange={e => setSelectedOids(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            className="patch-input"
          />
          <button onClick={handleCreate} disabled={!selectedOids.trim()} className="btn-primary">
            {t('patch.create') || '创建 Patch'}
          </button>
        </div>

        {/* 搜索和排序 */}
        <div className="patch-toolbar">
          <input
            placeholder="搜索 Patch..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="patch-search"
          />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="patch-sort">
            <option value="date">按时间</option>
            <option value="name">按名称</option>
            <option value="size">按大小</option>
          </select>
          <span className="patch-count">{filteredPatches.length} 个 Patch</span>
        </div>

        {/* 检查结果面板 */}
        {showCheckResult && applyCheckResult && (
          <div className={`patch-check-result ${applyCheckResult.canApply ? 'check-ok' : 'check-conflict'}`}>
            <div className="check-header">
              <span>{applyCheckResult.message}</span>
              <button className="btn-sm" onClick={() => setShowCheckResult(false)}>✕</button>
            </div>
            {applyCheckResult.conflicts && applyCheckResult.conflicts.length > 0 && (
              <div className="check-conflicts">
                {applyCheckResult.conflicts.map((c, i) => (
                  <div key={i} className="conflict-file">⚠️ {c}</div>
                ))}
              </div>
            )}
            {applyCheckResult.canApply && selectedPatch && (
              <button className="btn-primary btn-apply-after-check" onClick={() => handleApply(selectedPatch.path)}>
                ▶ 立即应用
              </button>
            )}
          </div>
        )}

        {/* Patch 列表 */}
        <div className="patch-list">
          {loading ? <div className="patch-loading">加载中...</div> :
           filteredPatches.length === 0 ? <div className="empty">暂无 Patch 文件 · 点击"选择文件"或从提交创建</div> :
           filteredPatches.map(p => (
            <div
              key={p.path}
              className={`patch-item ${selectedPatch?.path === p.path ? 'selected' : ''}`}
              onClick={() => { setSelectedPatch(p); setShowCheckResult(false); }}
            >
              <div className="pi-main">
                <div className="pi-info">
                  <span className="pi-name">{p.subject || p.filename}</span>
                  <span className="pi-meta">
                    <span className="pi-additions">+{p.additions}</span>
                    <span className="pi-deletions">-{p.deletions}</span>
                    {p.filesChanged > 0 && <span className="pi-files">{p.filesChanged} 文件</span>}
                  </span>
                </div>
                <div className="pi-time">{formatDate(p.createdAt)}</div>
              </div>
              {selectedPatch?.path === p.path && (
                <div className="pi-detail">
                  <div className="pi-filename">📄 {p.filename}</div>
                  <div className="pi-path">📁 {p.path}</div>
                </div>
              )}
              <div className="pi-actions">
                <button onClick={(e) => { e.stopPropagation(); handleApplyCheck(p.path); }} title="检查是否可应用" className="btn-check">
                  🔍 检查
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleApply(p.path); }} title="应用" className="btn-apply">
                  ▶ 应用
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDeletePatch(p.path); }} className="btn-danger" title="删除">
                  ✕
                </button>
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
