/**
 * Cherry-pick 对话框（增强版）
 * 支持多提交选择、冲突处理、继续/中止
 */
import React, { useState, useEffect } from 'react';
import { useI18 } from '../../i18n';
import { useRepoStore } from '../../stores/repoStore';

interface Props {
  visible: boolean;
  initialOid?: string;
  onClose: () => void;
  onRefresh: () => void;
}

interface CherryPickState {
  isActive: boolean;
  currentOid?: string;
  hasConflict: boolean;
  conflictingFiles: string[];
  completed: string[];
  remaining: string[];
}

export const CherryPickDialog: React.FC<Props> = ({ visible, initialOid, onClose, onRefresh }) => {
  const { t } = useI18();
  const { commits } = useRepoStore();
  const [selectedOids, setSelectedOids] = useState<string[]>([]);
  const [oidInput, setOidInput] = useState('');
  const [pickState, setPickState] = useState<CherryPickState>({
    isActive: false, hasConflict: false, conflictingFiles: [], completed: [], remaining: [],
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (visible && initialOid) {
      setSelectedOids([initialOid]);
    }
  }, [visible, initialOid]);

  // 检查是否正在进行 cherry-pick
  useEffect(() => {
    if (visible) checkCherryPickState();
  }, [visible]);

  const checkCherryPickState = async () => {
    try {
      const status = await window.electronAPI.git.getStatus();
      if (status && !status.isClean && status.staged.length === 0) {
        // 可能是 cherry-pick 中断状态
        const conflicted = await window.electronAPI.git.getConflictedFiles();
        if (conflicted.length > 0) {
          setPickState({
            isActive: true, hasConflict: true,
            conflictingFiles: conflicted.map(f => f.path),
            completed: [], remaining: [],
          });
        }
      }
    } catch (e) { /* ignore */ }
  };

  const addOid = () => {
    const oid = oidInput.trim();
    if (oid && !selectedOids.includes(oid)) {
      setSelectedOids([...selectedOids, oid]);
      setOidInput('');
    }
  };

  const removeOid = (oid: string) => {
    setSelectedOids(selectedOids.filter(o => o !== oid));
  };

  const handleCherryPick = async () => {
    if (selectedOids.length === 0) return;
    setLoading(true);
    setResult(null);
    setPickState({ isActive: true, hasConflict: false, conflictingFiles: [], completed: [], remaining: [...selectedOids] });

    const completed: string[] = [];
    for (const oid of selectedOids) {
      try {
        // 先预检冲突
        const check = await window.electronAPI.git.checkCherryPickConflict(oid);
        if (check.hasConflict) {
          // 有冲突，尝试 cherry-pick
          try {
            await window.electronAPI.git.cherryPick(oid);
            // cherry-pick 可能成功也可能停在冲突
            const status = await window.electronAPI.git.getStatus();
            const conflicted = status && !status.isClean ? await window.electronAPI.git.getConflictedFiles() : [];
            if (conflicted.length > 0) {
              setPickState({
                isActive: true, hasConflict: true,
                conflictingFiles: conflicted.map(f => f.path),
                completed, remaining: selectedOids.filter(o => !completed.includes(o) && o !== oid),
              });
              setResult({ success: false, message: `Cherry-pick ${oid.substring(0, 7)} 有冲突，请解决后继续` });
              setLoading(false);
              return;
            }
          } catch (e: any) {
            setPickState({
              isActive: true, hasConflict: true,
              conflictingFiles: check.conflictingFiles || [],
              completed, remaining: selectedOids.filter(o => !completed.includes(o) && o !== oid),
            });
            setResult({ success: false, message: `Cherry-pick ${oid.substring(0, 7)} 冲突: ${e.message}` });
            setLoading(false);
            return;
          }
        } else {
          await window.electronAPI.git.cherryPick(oid);
        }
        completed.push(oid);
      } catch (e: any) {
        setResult({ success: false, message: `Cherry-pick ${oid.substring(0, 7)} 失败: ${e.message}` });
        setLoading(false);
        return;
      }
    }
    setPickState({ isActive: false, hasConflict: false, conflictingFiles: [], completed, remaining: [] });
    setResult({ success: true, message: `成功 cherry-pick ${completed.length} 个提交` });
    onRefresh();
    setLoading(false);
  };

  const handleContinue = async () => {
    try {
      await window.electronAPI.git.continueCherryPick();
      const newCompleted = [...pickState.completed, pickState.remaining[0]];
      const newRemaining = pickState.remaining.slice(1);
      if (newRemaining.length > 0) {
        // 继续下一个
        setPickState({ ...pickState, hasConflict: false, conflictingFiles: [], completed: newCompleted, remaining: newRemaining });
        // 自动继续cherry-pick下一个
        try {
          await window.electronAPI.git.cherryPick(newRemaining[0]);
          newCompleted.push(newRemaining[0]);
          const finalRemaining = newRemaining.slice(1);
          setPickState({ isActive: finalRemaining.length > 0, hasConflict: false, conflictingFiles: [], completed: newCompleted, remaining: finalRemaining });
          if (finalRemaining.length === 0) {
            setResult({ success: true, message: `所有 ${newCompleted.length} 个提交已 cherry-pick 完成` });
            onRefresh();
          }
        } catch (e: any) {
          setResult({ success: false, message: `继续 cherry-pick 失败: ${e.message}` });
        }
      } else {
        setPickState({ isActive: false, hasConflict: false, conflictingFiles: [], completed: newCompleted, remaining: [] });
        setResult({ success: true, message: `所有 ${newCompleted.length} 个提交已 cherry-pick 完成` });
        onRefresh();
      }
    } catch (e: any) {
      setResult({ success: false, message: `继续失败: ${e.message}` });
    }
  };

  const handleAbort = async () => {
    if (!confirm('确定中止 Cherry-pick? 所有更改将被丢弃。')) return;
    try {
      await window.electronAPI.git.abortCherryPick();
      setPickState({ isActive: false, hasConflict: false, conflictingFiles: [], completed: [], remaining: [] });
      setResult({ success: true, message: '已中止 Cherry-pick' });
      onRefresh();
    } catch (e: any) {
      setResult({ success: false, message: `中止失败: ${e.message}` });
    }
  };

  const handleResolveUseOurs = async (path: string) => {
    try { await window.electronAPI.git.resolveConflictUseOurs(path); onRefresh(); checkCherryPickState(); }
    catch (e: any) { alert(`解决冲突失败: ${e.message}`); }
  };

  const handleResolveUseTheirs = async (path: string) => {
    try { await window.electronAPI.git.resolveConflictUseTheirs(path); onRefresh(); checkCherryPickState(); }
    catch (e: any) { alert(`解决冲突失败: ${e.message}`); }
  };

  if (!visible) return null;

  return (
    <div className="cp-overlay">
      <div className="cp-dialog">
        <div className="cp-header">
          <h3>🍒 Cherry-pick</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {/* 冲突状态 */}
        {pickState.hasConflict && (
          <div className="cp-conflict-panel">
            <div className="cp-conflict-header">
              ⚠️ Cherry-pick 冲突 — {pickState.conflictingFiles.length} 个文件
            </div>
            <div className="cp-conflict-files">
              {pickState.conflictingFiles.map(f => (
                <div key={f} className="cp-conflict-file">
                  <span className="cf-path">{f}</span>
                  <div className="cf-actions">
                    <button onClick={() => handleResolveUseOurs(f)} className="btn-ours">Use Ours</button>
                    <button onClick={() => handleResolveUseTheirs(f)} className="btn-theirs">Use Theirs</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="cp-conflict-actions">
              <button onClick={handleContinue} className="btn-primary">▶ 继续 Cherry-pick</button>
              <button onClick={handleAbort} className="btn-danger">⏹ 中止</button>
            </div>
          </div>
        )}

        {/* 进度 */}
        {pickState.isActive && !pickState.hasConflict && (
          <div className="cp-progress">
            <span>✅ 已完成 {pickState.completed.length}</span>
            <span>⏳ 剩余 {pickState.remaining.length}</span>
          </div>
        )}

        {/* SHA 选择 */}
        {!pickState.isActive && (
          <div className="cp-select">
            <div className="cp-oid-input-row">
              <input
                placeholder="输入提交 SHA（支持多个）"
                value={oidInput}
                onChange={e => setOidInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addOid()}
                className="cp-input"
              />
              <button onClick={addOid} disabled={!oidInput.trim()} className="btn-sm">添加</button>
            </div>
            {selectedOids.length > 0 && (
              <div className="cp-oid-list">
                {selectedOids.map(oid => {
                  const commit = commits.find(c => c.oid === oid || c.oid.startsWith(oid));
                  return (
                    <div key={oid} className="cp-oid-item">
                      <span className="cp-oid-sha">{oid.substring(0, 7)}</span>
                      {commit && <span className="cp-oid-msg">{commit.message.substring(0, 50)}</span>}
                      <button className="cp-oid-remove" onClick={() => removeOid(oid)}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 结果 */}
        {result && (
          <div className={`cp-result ${result.success ? 'success' : 'error'}`}>
            {result.message}
          </div>
        )}

        {/* 操作按钮 */}
        {!pickState.isActive && (
          <div className="cp-actions">
            <button onClick={handleCherryPick} disabled={selectedOids.length === 0 || loading}
              className="btn-primary">
              {loading ? '⏳ 执行中...' : `🍒 Cherry-pick ${selectedOids.length} 个提交`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default CherryPickDialog;
