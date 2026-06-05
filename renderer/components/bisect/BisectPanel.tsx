/**
 * Git Bisect 二分查找面板（增强版）
 * 快速定位引入 Bug 的提交 + 自动检出 + 进度条 + 结果高亮
 */
import React, { useState, useEffect } from 'react';
import './BisectPanel.css';

interface MarkedCommit { ref: string; result: string; }
interface BisectState {
  isActive: boolean; goodRef?: string; badRef?: string;
  currentRef?: string; stepsRemaining?: number; totalSteps?: number;
  markedCommits: MarkedCommit[];
  foundRef?: string; foundMessage?: string;
}

interface Props { visible: boolean; onClose: () => void; onRefresh: () => void; }

export const BisectPanel: React.FC<Props> = ({ visible, onClose, onRefresh }) => {
  const [state, setState] = useState<BisectState>({ isActive: false, markedCommits: [] });
  const [badRef, setBadRef] = useState('HEAD');
  const [goodRef, setGoodRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoCheckout, setAutoCheckout] = useState(true);

  useEffect(() => { if (visible) loadState(); }, [visible]);

  const loadState = async () => {
    try {
      const s = await window.electronAPI.git.getBisectState();
      if (s) setState(s);
    } catch (e) { console.error(e); }
  };

  const handleStart = async () => {
    if (!badRef || !goodRef) return;
    setLoading(true);
    try {
      await window.electronAPI.git.bisectStart(badRef, goodRef);
      await loadState();
      if (autoCheckout && state.currentRef) {
        await window.electronAPI.git.checkout(state.currentRef);
      }
      onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleMark = async (result: 'good' | 'bad') => {
    setLoading(true);
    try {
      const newState = await window.electronAPI.git.bisectMark(state.currentRef || '', result) as BisectState | null;
      if (newState) setState(newState);
      // 自动检出当前测试的提交
      if (autoCheckout && newState?.currentRef) {
        await window.electronAPI.git.checkout(newState.currentRef);
      }
      // 如果找到了引入 bug 的提交
      if (newState?.foundRef) {
        onRefresh();
      }
      onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      const newState = await window.electronAPI.git.bisectSkip() as BisectState | null;
      if (newState) setState(newState);
      if (autoCheckout && newState?.currentRef) {
        await window.electronAPI.git.checkout(newState.currentRef);
      }
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleReset = async () => {
    try {
      await window.electronAPI.git.bisectReset();
      setState({ isActive: false, markedCommits: [] });
      onRefresh();
    } catch (e: any) { alert(e.message); }
  };

  // 计算进度
  const progressPercent = state.totalSteps && state.stepsRemaining !== undefined
    ? ((state.totalSteps - state.stepsRemaining) / state.totalSteps * 100)
    : 0;

  const shortSha = (sha: string) => sha.substring(0, 7);

  if (!visible) return null;

  return (
    <div className="bisect-overlay">
      <div className="bisect-dialog" style={{ width: 500 }}>
        <div className="bisect-header">
          <h3>Bisect 二分查找</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="bisect-content">
          {/* 找到结果 */}
          {state.foundRef && (
            <div className="bisect-found">
              <div className="bisect-found-icon">🎯</div>
              <div className="bisect-found-info">
                <div className="bisect-found-title">找到引入 Bug 的提交!</div>
                <div className="bisect-found-sha">{shortSha(state.foundRef)}</div>
                {state.foundMessage && <div className="bisect-found-msg">{state.foundMessage}</div>}
              </div>
              <button className="bisect-copy-btn" onClick={() => navigator.clipboard.writeText(state.foundRef!)}>复制 SHA</button>
            </div>
          )}

          {!state.isActive ? (
            <div className="bisect-start">
              <p className="bisect-desc">使用二分查找快速定位引入问题的提交。需要指定一个"好"提交（Bug 不存在）和一个"坏"提交（Bug 存在）。</p>
              <div className="bisect-input-group">
                <label>坏提交（Bug 存在）</label>
                <input placeholder="如 HEAD 或 abc1234" value={badRef} onChange={e => setBadRef(e.target.value)} />
              </div>
              <div className="bisect-input-group">
                <label>好提交（Bug 不存在）</label>
                <input placeholder="如 v1.0 或 def5678" value={goodRef} onChange={e => setGoodRef(e.target.value)} />
              </div>
              <label className="bisect-checkbox">
                <input type="checkbox" checked={autoCheckout} onChange={e => setAutoCheckout(e.target.checked)} />
                自动检出当前测试提交
              </label>
              <button className="btn-primary" onClick={handleStart} disabled={loading || !goodRef || !badRef}>
                {loading ? '启动中...' : '开始 Bisect'}
              </button>
            </div>
          ) : (
            <>
              {/* 进度条 */}
              {state.totalSteps !== undefined && (
                <div className="bisect-progress">
                  <div className="bisect-progress-label">
                    <span>进度</span>
                    <span>{state.totalSteps - (state.stepsRemaining || 0)}/{state.totalSteps} 步</span>
                  </div>
                  <div className="bisect-progress-track">
                    <div className="bisect-progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              )}

              {/* 当前测试提交 */}
              <div className="bisect-current">
                <span className="bisect-current-label">当前测试</span>
                <span className="bisect-current-sha">{shortSha(state.currentRef || '')}</span>
                {state.stepsRemaining !== undefined && (
                  <span className="bisect-remaining">剩余 ~{state.stepsRemaining} 步</span>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="bisect-mark">
                <button className="btn-good" onClick={() => handleMark('good')} disabled={loading}>
                  ✓ Good
                </button>
                <button className="btn-bad" onClick={() => handleMark('bad')} disabled={loading}>
                  ✗ Bad
                </button>
                <button className="btn-skip" onClick={handleSkip} disabled={loading}>
                  ⏭ Skip
                </button>
              </div>

              {/* 键盘快捷键提示 */}
              <div className="bisect-shortcuts">
                <span>G = Good</span>
                <span>B = Bad</span>
                <span>S = Skip</span>
                <span>R = Reset</span>
              </div>

              {/* 历史记录 */}
              {state.markedCommits.length > 0 && (
                <div className="bisect-history">
                  <div className="bisect-history-header">已标记 ({state.markedCommits.length})</div>
                  {state.markedCommits.map((c, i) => (
                    <div key={i} className={`bisect-entry ${c.result}`}>
                      <span className="bisect-entry-icon">{c.result === 'good' ? '✓' : c.result === 'bad' ? '✗' : '⏭'}</span>
                      <span className="bisect-entry-sha">{shortSha(c.ref)}</span>
                      <span className="bisect-entry-result">{c.result}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="bisect-footer">
                <button className="btn-reset" onClick={handleReset}>重置 Bisect</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
export default BisectPanel;
