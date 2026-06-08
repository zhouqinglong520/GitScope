/**
 * P2-10: 部分 Stash 弹窗
 * 支持选择性暂存部分更改（git stash push -p）
 */
import React, { useState } from 'react';

const C = {
  card: '#1e2229', border: '#2d333b', inputBg: '#0d1117', inputBorder: '#30363d',
  focus: '#00d4aa', text: '#e6edf3', muted: '#8b949e', faint: '#484f58',
  danger: '#f85149', dangerBg: '#f8514922', accent: '#00d4aa', accentBg: '#00d4aa22',
  overlay: 'rgba(0,0,0,0.65)', btn: '#21262d', btnBorder: '#30363d', btnHover: '#30363d',
  stashColor: '#e8c547',
};

interface Props { onClose: () => void; onStashed?: () => void; }

export const PartialStashDialog: React.FC<Props> = ({ onClose, onStashed }) => {
  const [message, setMessage] = useState('');
  const [stashing, setStashing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [commandPreview, setCommandPreview] = useState('git stash push -p');

  // 更新命令预览
  useState(() => {
    const args = ['git', 'stash', 'push', '-p'];
    if (message) args.push('-m', `"${message}"`);
    setCommandPreview(args.join(' '));
  });

  const handleStash = async () => {
    setStashing(true);
    setResult(null);
    try {
      const res = await window.electronAPI.git.stashPartial({ message: message || undefined });
      setResult(res);
      if (res.success) onStashed?.();
    } catch (e: any) {
      setResult({ success: false, message: e.message || '部分 Stash 失败' });
    } finally {
      setStashing(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, width: 440, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: C.stashColor, fontSize: 18 }}>📦</span>
            <h3 style={{ color: C.text, fontSize: 15, fontWeight: 600, margin: 0 }}>部分 Stash</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* 内容 */}
        <div style={{ padding: '16px 20px' }}>
          <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 6, marginTop: 0 }}>Stash 消息（可选）</label>
          <input
            value={message} onChange={e => {
              setMessage(e.target.value);
              const args = ['git', 'stash', 'push', '-p'];
              if (e.target.value) args.push('-m', `"${e.target.value}"`);
              setCommandPreview(args.join(' '));
            }}
            placeholder="如：WIP: 部分修改"
            style={{
              width: '100%', padding: '8px 12px', background: C.inputBg, color: C.text,
              border: `1px solid ${C.inputBorder}`, borderRadius: 6, fontSize: 13, outline: 'none',
            }}
          />

          <div style={{ marginTop: 12, padding: '8px 12px', background: C.stashColor + '11', borderRadius: 6, fontSize: 12, color: C.stashColor, border: `1px solid ${C.stashColor}33` }}>
            ⚠️ 部分 Stash 会启动交互式模式。在终端中将逐个 hunk 询问是否暂存。当前实现会自动全选所有 hunk。
          </div>

          {/* 命令预览 */}
          <div style={{ marginTop: 12, padding: '6px 10px', background: C.inputBg, borderRadius: 6, fontFamily: 'monospace', fontSize: 11, color: C.muted }}>
            {commandPreview}
          </div>

          {/* 结果 */}
          {result && (
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: 12, background: result.success ? C.accentBg : C.dangerBg, color: result.success ? C.accent : C.danger, border: `1px solid ${result.success ? C.accent + '33' : C.danger + '33'}` }}>
              {result.success ? `✓ ${result.message || 'Stash 成功'}` : `✕ ${result.message || 'Stash 失败'}`}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={onClose} style={{ padding: '6px 16px', fontSize: 12, background: C.btn, color: C.muted, border: `1px solid ${C.btnBorder}`, borderRadius: 6, cursor: 'pointer' }}>取消</button>
          <button onClick={handleStash} disabled={stashing} style={{
            padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
            background: stashing ? C.muted : C.stashColor, color: stashing ? C.faint : '#000',
            border: 'none', opacity: stashing ? 0.5 : 1,
          }}>
            {stashing ? '暂存中...' : '部分 Stash'}
          </button>
        </div>
      </div>
    </div>
  );
};
