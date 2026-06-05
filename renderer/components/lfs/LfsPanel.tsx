/**
 * Git LFS 管理面板
 * 追踪模式管理、文件锁定、对象统计
 */
import React, { useState, useEffect } from 'react';
import './LfsPanel.css';

interface LfsStatus {
  isInstalled: boolean; version?: string;
  trackPatterns: Array<{ pattern: string; lockable: boolean }>;
  locks: Array<{ path: string; owner: string; lockedAt: number; id: string }>;
  stats: { totalSize: number; totalFiles: number; localSize: number; localFiles: number };
}

interface Props { visible: boolean; onClose: () => void; }

export const LfsPanel: React.FC<Props> = ({ visible, onClose }) => {
  const [status, setStatus] = useState<LfsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [newPattern, setNewPattern] = useState('');
  const [tab, setTab] = useState<'tracks' | 'locks' | 'stats'>('tracks');

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
    if (!newPattern) return;
    try { await window.electronAPI.git.lfsTrack(newPattern); setNewPattern(''); loadStatus(); }
    catch (e: any) { alert(e.message); }
  };

  const handleUntrack = async (pattern: string) => {
    try { await window.electronAPI.git.lfsUntrack(pattern); loadStatus(); }
    catch (e: any) { alert(e.message); }
  };

  const handleUnlock = async (path: string) => {
    try { await window.electronAPI.git.lfsUnlock(path, true); loadStatus(); }
    catch (e: any) { alert(e.message); }
  };

  const handlePull = async () => {
    try { await window.electronAPI.git.lfsPull(); }
    catch (e: any) { alert(e.message); }
  };

  const handlePrune = async () => {
    try { await window.electronAPI.git.lfsPrune(); }
    catch (e: any) { alert(e.message); }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  if (!visible) return null;

  return (
    <div className="lfs-overlay">
      <div className="lfs-dialog">
        <div className="lfs-header">
          <h3>Git LFS</h3>
          {status?.version && <span className="lfs-version">{status.version}</span>}
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {!status?.isInstalled ? (
          <div className="lfs-not-installed">
            <p>Git LFS 未安装</p>
            <button onClick={handleInstall}>安装 LFS</button>
          </div>
        ) : (
          <>
            <div className="lfs-tabs">
              <button className={tab === 'tracks' ? 'active' : ''} onClick={() => setTab('tracks')}>追踪模式</button>
              <button className={tab === 'locks' ? 'active' : ''} onClick={() => setTab('locks')}>文件锁定</button>
              <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>统计</button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button className="lfs-action-btn" onClick={handlePull}>LFS Pull</button>
                <button className="lfs-action-btn" onClick={handlePrune}>Prune</button>
              </div>
            </div>

            <div className="lfs-content">
              {tab === 'tracks' && (
                <>
                  <div className="lfs-add-track">
                    <input placeholder="追踪模式 (如 *.psd)" value={newPattern} onChange={e => setNewPattern(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleTrack()} />
                    <button onClick={handleTrack}>添加</button>
                  </div>
                  {status?.trackPatterns.map((tp, i) => (
                    <div key={i} className="lfs-track-item">
                      <span className="track-pattern">{tp.pattern}</span>
                      {tp.lockable && <span className="track-lockable">🔒 可锁定</span>}
                      <button className="track-remove" onClick={() => handleUntrack(tp.pattern)}>✕</button>
                    </div>
                  ))}
                </>
              )}
              {tab === 'locks' && (
                status?.locks.length === 0 ? <div className="empty">暂无锁定文件</div> :
                status.locks.map(lock => (
                  <div key={lock.id || lock.path} className="lfs-lock-item">
                    <span>🔒</span>
                    <span className="lock-path">{lock.path}</span>
                    <span className="lock-owner">{lock.owner}</span>
                    <button onClick={() => handleUnlock(lock.path)}>解锁</button>
                  </div>
                ))
              )}
              {tab === 'stats' && status && (
                <div className="lfs-stats">
                  <div className="stat-item"><span>总大小</span><span>{formatSize(status.stats.totalSize)}</span></div>
                  <div className="stat-item"><span>文件数</span><span>{status.stats.totalFiles}</span></div>
                  <div className="stat-item"><span>本地大小</span><span>{formatSize(status.stats.localSize)}</span></div>
                  <div className="stat-item"><span>本地文件</span><span>{status.stats.localFiles}</span></div>
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
