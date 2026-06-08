/**
 * P1-8: 陈旧分支批量删除弹窗 — Fork 风格
 * 查询已合并到 HEAD 的分支 → 批量选择 → 批量删除
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useRepoStore } from '../../stores/repoStore';

const COLOR = {
  card: '#1e2229', cardBorder: '#2d333b', inputBg: '#0d1117', inputBorder: '#30363d',
  inputFocus: '#00d4aa', text: '#e6edf3', textMuted: '#8b949e', textFaint: '#484f58',
  accent: '#00d4aa', accentDim: '#00d4aa22', danger: '#f85149', dangerDim: '#f8514922',
  btnBg: '#21262d', btnBorder: '#30363d', btnHover: '#30363d', divider: '#21262d',
  overlay: 'rgba(0,0,0,0.65)',
};

interface StaleBranchDialogProps {
  onClose: () => void;
}

export function StaleBranchesDialog({ onClose }: StaleBranchDialogProps) {
  const { refresh } = useRepoStore();
  const [branches, setBranches] = useState<Array<{ name: string; isRemote: boolean; lastCommitDate: string; lastCommitMsg: string }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Array<{ name: string; success: boolean; error?: string }> | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = await window.electronAPI.git.getMergedBranches();
        setBranches(list);
      } catch (e: any) { setError(e.message || '查询失败'); }
      finally { setLoading(false); }
    })();
  }, []);

  const toggleAll = () => {
    if (selected.size === branches.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(branches.map(b => b.name)));
    }
  };

  const toggleOne = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name); else next.add(name);
    setSelected(next);
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true); setError(''); setResults(null);
    try {
      const res = await window.electronAPI.git.batchDeleteBranches([...selected], false);
      setResults(res);
      await refresh();
    } catch (e: any) { setError(e.message || '批量删除失败'); }
    finally { setDeleting(false); }
  };

  const successCount = results ? results.filter(r => r.success).length : 0;
  const failCount = results ? results.filter(r => !r.success).length : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLOR.overlay, backdropFilter: 'blur(6px)' }} onClick={e => e.target === e.currentTarget && !deleting && onClose()}>
      <div style={{ width: 520, background: COLOR.card, border: `1px solid ${COLOR.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.55)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 12px' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: COLOR.text }}>
            <svg width="16" height="16" fill="none" stroke={COLOR.danger} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            清理陈旧分支
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: COLOR.textMuted, cursor: 'pointer', fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>✕</button>
        </div>
        <div style={{ padding: '4px 24px 20px' }}>
          <div style={{ fontSize: 12, color: COLOR.textMuted, marginBottom: 12 }}>
            以下分支已合并到当前分支，可安全删除。受保护分支（main/master/develop）已自动排除。
          </div>

          {loading && <div style={{ textAlign: 'center', padding: '24px 0', color: COLOR.textMuted, fontSize: 13 }}>查询中...</div>}

          {!loading && branches.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: COLOR.accent, fontSize: 13 }}>✓ 没有已合并的陈旧分支</div>
          )}

          {!loading && branches.length > 0 && !results && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '6px 0', borderBottom: `1px solid ${COLOR.divider}` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: COLOR.textMuted, cursor: 'pointer' }}>
                  <input type="checkbox" checked={selected.size === branches.length} onChange={toggleAll} style={{ accentColor: COLOR.accent, cursor: 'pointer' }} />
                  全选 ({selected.size}/{branches.length})
                </label>
                <span style={{ fontSize: 11, color: COLOR.textFaint }}>{branches.length} 个已合并分支</span>
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto', background: COLOR.inputBg, borderRadius: 6, border: `1px solid ${COLOR.inputBorder}` }}>
                {branches.map(b => (
                  <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: `1px solid ${COLOR.divider}`, cursor: 'pointer' }} onClick={() => toggleOne(b.name)}>
                    <input type="checkbox" checked={selected.has(b.name)} onChange={() => toggleOne(b.name)} style={{ accentColor: COLOR.accent, cursor: 'pointer' }} />
                    <svg width="14" height="14" fill="none" stroke={b.isRemote ? COLOR.textFaint : COLOR.textMuted} strokeWidth={2} viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <span style={{ flex: 1, fontSize: 13, color: COLOR.text }}>{b.name}</span>
                    {b.isRemote && <span style={{ fontSize: 10, color: COLOR.textFaint, background: COLOR.btnBg, padding: '1px 6px', borderRadius: 3 }}>远程</span>}
                    <span style={{ fontSize: 11, color: COLOR.textFaint }}>{b.lastCommitDate}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {results && (
            <div style={{ background: COLOR.inputBg, borderRadius: 6, border: `1px solid ${COLOR.inputBorder}`, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: COLOR.accent, marginBottom: 8 }}>✓ 已完成删除操作</div>
              <div style={{ fontSize: 12, color: COLOR.textMuted, marginBottom: 6 }}>成功: {successCount} / 失败: {failCount}</div>
              {results.filter(r => !r.success).map(r => (
                <div key={r.name} style={{ fontSize: 11, color: COLOR.danger, marginBottom: 4 }}>
                  ✕ {r.name}: {r.error || '删除失败'}
                </div>
              ))}
            </div>
          )}

          {error && <div style={{ fontSize: 12, color: COLOR.danger, marginBottom: 12, padding: '8px 12px', background: COLOR.dangerDim, borderRadius: 6 }}>⚠ {error}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: `1px solid ${COLOR.divider}` }}>
            <button onClick={onClose} style={{ padding: '7px 20px', fontSize: 13, fontWeight: 500, background: COLOR.btnBg, color: COLOR.textMuted, border: `1px solid ${COLOR.btnBorder}`, borderRadius: 6, cursor: 'pointer' }}>
              {results ? '关闭' : '取消'}
            </button>
            {!results && (
              <button onClick={handleDelete} disabled={deleting || selected.size === 0} style={{ padding: '7px 24px', fontSize: 13, fontWeight: 600, background: (deleting || selected.size === 0) ? COLOR.btnBg : COLOR.danger, color: (deleting || selected.size === 0) ? COLOR.textFaint : '#fff', border: 'none', borderRadius: 6, cursor: (deleting || selected.size === 0) ? 'not-allowed' : 'pointer' as const, opacity: (deleting || selected.size === 0) ? 0.5 : 1 }}>
                {deleting ? '删除中...' : `删除 ${selected.size} 个分支`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
