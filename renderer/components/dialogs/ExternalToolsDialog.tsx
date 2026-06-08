/**
 * P1-9: 外部 Diff/Merge 工具设置弹窗 — Fork 风格
 * 配置 git difftool / mergetool 外部工具
 */

import React, { useState, useEffect } from 'react';

const COLOR = {
  card: '#1e2229', cardBorder: '#2d333b', inputBg: '#0d1117', inputBorder: '#30363d',
  inputFocus: '#00d4aa', text: '#e6edf3', textMuted: '#8b949e', textFaint: '#484f58',
  accent: '#00d4aa', accentDim: '#00d4aa22', danger: '#f85149',
  btnBg: '#21262d', btnBorder: '#30363d', btnHover: '#30363d', divider: '#21262d',
  overlay: 'rgba(0,0,0,0.65)',
};

interface ExternalToolsDialogProps {
  onClose: () => void;
}

export function ExternalToolsDialog({ onClose }: ExternalToolsDialogProps) {
  const [diffTool, setDiffTool] = useState('');
  const [mergeTool, setMergeTool] = useState('');
  const [diffAvailable, setDiffAvailable] = useState<string[]>([]);
  const [mergeAvailable, setMergeAvailable] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [diffConfig, mergeConfig] = await Promise.all([
          window.electronAPI.git.getDiffToolConfig(),
          window.electronAPI.git.getMergeToolConfig(),
        ]);
        setDiffTool(diffConfig.tool);
        setMergeTool(mergeConfig.tool);
        setDiffAvailable(diffConfig.available);
        setMergeAvailable(mergeConfig.available);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (diffTool) await window.electronAPI.git.setDiffTool(diffTool);
      if (mergeTool) await window.electronAPI.git.setMergeTool(mergeTool);
      setSuccessMsg('配置已保存');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: any) { setError(e.message || '保存失败'); }
    finally { setSaving(false); }
  };

  const focusStyle = (e: React.FocusEvent<HTMLSelectElement>) => { e.currentTarget.style.borderColor = COLOR.inputFocus; e.currentTarget.style.boxShadow = `0 0 0 2px ${COLOR.accentDim}`; };
  const blurStyle = (e: React.FocusEvent<HTMLSelectElement>) => { e.currentTarget.style.borderColor = COLOR.inputBorder; e.currentTarget.style.boxShadow = 'none'; };
  const selectBase = { width: '100%', boxSizing: 'border-box' as const, background: COLOR.inputBg, border: `1px solid ${COLOR.inputBorder}`, borderRadius: 6, padding: '8px 12px', color: COLOR.text, fontSize: 13, outline: 'none' as const, appearance: 'none' as const, cursor: 'pointer' as const, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238b949e' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLOR.overlay, backdropFilter: 'blur(6px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 460, background: COLOR.card, border: `1px solid ${COLOR.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.55)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 12px' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: COLOR.text }}>
            <svg width="16" height="16" fill="none" stroke={COLOR.accent} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            外部工具设置
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: COLOR.textMuted, cursor: 'pointer', fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>✕</button>
        </div>
        <div style={{ padding: '4px 24px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: COLOR.textMuted, fontSize: 13 }}>加载配置...</div>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: COLOR.textMuted, marginBottom: 6 }}>Diff 工具 (difftool)</label>
                <select style={selectBase} value={diffTool} onChange={e => setDiffTool(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}>
                  <option value="">未配置</option>
                  {diffAvailable.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div style={{ marginTop: 4, fontSize: 11, color: COLOR.textFaint }}>
                  用于在外部工具中查看文件差异。在文件右键菜单中选择"在外部 Diff 工具中打开"时调用。
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: COLOR.textMuted, marginBottom: 6 }}>Merge 工具 (mergetool)</label>
                <select style={selectBase} value={mergeTool} onChange={e => setMergeTool(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}>
                  <option value="">未配置</option>
                  {mergeAvailable.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div style={{ marginTop: 4, fontSize: 11, color: COLOR.textFaint }}>
                  用于在合并冲突时调起外部三方合并工具。在冲突文件右键菜单中选择"在外部 Merge 工具中解决"时调用。
                </div>
              </div>

              <div style={{ background: COLOR.inputBg, borderRadius: 6, padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', color: COLOR.textFaint, border: `1px solid ${COLOR.inputBorder}`, marginBottom: 16 }}>
                <div>$ git config diff.guitool {diffTool || '<未设置>'}</div>
                <div>$ git config merge.tool {mergeTool || '<未设置>'}</div>
              </div>

              {successMsg && <div style={{ fontSize: 12, color: COLOR.accent, marginBottom: 12, padding: '8px 12px', background: COLOR.accentDim, borderRadius: 6 }}>✓ {successMsg}</div>}
              {error && <div style={{ fontSize: 12, color: COLOR.danger, marginBottom: 12, padding: '8px 12px', background: '#f8514922', borderRadius: 6 }}>⚠ {error}</div>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: `1px solid ${COLOR.divider}` }}>
                <button onClick={onClose} style={{ padding: '7px 20px', fontSize: 13, fontWeight: 500, background: COLOR.btnBg, color: COLOR.textMuted, border: `1px solid ${COLOR.btnBorder}`, borderRadius: 6, cursor: 'pointer' }}>关闭</button>
                <button onClick={handleSave} disabled={saving} style={{ padding: '7px 24px', fontSize: 13, fontWeight: 600, background: saving ? COLOR.btnBg : COLOR.accent, color: saving ? COLOR.textFaint : '#0a0e14', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' as const : 'pointer' as const }}>
                  {saving ? '保存中...' : '保存配置'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
