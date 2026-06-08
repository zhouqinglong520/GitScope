/**
 * 分支操作专业弹窗集 — Fork 风格
 * 新建分支 / 删除分支 / 重命名分支 / 合并分支 / 切换分支
 *
 * 设计对标 Fork：
 * - 标签在输入框上方（非左侧）
 * - 下拉选择器替代手动输入分支名
 * - 高级选项折叠（Modify Options）
 * - 操作命令预览
 * - 充足留白与间距
 * - 签名色 #00d4aa 强调 / 画布 #0a0e14 / 卡片 #1e2229
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRepoStore } from '../../stores/repoStore';

/* =================================================================== */
/*  公共设计令牌                                                        */
/* =================================================================== */
const COLOR = {
  card: '#1e2229',
  cardBorder: '#2d333b',
  inputBg: '#0d1117',
  inputBorder: '#30363d',
  inputFocus: '#00d4aa',
  text: '#e6edf3',
  textMuted: '#8b949e',
  textFaint: '#484f58',
  accent: '#00d4aa',
  accentDim: '#00d4aa22',
  danger: '#f85149',
  dangerDim: '#f8514922',
  btnBg: '#21262d',
  btnBorder: '#30363d',
  btnHover: '#30363d',
  divider: '#21262d',
  overlay: 'rgba(0,0,0,0.65)',
};

/* 公共样式块 */
const D = {
  overlay: {
    position: 'fixed' as const, inset: 0, zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: COLOR.overlay, backdropFilter: 'blur(6px)',
  },
  card: (w = 420) => ({
    width: w, background: COLOR.card, border: `1px solid ${COLOR.cardBorder}`,
    borderRadius: 12, overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)',
  }),
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 24px 12px',
  },
  title: { margin: 0, fontSize: 15, fontWeight: 600, color: COLOR.text },
  closeBtn: {
    background: 'none', border: 'none', color: COLOR.textMuted, cursor: 'pointer',
    fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center',
    justifyContent: 'center', borderRadius: 6, transition: 'background 0.15s',
  },
  body: { padding: '4px 24px 20px' },
  field: { marginBottom: 18 },
  label: {
    display: 'block', fontSize: 12, fontWeight: 500, color: COLOR.textMuted,
    marginBottom: 6, letterSpacing: 0.02,
  },
  input: {
    width: '100%', boxSizing: 'border-box' as const,
    background: COLOR.inputBg, border: `1px solid ${COLOR.inputBorder}`,
    borderRadius: 6, padding: '8px 12px', color: COLOR.text, fontSize: 13,
    outline: 'none', transition: 'border-color 0.15s',
  },
  select: {
    width: '100%', boxSizing: 'border-box' as const,
    background: COLOR.inputBg, border: `1px solid ${COLOR.inputBorder}`,
    borderRadius: 6, padding: '8px 12px', color: COLOR.text, fontSize: 13,
    outline: 'none', appearance: 'none' as const, cursor: 'pointer',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238b949e' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
  },
  checkLabel: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
    color: COLOR.textMuted, cursor: 'pointer', marginBottom: 6,
  },
  checkbox: {
    width: 16, height: 16, borderRadius: 4, accentColor: COLOR.accent, cursor: 'pointer',
  },
  optionsToggle: {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
    color: COLOR.accent, cursor: 'pointer', background: 'none', border: 'none',
    padding: '4px 0', marginBottom: 12,
  },
  optionsPanel: {
    background: COLOR.inputBg, borderRadius: 8, padding: '12px 14px',
    marginBottom: 16, border: `1px solid ${COLOR.inputBorder}`,
  },
  commandPreview: {
    background: COLOR.inputBg, borderRadius: 6, padding: '8px 12px',
    fontSize: 12, fontFamily: 'monospace', color: COLOR.textFaint,
    marginBottom: 16, border: `1px solid ${COLOR.inputBorder}`,
  },
  cmdHighlight: { color: COLOR.accent },
  footer: {
    display: 'flex', gap: 10, justifyContent: 'flex-end',
    paddingTop: 12, borderTop: `1px solid ${COLOR.divider}`,
  },
  btnCancel: {
    padding: '7px 20px', fontSize: 13, fontWeight: 500,
    background: COLOR.btnBg, color: COLOR.textMuted,
    border: `1px solid ${COLOR.btnBorder}`, borderRadius: 6,
    cursor: 'pointer', transition: 'background 0.15s',
  },
  btnPrimary: (disabled: boolean, danger = false) => ({
    padding: '7px 24px', fontSize: 13, fontWeight: 600,
    background: disabled ? COLOR.btnBg : (danger ? COLOR.danger : COLOR.accent),
    color: disabled ? COLOR.textFaint : (danger ? '#fff' : '#0a0e14'),
    border: 'none', borderRadius: 6,
    cursor: disabled ? 'not-allowed' as const : 'pointer' as const,
    transition: 'opacity 0.15s', opacity: disabled ? 0.5 : 1,
  }),
  error: {
    fontSize: 12, color: COLOR.danger, marginBottom: 12,
    padding: '8px 12px', background: COLOR.dangerDim,
    borderRadius: 6,
  },
  hint: { fontSize: 11, color: COLOR.textFaint, marginTop: 4 },
  /* 分支选择列表 */
  branchListWrap: {
    background: COLOR.inputBg, border: `1px solid ${COLOR.inputBorder}`,
    borderRadius: 6, maxHeight: 240, overflowY: 'auto',
  },
  branchSearch: {
    width: '100%', boxSizing: 'border-box' as const,
    background: 'transparent', border: 'none', borderBottom: `1px solid ${COLOR.inputBorder}`,
    padding: '8px 12px', color: COLOR.text, fontSize: 13, outline: 'none',
  },
  branchItem: (active: boolean) => ({
    padding: '7px 12px', cursor: 'pointer', fontSize: 13,
    color: active ? COLOR.accent : COLOR.text,
    background: active ? COLOR.accentDim : 'transparent',
    display: 'flex', alignItems: 'center', gap: 8,
    transition: 'background 0.1s',
  }),
  sectionLabel: {
    padding: '6px 12px 2px', fontSize: 10, color: COLOR.textFaint,
    textTransform: 'uppercase' as const, letterSpacing: 0.08, fontWeight: 600,
  },
};

/* 输入框聚焦效果 */
function focusStyle(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = COLOR.inputFocus;
  e.currentTarget.style.boxShadow = `0 0 0 2px ${COLOR.accentDim}`;
}
function blurStyle(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = COLOR.inputBorder;
  e.currentTarget.style.boxShadow = 'none';
}

/* =================================================================== */
/*  新建分支弹窗                                                        */
/* =================================================================== */
interface NewBranchDialogProps {
  onClose: () => void;
  onCreated?: () => void;
  defaultBase?: string;
}

export function NewBranchDialog({ onClose, onCreated, defaultBase }: NewBranchDialogProps) {
  const { branches, currentRepo, refresh } = useRepoStore();
  const [name, setName] = useState('');
  const [basePoint, setBasePoint] = useState(defaultBase || 'HEAD');
  const [checkout, setCheckout] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const [trackRemote, setTrackRemote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  const localBranches = useMemo(() => branches.filter(b => !b.remote), [branches]);
  const remoteBranches = useMemo(() => branches.filter(b => b.remote), [branches]);
  const currentBranch = localBranches.find(b => b.current)?.name || currentRepo?.currentBranch || '';

  useEffect(() => { nameRef.current?.focus(); }, []);

  const commandPreview = name.trim()
    ? `git ${checkout ? 'checkout -b' : 'branch'} ${name.trim()}${basePoint !== 'HEAD' ? ' ' + basePoint : ''}`
    : '';

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (!/^[a-zA-Z0-9\/_\-\.]+$/.test(name.trim())) {
      setError('分支名不能包含空格或特殊字符（~^:?\*等）');
      return;
    }
    setLoading(true); setError('');
    try {
      await window.electronAPI.git.createBranch(name.trim(), basePoint === 'HEAD' ? undefined : basePoint);
      if (checkout) await window.electronAPI.git.checkout(name.trim());
      await refresh();
      onCreated?.();
      onClose();
    } catch (e: any) { setError(e.message || '创建分支失败'); }
    finally { setLoading(false); }
  };

  return (
    <div style={D.overlay} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={D.card(440)}>
        <div style={D.header}>
          <h3 style={D.title}>
            <svg width="16" height="16" fill="none" stroke={COLOR.accent} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            新建分支
          </h3>
          <button onClick={onClose} style={D.closeBtn} onMouseEnter={e => e.currentTarget.style.background = COLOR.btnHover} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✕</button>
        </div>
        <div style={D.body}>
          <div style={D.field}>
            <label style={D.label}>分支名称</label>
            <input ref={nameRef} style={D.input} placeholder="feature/new-feature" value={name}
              onChange={e => setName(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            {name.trim() && <div style={D.hint}>
              将在 <span style={{ color: COLOR.accent }}>{basePoint === 'HEAD' ? '当前提交' : basePoint}</span> 上创建
            </div>}
          </div>
          <div style={D.field}>
            <label style={D.label}>基于</label>
            <select style={D.select} value={basePoint} onChange={e => setBasePoint(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}>
              <option value="HEAD">HEAD（当前提交）</option>
              {localBranches.filter(b => !b.current).map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              {remoteBranches.length > 0 && <option disabled>── 远程分支 ──</option>}
              {remoteBranches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
          </div>

          {/* 快速选项 */}
          <label style={D.checkLabel}>
            <input type="checkbox" style={D.checkbox} checked={checkout} onChange={e => setCheckout(e.target.checked)} />
            创建后立即切换到新分支
          </label>

          {/* 修改选项 */}
          <button style={D.optionsToggle} onClick={() => setShowOptions(!showOptions)}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ transform: showOptions ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
              <path d="M9 5l7 7-7 7" />
            </svg>
            修改选项
          </button>

          {showOptions && (
            <div style={D.optionsPanel}>
              <div style={D.field} style={{ marginBottom: 12 }}>
                <label style={D.label}>跟踪远程分支</label>
                <select style={D.select} value={trackRemote} onChange={e => setTrackRemote(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}>
                  <option value="">不跟踪</option>
                  {remoteBranches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* 命令预览 */}
          {commandPreview && (
            <div style={D.commandPreview}>
              <span style={{ color: COLOR.textFaint }}>$ </span>
              <span style={D.cmdHighlight}>{commandPreview.split(' ')[0]}</span>
              {' ' + commandPreview.split(' ').slice(1).join(' ')}
            </div>
          )}

          {error && <div style={D.error}>⚠ {error}</div>}

          <div style={D.footer}>
            <button onClick={onClose} style={D.btnCancel}
              onMouseEnter={e => e.currentTarget.style.background = COLOR.btnHover}
              onMouseLeave={e => e.currentTarget.style.background = COLOR.btnBg}>取消</button>
            <button onClick={handleSubmit} disabled={loading || !name.trim()} style={D.btnPrimary(loading || !name.trim())}>
              {loading ? '创建中...' : '创建分支'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================================================================== */
/*  删除分支弹窗                                                        */
/* =================================================================== */
interface DeleteBranchDialogProps {
  onClose: () => void;
  branchName?: string;
}

export function DeleteBranchDialog({ onClose, branchName: defaultName }: DeleteBranchDialogProps) {
  const { branches, refresh } = useRepoStore();
  const [selected, setSelected] = useState(defaultName || '');
  const [force, setForce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const localBranches = useMemo(() => branches.filter(b => !b.remote && !b.current), [branches]);

  const commandPreview = selected
    ? `git branch${force ? ' -D' : ' -d'} ${selected}`
    : '';

  const handleSubmit = async () => {
    if (!selected) return;
    setLoading(true); setError('');
    try {
      await window.electronAPI.git.deleteBranch(selected, force);
      await refresh(); onClose();
    } catch (e: any) { setError(e.message || '删除分支失败'); }
    finally { setLoading(false); }
  };

  return (
    <div style={D.overlay} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={D.card(420)}>
        <div style={D.header}>
          <h3 style={D.title}>
            <svg width="16" height="16" fill="none" stroke={COLOR.danger} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            删除分支
          </h3>
          <button onClick={onClose} style={D.closeBtn} onMouseEnter={e => e.currentTarget.style.background = COLOR.btnHover} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✕</button>
        </div>
        <div style={D.body}>
          <div style={D.field}>
            <label style={D.label}>选择要删除的分支</label>
            <select style={D.select} value={selected} onChange={e => setSelected(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}>
              <option value="">-- 选择分支 --</option>
              {localBranches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
          </div>

          <label style={D.checkLabel}>
            <input type="checkbox" style={D.checkbox} checked={force} onChange={e => setForce(e.target.checked)} />
            强制删除（--force，即使有未合并的更改）
          </label>

          {selected && !force && (
            <div style={{ ...D.hint, color: '#d29922', marginBottom: 12 }}>
              ⚠ 仅删除已完全合并的分支。如需删除未合并分支，请勾选强制删除。
            </div>
          )}

          {commandPreview && (
            <div style={D.commandPreview}>
              <span style={{ color: COLOR.textFaint }}>$ </span>
              <span style={D.cmdHighlight}>{commandPreview.split(' ')[0]}</span>
              {' ' + commandPreview.split(' ').slice(1).join(' ')}
            </div>
          )}

          {error && <div style={D.error}>⚠ {error}</div>}

          <div style={D.footer}>
            <button onClick={onClose} style={D.btnCancel}
              onMouseEnter={e => e.currentTarget.style.background = COLOR.btnHover}
              onMouseLeave={e => e.currentTarget.style.background = COLOR.btnBg}>取消</button>
            <button onClick={handleSubmit} disabled={loading || !selected} style={D.btnPrimary(loading || !selected, true)}>
              {loading ? '删除中...' : '删除分支'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================================================================== */
/*  重命名分支弹窗                                                      */
/* =================================================================== */
interface RenameBranchDialogProps {
  onClose: () => void;
  branchName?: string;
}

export function RenameBranchDialog({ onClose, branchName: defaultName }: RenameBranchDialogProps) {
  const { branches, currentRepo, refresh } = useRepoStore();
  const currentBranch = currentRepo?.currentBranch || '';
  const [selected, setSelected] = useState(defaultName || currentBranch);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const localBranches = useMemo(() => branches.filter(b => !b.remote), [branches]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const commandPreview = selected && newName.trim()
    ? `git branch -m ${selected} ${newName.trim()}`
    : '';

  const handleSubmit = async () => {
    if (!selected || !newName.trim()) return;
    setLoading(true); setError('');
    try {
      await window.electronAPI.git.renameBranch(selected, newName.trim());
      await refresh(); onClose();
    } catch (e: any) { setError(e.message || '重命名失败'); }
    finally { setLoading(false); }
  };

  return (
    <div style={D.overlay} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={D.card(440)}>
        <div style={D.header}>
          <h3 style={D.title}>
            <svg width="16" height="16" fill="none" stroke={COLOR.accent} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            重命名分支
          </h3>
          <button onClick={onClose} style={D.closeBtn} onMouseEnter={e => e.currentTarget.style.background = COLOR.btnHover} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✕</button>
        </div>
        <div style={D.body}>
          <div style={D.field}>
            <label style={D.label}>原分支</label>
            <select style={D.select} value={selected} onChange={e => setSelected(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}>
              {localBranches.map(b => <option key={b.name} value={b.name}>{b.name}{b.current ? ' (当前)' : ''}</option>)}
            </select>
          </div>
          <div style={D.field}>
            <label style={D.label}>新名称</label>
            <input ref={inputRef} style={D.input} placeholder="new-branch-name" value={newName}
              onChange={e => setNewName(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>

          {commandPreview && (
            <div style={D.commandPreview}>
              <span style={{ color: COLOR.textFaint }}>$ </span>
              <span style={D.cmdHighlight}>{commandPreview.split(' ')[0]}</span>
              {' ' + commandPreview.split(' ').slice(1).join(' ')}
            </div>
          )}

          {error && <div style={D.error}>⚠ {error}</div>}

          <div style={D.footer}>
            <button onClick={onClose} style={D.btnCancel}
              onMouseEnter={e => e.currentTarget.style.background = COLOR.btnHover}
              onMouseLeave={e => e.currentTarget.style.background = COLOR.btnBg}>取消</button>
            <button onClick={handleSubmit} disabled={loading || !newName.trim() || !selected} style={D.btnPrimary(loading || !newName.trim() || !selected)}>
              {loading ? '重命名中...' : '重命名'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================================================================== */
/*  合并分支弹窗                                                        */
/* =================================================================== */
interface MergeBranchDialogProps {
  onClose: () => void;
  sourceBranch?: string;
}

export function MergeBranchDialog({ onClose, sourceBranch: defaultSource }: MergeBranchDialogProps) {
  const { branches, currentRepo, refresh } = useRepoStore();
  const currentBranch = currentRepo?.currentBranch || '';
  const [source, setSource] = useState(defaultSource || '');
  const [noFf, setNoFf] = useState(false);
  const [squash, setSquash] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const localBranches = useMemo(() => branches.filter(b => !b.remote && !b.current), [branches]);
  const remoteBranches = useMemo(() => branches.filter(b => b.remote), [branches]);

  const commandParts = ['git merge'];
  if (noFf) commandParts.push('--no-ff');
  if (squash) commandParts.push('--squash');
  commandParts.push(source || '<branch>');
  const commandPreview = commandParts.join(' ');

  const handleSubmit = async () => {
    if (!source) return;
    setLoading(true); setError('');
    try {
      if (squash) {
        await window.electronAPI.git.merge(source, { squash: true });
      } else {
        await window.electronAPI.git.merge(source, noFf ? { noFf: true } : undefined);
      }
      await refresh(); onClose();
    } catch (e: any) { setError(e.message || '合并失败'); }
    finally { setLoading(false); }
  };

  return (
    <div style={D.overlay} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={D.card(460)}>
        <div style={D.header}>
          <h3 style={D.title}>
            <svg width="16" height="16" fill="none" stroke={COLOR.accent} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            合并到当前分支
          </h3>
          <button onClick={onClose} style={D.closeBtn} onMouseEnter={e => e.currentTarget.style.background = COLOR.btnHover} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✕</button>
        </div>
        <div style={D.body}>
          <div style={D.field}>
            <label style={D.label}>合并到</label>
            <div style={{ ...D.input, background: 'transparent', border: `1px solid ${COLOR.accentDim}`, color: COLOR.accent, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              {currentBranch}
            </div>
          </div>
          <div style={D.field}>
            <label style={D.label}>来源分支</label>
            <select style={D.select} value={source} onChange={e => setSource(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}>
              <option value="">-- 选择要合并的分支 --</option>
              {localBranches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              {remoteBranches.length > 0 && <option disabled>── 远程分支 ──</option>}
              {remoteBranches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
          </div>

          <button style={D.optionsToggle} onClick={() => setShowOptions(!showOptions)}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ transform: showOptions ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
              <path d="M9 5l7 7-7 7" />
            </svg>
            修改选项
          </button>

          {showOptions && (
            <div style={D.optionsPanel}>
              <label style={D.checkLabel}>
                <input type="checkbox" style={D.checkbox} checked={noFf} onChange={e => { setNoFf(e.target.checked); if (e.target.checked) setSquash(false); }} />
                不使用快进（--no-ff，保留合并节点）
              </label>
              <label style={D.checkLabel}>
                <input type="checkbox" style={D.checkbox} checked={squash} onChange={e => { setSquash(e.target.checked); if (e.target.checked) setNoFf(false); }} />
                Squash 合并（压缩为一个提交）
              </label>
            </div>
          )}

          {source && (
            <div style={{ ...D.hint, marginBottom: 12 }}>
              将 <span style={{ color: COLOR.accent }}>{source}</span> 合并到 <span style={{ color: COLOR.accent }}>{currentBranch}</span>
            </div>
          )}

          <div style={D.commandPreview}>
            <span style={{ color: COLOR.textFaint }}>$ </span>
            <span style={D.cmdHighlight}>{commandPreview.split(' ')[0]}</span>
            {' ' + commandPreview.split(' ').slice(1).join(' ')}
          </div>

          {error && <div style={D.error}>⚠ {error}</div>}

          <div style={D.footer}>
            <button onClick={onClose} style={D.btnCancel}
              onMouseEnter={e => e.currentTarget.style.background = COLOR.btnHover}
              onMouseLeave={e => e.currentTarget.style.background = COLOR.btnBg}>取消</button>
            <button onClick={handleSubmit} disabled={loading || !source} style={D.btnPrimary(loading || !source)}>
              {loading ? '合并中...' : '合并'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================================================================== */
/*  切换分支弹窗                                                        */
/* =================================================================== */
interface SwitchBranchDialogProps {
  onClose: () => void;
}

export function SwitchBranchDialog({ onClose }: SwitchBranchDialogProps) {
  const { branches, refresh } = useRepoStore();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const localBranches = useMemo(() => branches.filter(b => !b.remote), [branches]);
  const remoteBranches = useMemo(() => branches.filter(b => b.remote), [branches]);

  const filtered = (list: typeof branches) =>
    list.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => { searchRef.current?.focus(); }, []);

  const handleSwitch = async (name: string) => {
    setLoading(true); setError('');
    try { await window.electronAPI.git.checkout(name); await refresh(); onClose(); }
    catch (e: any) { setError(e.message || '切换失败'); setLoading(false); }
  };

  const handleCreateFromRemote = async (remoteName: string) => {
    const localName = remoteName.replace(/^origin\//, '');
    setLoading(true); setError('');
    try {
      await window.electronAPI.git.createBranch(localName, remoteName);
      await window.electronAPI.git.checkout(localName);
      await refresh(); onClose();
    } catch (e: any) { setError(e.message || '创建本地分支失败'); setLoading(false); }
  };

  const filteredLocal = filtered(localBranches);
  const filteredRemote = filtered(remoteBranches);

  return (
    <div style={D.overlay} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={D.card(360)}>
        <div style={D.header}>
          <h3 style={D.title}>
            <svg width="16" height="16" fill="none" stroke={COLOR.accent} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            切换分支
          </h3>
          <button onClick={onClose} style={D.closeBtn} onMouseEnter={e => e.currentTarget.style.background = COLOR.btnHover} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✕</button>
        </div>
        <div style={D.body}>
          <div style={{ ...D.field, marginBottom: 12 }}>
            <input ref={searchRef} style={D.input} placeholder="搜索分支..." value={search}
              onChange={e => setSearch(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
          </div>

          <div style={D.branchListWrap}>
            {filteredLocal.length === 0 && filteredRemote.length === 0 && (
              <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 13, color: COLOR.textFaint }}>
                无匹配分支
              </div>
            )}
            {filteredLocal.map(b => (
              <div key={b.name} style={D.branchItem(b.current)} onClick={() => !loading && handleSwitch(b.name)}
                onMouseEnter={e => { if (!b.current) e.currentTarget.style.background = COLOR.btnBg; }}
                onMouseLeave={e => { if (!b.current) e.currentTarget.style.background = 'transparent'; }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span style={{ flex: 1 }}>{b.name}</span>
                {b.current && <span style={{ fontSize: 10, color: COLOR.accent, background: COLOR.accentDim, padding: '2px 6px', borderRadius: 4 }}>当前</span>}
              </div>
            ))}
            {filteredRemote.length > 0 && (
              <>
                <div style={D.sectionLabel}>远程分支</div>
                {filteredRemote.map(b => (
                  <div key={b.name} style={D.branchItem(false)} onClick={() => !loading && handleCreateFromRemote(b.name)}
                    onMouseEnter={e => e.currentTarget.style.background = COLOR.btnBg}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9" />
                    </svg>
                    <span style={{ flex: 1 }}>{b.name}</span>
                    <span style={{ fontSize: 10, color: COLOR.textFaint, background: COLOR.btnBg, padding: '2px 6px', borderRadius: 4 }}>+本地</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {error && <div style={D.error}>⚠ {error}</div>}

          <div style={{ ...D.footer, borderTop: 'none', paddingTop: 8 }}>
            <button onClick={onClose} style={D.btnCancel}
              onMouseEnter={e => e.currentTarget.style.background = COLOR.btnHover}
              onMouseLeave={e => e.currentTarget.style.background = COLOR.btnBg}>关闭</button>
          </div>
        </div>
      </div>
    </div>
  );
}
