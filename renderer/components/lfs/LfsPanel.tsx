/**
 * Git LFS 管理面板（增强版）
 * 追踪模式管理、文件锁定、对象统计（明细+存储占比+Prune预览）
 */
import React, { useState, useEffect } from 'react';
import type { LfsTrackPattern, LfsLock, LfsStatus } from '../../../shared/types/git';
import './LfsPanel.css';

// LfsTrackPattern imported from shared
// LfsLock imported from shared
interface LfsStats { totalSize: number; totalFiles: number; localSize: number; localFiles: number; }
// LfsStatus imported from shared

interface Props { visible: boolean; onClose: () => void; }

export const LfsPanel: React.FC<Props> = ({ visible, onClose }) => {
  const [status, setStatus] = useState<LfsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [newPattern, setNewPattern] = useState('');
  const [tab, setTab] = useState<'tracks' | 'locks' | 'stats'>('tracks');
  const [pruneDryRun, setPruneDryRun] = useState<string[] | null>(null);
  const [pruning, setPruning] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [sortBy, setSortBy] = useState<'pattern' | 'size' | 'files'>('pattern');

  useEffect(() => { if (visible) loadStatus(); }, [visible]);

  const loadStatus = async () => {
    setLoading(true);
    try { setStatus(await window.electronAPI.git.getLfsStatus()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleInstall = async () => {
    try { await window.electronAPI.git.installLfs(); loadStatus(); }
    catch (e: any) { alert(e.message); }
  };

  const handleTrack = async () => {
    if (!newPattern.trim()) return;
    try { await window.electronAPI.git.lfsTrack(newPattern.trim()); setNewPattern(''); loadStatus(); }
    catch (e: any) { alert(e.message); }
  };

  const handleUntrack = async (pattern: string) => {
    if (!confirm(`确定取消追踪 ${pattern}?`)) return;
    try { await window.electronAPI.git.lfsUntrack(pattern); loadStatus(); }
    catch (e: any) { alert(e.message); }
  };

  const handleUnlock = async (path: string) => {
    try { await window.electronAPI.git.lfsUnlock(path, true); loadStatus(); }
    catch (e: any) { alert(e.message); }
  };

  const handlePull = async () => {
    setPulling(true);
    try { await window.electronAPI.git.lfsPull(); loadStatus(); }
    catch (e: any) { alert(e.message); }
    finally { setPulling(false); }
  };

  const handlePush = async () => {
    setPushing(true);
    try { await window.electronAPI.git.lfsPush(); }
    catch (e: any) { alert(e.message); }
    finally { setPushing(false); }
  };

  const handlePruneDryRun = async () => {
    try {
      const result = await window.electronAPI.git.lfsPrune();
      setPruneDryRun(Array.isArray(result) ? result : null);
    } catch (e: any) { alert(e.message); }
  };

  const handlePrune = async () => {
    if (!confirm('确定清理未引用的 LFS 对象？此操作不可撤销。')) return;
    setPruning(true);
    try {
      await window.electronAPI.git.lfsPrune();
      setPruneDryRun(null);
      loadStatus();
    } catch (e: any) { alert(e.message); }
    finally { setPruning(false); }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const sortedPatterns = React.useMemo(() => {
    if (!status?.trackPatterns) return [];
    const pats = [...status.trackPatterns];
    switch (sortBy) {
      case 'size': return pats.sort((a, b) => (b.size || 0) - (a.size || 0));
      case 'files': return pats.sort((a, b) => (b.fileCount || 0) - (a.fileCount || 0));
      default: return pats.sort((a, b) => a.pattern.localeCompare(b.pattern));
    }
  }, [status?.trackPatterns, sortBy]);

  const storagePercent = status ? (status.stats.totalSize > 0 ? status.stats.localSize / status.stats.totalSize * 100 : 0) : 0;

  if (!visible) return null;

  return (
    <div className="lfs-overlay">
      <div className="lfs-dialog" style={{ width: 640 }}>
        <div className="lfs-header">
          <h3>📦 Git LFS</h3>
          {status?.version && <span className="lfs-version">v{status.version}</span>}
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {!status?.isInstalled ? (
          <div className="lfs-not-installed">
            <p>Git LFS 未安装</p>
            <button className="lfs-install-btn" onClick={handleInstall}>安装 LFS</button>
          </div>
        ) : (
          <>
            <div className="lfs-tabs">
              <button className={tab === 'tracks' ? 'active' : ''} onClick={() => setTab('tracks')}>追踪模式</button>
              <button className={tab === 'locks' ? 'active' : ''} onClick={() => setTab('locks')}>文件锁定 ({status?.locks.length || 0})</button>
              <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>统计</button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button className="lfs-action-btn" onClick={handlePull} disabled={pulling}>{pulling ? '...' : ''} Pull</button>
                <button className="lfs-action-btn" onClick={handlePush} disabled={pushing}>{pushing ? '...' : ''} Push</button>
                <button className="lfs-action-btn" onClick={handlePruneDryRun}>Prune预览</button>
                <button className="lfs-action-btn lfs-prune-btn-danger" onClick={handlePrune} disabled={pruning}>{pruning ? '...' : ''} Prune</button>
              </div>
            </div>

            <div className="lfs-content">
              {pruneDryRun && (
                <div className="lfs-prune-preview">
                  <div className="lfs-prune-header">
                    <span>可清理 {pruneDryRun.length} 个未引用对象</span>
                    <button onClick={() => setPruneDryRun(null)}>✕</button>
                  </div>
                  <div className="lfs-prune-list">
                    {pruneDryRun.slice(0, 10).map((f, i) => (
                      <div key={i} className="lfs-prune-item">{f}</div>
                    ))}
                    {pruneDryRun.length > 10 && <div className="lfs-prune-more">...还有 {pruneDryRun.length - 10} 项</div>}
                  </div>
                </div>
              )}

              {tab === 'tracks' && (
                <>
                  <div className="lfs-add-track">
                    <input placeholder="追踪模式 (如 *.psd, docs/**)" value={newPattern} onChange={e => setNewPattern(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTrack()} />
                    <button className="lfs-add-btn" onClick={handleTrack}>添加</button>
                  </div>
                  <div className="lfs-sort-bar">
                    <span>排序:</span>
                    <button className={sortBy === 'pattern' ? 'active' : ''} onClick={() => setSortBy('pattern')}>名称</button>
                    <button className={sortBy === 'size' ? 'active' : ''} onClick={() => setSortBy('size')}>大小</button>
                    <button className={sortBy === 'files' ? 'active' : ''} onClick={() => setSortBy('files')}>文件数</button>
                  </div>
                  {sortedPatterns.length === 0 ? (
                    <div className="empty">暂无追踪模式</div>
                  ) : sortedPatterns.map((tp, i) => (
                    <div key={i} className="lfs-track-item">
                      <span className="track-pattern">{tp.pattern}</span>
                      {tp.lockable && <span className="track-lockable">可锁定</span>}
                      {tp.size !== undefined && <span className="track-size">{formatSize(tp.size)}</span>}
                      {tp.fileCount !== undefined && <span className="track-files">{tp.fileCount} 文件</span>}
                      <button className="track-remove" onClick={() => handleUntrack(tp.pattern)}>✕</button>
                    </div>
                  ))}
                </>
              )}
              {tab === 'locks' && (
                status?.locks.length === 0 ? <div className="empty">暂无锁定文件</div> :
                status.locks.map(lock => (
                  <div key={lock.id || lock.path} className="lfs-lock-item">
                    <span className="lock-icon">🔒</span>
                    <span className="lock-path">{lock.path}</span>
                    <span className="lock-owner">{lock.owner}</span>
                    <span className="lock-time">{formatDate(lock.lockedAt)}</span>
                    <button className="lock-unlock-btn" onClick={() => handleUnlock(lock.path)}>解锁</button>
                  </div>
                ))
              )}
              {tab === 'stats' && status && (
                <div className="lfs-stats-content">
                  <div className="lfs-stats-grid">
                    <div className="stat-card"><div className="stat-label">总对象大小</div><div className="stat-value">{formatSize(status.stats.totalSize)}</div></div>
                    <div className="stat-card"><div className="stat-label">总文件数</div><div className="stat-value">{status.stats.totalFiles}</div></div>
                    <div className="stat-card"><div className="stat-label">本地大小</div><div className="stat-value">{formatSize(status.stats.localSize)}</div></div>
                    <div className="stat-card"><div className="stat-label">本地文件</div><div className="stat-value">{status.stats.localFiles}</div></div>
                  </div>
                  <div className="lfs-storage-bar">
                    <div className="lfs-storage-label"><span>本地存储占比</span><span>{storagePercent.toFixed(1)}%</span></div>
                    <div className="lfs-storage-track"><div className="lfs-storage-fill" style={{ width: `${Math.min(storagePercent, 100)}%` }} /></div>
                    <div className="lfs-storage-detail">{formatSize(status.stats.localSize)} / {formatSize(status.stats.totalSize)}</div>
                  </div>
                  {sortedPatterns.filter(p => p.size).length > 0 && (
                    <div className="lfs-distribution">
                      <h4>存储分布</h4>
                      {sortedPatterns.filter(p => p.size).map((tp, i) => {
                        const pct = status.stats.totalSize > 0 ? (tp.size! / status.stats.totalSize * 100) : 0;
                        return (
                          <div key={i} className="lfs-dist-item">
                            <span className="dist-pattern">{tp.pattern}</span>
                            <div className="dist-bar-track"><div className="dist-bar-fill" style={{ width: `${pct}%` }} /></div>
                            <span className="dist-size">{formatSize(tp.size!)} ({pct.toFixed(1)}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
export default LfsPanel;
