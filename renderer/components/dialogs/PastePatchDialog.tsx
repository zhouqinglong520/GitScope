/**
 * P2-6: 粘贴 Patch 弹窗
 * 从剪贴板粘贴 diff/patch 内容，并应用到仓库
 */
import React, { useState, useEffect, useCallback } from 'react';

const C = {
  card: '#1e2229', border: '#2d333b', inputBg: '#0d1117', inputBorder: '#30363d',
  focus: '#00d4aa', text: '#e6edf3', muted: '#8b949e', faint: '#484f58',
  danger: '#f85149', dangerBg: '#f8514922', accent: '#00d4aa', accentBg: '#00d4aa22',
  overlay: 'rgba(0,0,0,0.65)', btn: '#21262d', btnBorder: '#30363d', btnHover: '#30363d',
};

interface Props { onClose: () => void; onApplied?: () => void; }

export const PastePatchDialog: React.FC<Props> = ({ onClose, onApplied }) => {
  const [patchContent, setPatchContent] = useState('');
  const [applyCached, setApplyCached] = useState(false);
  const [checkOnly, setCheckOnly] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [commandPreview, setCommandPreview] = useState('');

  // 从剪贴板读取
  useEffect(() => {
    (async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && (text.includes('diff --git') || text.includes('--- a/') || text.includes('+++ b/'))) {
          setPatchContent(text);
        }
      } catch {}
    })();
  }, []);

  // 命令预览
  useEffect(() => {
    const args = ['git', 'apply'];
    if (checkOnly) args.push('--check');
    if (applyCached) args.push('--cached');
    args.push('<patch>');
    setCommandPreview(args.join(' '));
  }, [applyCached, checkOnly]);

  const handleApply = async () => {
    if (!patchContent.trim()) return;
    setApplying(true);
    setResult(null);
    try {
      const res = await window.electronAPI.git.applyPatchFromContent(patchContent, {
        check: checkOnly,
        cached: applyCached,
      });
      setResult(res);
      if (res.success && !checkOnly) onApplied?.();
    } catch (e: any) {
      setResult({ success: false, message: e.message || '应用失败' });
    } finally {
      setApplying(false);
    }
  };

  const isValidPatch = patchContent.includes('diff --git') || patchContent.includes('--- a/') || patchContent.includes('+++ b/');

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, width: 620, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ color: C.text, fontSize: 15, fontWeight: 600, margin: 0 }}>粘贴 Patch</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* Patch 输入 */}
        <div style={{ padding: '16px 20px', flex: 1, overflow: 'auto' }}>
          <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 6 }}>Patch 内容（支持 git diff 格式）</label>
          <textarea
            value={patchContent}
            onChange={e => { setPatchContent(e.target.value); setResult(null); }}
            placeholder="粘贴 git diff 或 patch 内容到此处..."
            spellCheck={false}
            style={{
              width: '100%', height: 240, background: C.inputBg, color: C.text,
              border: `1px solid ${isValidPatch ? C.focus : C.inputBorder}`, borderRadius: 6,
              padding: 10, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', outline: 'none',
              boxShadow: isValidPatch ? `0 0 0 1px ${C.focus}33` : 'none',
            }}
          />

          {/* 选项 */}
          <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted, cursor: 'pointer' }}>
              <input type="checkbox" checked={applyCached} onChange={e => setApplyCached(e.target.checked)} />
              --cached（仅应用到暂存区）
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted, cursor: 'pointer' }}>
              <input type="checkbox" checked={checkOnly} onChange={e => setCheckOnly(e.target.checked)} />
              --check（仅检查不应用）
            </label>
          </div>

          {/* 命令预览 */}
          <div style={{ marginTop: 12, padding: '6px 10px', background: C.inputBg, borderRadius: 6, fontFamily: 'monospace', fontSize: 11, color: C.muted }}>
            {commandPreview}
          </div>

          {/* 结果 */}
          {result && (
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: 12, background: result.success ? C.accentBg : C.dangerBg, color: result.success ? C.accent : C.danger, border: `1px solid ${result.success ? C.accent + '33' : C.danger + '33'}` }}>
              {result.success ? '✓ Patch 应用成功' : `✕ ${result.message || '应用失败'}`}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={onClose} style={{ padding: '6px 16px', fontSize: 12, background: C.btn, color: C.muted, border: `1px solid ${C.btnBorder}`, borderRadius: 6, cursor: 'pointer' }}>取消</button>
          <button onClick={handleApply} disabled={!patchContent.trim() || applying} style={{
            padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
            background: applying ? C.muted : C.accent, color: applying ? C.faint : '#000',
            border: 'none', opacity: !patchContent.trim() || applying ? 0.5 : 1,
          }}>
            {applying ? '应用中...' : checkOnly ? '检查' : '应用 Patch'}
          </button>
        </div>
      </div>
    </div>
  );
};
