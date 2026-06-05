/**
 * Git Bisect 二分查找面板
 * 快速定位引入 Bug 的提交
 */
import React, { useState, useEffect } from 'react';
import './BisectPanel.css';

interface BisectState {
  isActive: boolean; goodRef?: string; badRef?: string;
  currentRef?: string; stepsRemaining?: number;
  markedCommits: Array<{ ref: string; result: string }>;
}

interface Props { visible: boolean; onClose: () => void; onRefresh: () => void; }

export const BisectPanel: React.FC<Props> = ({ visible, onClose, onRefresh }) => {
  const [state, setState] = useState<BisectState>({ isActive: false, markedCommits: [] });
  const [badRef, setBadRef] = useState('HEAD');
  const [goodRef, setGoodRef] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (visible) loadState(); }, [visible]);

  const loadState = async () => {
    try { const s = await window.electronAPI.git.getBisectState(); if (s) setState(s); }
    catch (e) { console.error(e); }
  };

  const handleStart = async () => {
    if (!badRef || !goodRef) return;
    setLoading(true);
    try {
      await window.electronAPI.git.bisectStart(badRef, goodRef);
      loadState();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleMark = async (result: 'good' | 'bad') => {
    setLoading(true);
    try {
      const newState = await window.electronAPI.git.bisectMark(state.currentRef || '', result) as BisectState | null;
      if (newState) setState(newState);
      onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      const newState = await window.electronAPI.git.bisectSkip() as BisectState | null;
      if (newState) setState(newState);
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleReset = async () => {
    try { await window.electronAPI.git.bisectReset(); loadState(); onRefresh(); }
    catch (e: any) { alert(e.message); }
  };

  if (!visible) return null;

  return (
    <div className="bisect-overlay">
      <div className="bisect-dialog">
        <div className="bisect-header">
          <h3>🔍 Bisect 二分查找</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="bisect-content">
          {!state.isActive ? (
            <div className="bisect-start">
              <p>输入好的和坏的提交来开始 Bisect</p>
              <input placeholder="坏提交（Bug 存在）" value={badRef} onChange={e => setBadRef(e.target.value)} />
              <input placeholder="好提交（Bug 不存在）" value={goodRef} onChange={e => setGoodRef(e.target.value)} />
              <button className="btn-primary" onClick={handleStart} disabled={loading || !goodRef}>开始 Bisect</button>
            </div>
          ) : (
            <>
              <div className="bisect-status">
                <span>当前测试: <strong>{state.currentRef?.substring(0, 7)}</strong></span>
                {state.stepsRemaining !== undefined && <span>剩余步骤: {state.stepsRemaining}</span>}
              </div>
              <div className="bisect-mark">
                <button className="btn-good" onClick={() => handleMark('good')} disabled={loading}>✅ Good</button>
                <button className="btn-bad" onClick={() => handleMark('bad')} disabled={loading}>❌ Bad</button>
                <button className="btn-skip" onClick={handleSkip} disabled={loading}>⏭ Skip</button>
              </div>
              <div className="bisect-history">
                {state.markedCommits.map((c, i) => (
                  <div key={i} className={`bisect-entry ${c.result}`}>
                    <span>{c.result === 'good' ? '✅' : '❌'} {c.ref.substring(0, 7)}</span>
                  </div>
                ))}
              </div>
              <button className="btn-reset" onClick={handleReset}>重置 Bisect</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
export default BisectPanel;
