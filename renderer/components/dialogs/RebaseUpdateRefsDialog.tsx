/**
 * P2-5: Rebase --update-refs 弹窗
 * 支持在 rebase 时自动更新指向被 rebase 提交的分支引用
 */
import React, { useState, useEffect } from 'react';

const C = {
  card: '#1e2229', border: '#2d333b', inputBg: '#0d1117', inputBorder: '#30363d',
  focus: '#00d4aa', text: '#e6edf3', muted: '#8b949e', faint: '#484f58',
  danger: '#f85149', dangerBg: '#f8514922', accent: '#00d4aa', accentBg: '#00d4aa22',
  overlay: 'rgba(0,0,0,0.65)', btn: '#21262d', btnBorder: '#30363d', btnHover: '#30363d',
};

interface Props { onClose: () => void; }

export const RebaseUpdateRefsDialog: React.FC<Props> = ({ onClose }) => {
  const [onto, setOnto] = useState('');
  const [updateRefs, setUpdateRefs] = useState(true);
  const [rebasing, setRebasing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; conflicts?: boolean; message?: string } | null>(null);
  const [branches, setBranches] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const all = await window.electronAPI.git.getBranches();
        setBranches(all.filter((b: any) => !b.remote && !b.current).map((b: any) => b.name));
      } catch {}
    })();
  }, []);

  const commandPreview = ['git', 'rebase', onto, updateRefs ? '--update-refs' : ''].filter(Boolean).join(' ');

  const handleRebase = async () => {
    if (!onto.trim()) return;
    setRebasing(true);
    setResult(null);
    try {
      const res = await window.electronAPI.git.rebaseWithUpdateRefs(onto, updateRefs);
      setResult(res);
    } catch (e: any) {
      setResult({ success: false, message: e.message || 'Rebase 失败' });
    } finally {
      setRebasing(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, width: 460, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ color: C.text, fontSize: 15, fontWeight: 600, margin: 0 }}>Rebase --update-refs</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 6 }}>目标分支 / 提交</label>
          <div style={{ position: 'relative' }}>
            <input
              value={onto} onChange={e => setOnto(e.target.value)}
              placeholder="如：main, develop, 或提交 SHA"
              list="rebase-onto-branches"
              style={{
                width: '100%', padding: '8px 12px', background: C.inputBg, color: C.text,
                border: `1px solid ${onto ? C.focus : C.inputBorder}`, borderRadius: 6, fontSize: 13, outline: 'none',
                boxShadow: onto ? `0 0 0 1px ${C.focus}33` : 'none',
              }}
            />
            <datalist id="rebase-onto-branches">
              {branches.map(b => <option key={b} value={b} />)}
            </datalist>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 12, color: C.muted, cursor: 'pointer' }}>
            <input type="checkbox" checked={updateRefs} onChange={e => setUpdateRefs(e.target.checked)}
              style={{ accentColor: C.accent }} />
            --update-refs（自动更新指向被 rebase 提交的分支引用）
          </label>

          <div style={{ marginTop: 12, padding: '8px 12px', background: C.accentBg, borderRadius: 6, fontSize: 11, color: C.accent, border: `1px solid ${C.accent}33` }}>
            💡 --update-refs 会自动将指向被 rebase 提交的分支（如 topic 分支）移动到对应的新提交上，避免 rebase 后分支仍指向旧提交。
          </div>

          {/* 命令预览 */}
          <div style={{ marginTop: 12, padding: '6px 10px', background: C.inputBg, borderRadius: 6, fontFamily: 'monospace', fontSize: 11, color: C.muted }}>
            {commandPreview}
          </div>

          {/* 结果 */}
          {result && (
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: 12, background: result.success ? C.accentBg : result.conflicts ? '#e8a84722' : C.dangerBg, color: result.success ? C.accent : result.conflicts ? '#e8a847' : C.danger, border: `1px solid ${result.success ? C.accent + '33' : result.conflicts ? '#e8a84733' : C.danger + '33'}` }}>
              {result.success ? '✓ Rebase 成功' : result.conflicts ? `⚠ ${result.message}` : `✕ ${result.message || 'Rebase 失败'}`}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={onClose} style={{ padding: '6px 16px', fontSize: 12, background: C.btn, color: C.muted, border: `1px solid ${C.btnBorder}`, borderRadius: 6, cursor: 'pointer' }}>取消</button>
          <button onClick={handleRebase} disabled={!onto.trim() || rebasing} style={{
            padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
            background: rebasing ? C.muted : C.accent, color: rebasing ? C.faint : '#000',
            border: 'none', opacity: !onto.trim() || rebasing ? 0.5 : 1,
          }}>
            {rebasing ? 'Rebase 中...' : '执行 Rebase'}
          </button>
        </div>
      </div>
    </div>
  );
};
