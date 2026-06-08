/**
 * 标签操作专业弹窗集 — Fork 风格
 * 新建标签 / 删除标签 / 推送标签
 *
 * 设计对标 Fork：
 * - 轻量标签 vs 注释标签单选切换
 * - 注释标签展开消息编辑器
 * - 下拉选择器选择目标提交/分支
 * - 操作命令预览
 * - 签名色 #00d4aa 强调
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRepoStore } from '../../stores/repoStore';

/* 公共设计令牌（与 BranchDialogs 一致） */
const C = {
  card: '#1e2229', cardBorder: '#2d333b',
  inputBg: '#0d1117', inputBorder: '#30363d', inputFocus: '#00d4aa',
  text: '#e6edf3', textMuted: '#8b949e', textFaint: '#484f58',
  accent: '#00d4aa', accentDim: '#00d4aa22',
  danger: '#f85149', dangerDim: '#f8514922',
  btnBg: '#21262d', btnBorder: '#30363d', btnHover: '#30363d',
  divider: '#21262d', overlay: 'rgba(0,0,0,0.65)',
};
const D = {
  overlay: { position: 'fixed' as const, inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.overlay, backdropFilter: 'blur(6px)' },
  card: (w = 420) => ({ width: w, background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)' }),
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 12px' },
  title: { margin: 0, fontSize: 15, fontWeight: 600, color: C.text },
  closeBtn: { background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  body: { padding: '4px 24px 20px' },
  field: { marginBottom: 18 },
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 6 },
  input: { width: '100%', boxSizing: 'border-box' as const, background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 6, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none' },
  textarea: { width: '100%', boxSizing: 'border-box' as const, background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 6, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none', resize: 'vertical' as const, minHeight: 72, fontFamily: 'inherit' },
  select: { width: '100%', boxSizing: 'border-box' as const, background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 6, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none', appearance: 'none' as const, cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238b949e' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' },
  radioGroup: { display: 'flex', gap: 0, marginBottom: 18, background: C.inputBg, borderRadius: 6, border: `1px solid ${C.inputBorder}`, overflow: 'hidden' },
  radioBtn: (active: boolean) => ({ flex: 1, padding: '8px 0', textAlign: 'center' as const, fontSize: 12, fontWeight: active ? 600 : 400, border: 'none', cursor: 'pointer', background: active ? C.accent : 'transparent', color: active ? '#0a0e14' : C.textMuted, transition: 'all 0.15s' }),
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textMuted, cursor: 'pointer', marginBottom: 6 },
  checkbox: { width: 16, height: 16, borderRadius: 4, accentColor: C.accent, cursor: 'pointer' },
  commandPreview: { background: C.inputBg, borderRadius: 6, padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', color: C.textFaint, marginBottom: 16, border: `1px solid ${C.inputBorder}` },
  footer: { display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: `1px solid ${C.divider}` },
  btnCancel: { padding: '7px 20px', fontSize: 13, fontWeight: 500, background: C.btnBg, color: C.textMuted, border: `1px solid ${C.btnBorder}`, borderRadius: 6, cursor: 'pointer' },
  btnPrimary: (disabled: boolean, danger = false) => ({ padding: '7px 24px', fontSize: 13, fontWeight: 600, background: disabled ? C.btnBg : (danger ? C.danger : C.accent), color: disabled ? C.textFaint : (danger ? '#fff' : '#0a0e14'), border: 'none', borderRadius: 6, cursor: disabled ? 'not-allowed' as const : 'pointer' as const, opacity: disabled ? 0.5 : 1 }),
  error: { fontSize: 12, color: C.danger, marginBottom: 12, padding: '8px 12px', background: C.dangerDim, borderRadius: 6 },
  hint: { fontSize: 11, color: C.textFaint, marginTop: 4 },
  tagListWrap: { background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 6, maxHeight: 200, overflowY: 'auto' },
  tagItem: (active: boolean) => ({ padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: active ? C.accent : C.text, background: active ? C.accentDim : 'transparent', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.1s' }),
  sectionLabel: { padding: '6px 12px 2px', fontSize: 10, color: C.textFaint, textTransform: 'uppercase' as const, letterSpacing: 0.08, fontWeight: 600 },
};

function focusStyle(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = C.inputFocus;
  e.currentTarget.style.boxShadow = `0 0 0 2px ${C.accentDim}`;
}
function blurStyle(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = C.inputBorder;
  e.currentTarget.style.boxShadow = 'none';
}

/* =================================================================== */
/*  新建标签弹窗                                                        */
/* =================================================================== */
interface NewTagDialogProps {
  onClose: () => void;
  onCreated?: () => void;
  defaultRef?: string;
}

export function NewTagDialog({ onClose, onCreated, defaultRef }: NewTagDialogProps) {
  const { branches, tags, refresh } = useRepoStore();
  const [tagName, setTagName] = useState('');
  const [tagRef, setTagRef] = useState(defaultRef || 'HEAD');
  const [tagType, setTagType] = useState<'lightweight' | 'annotated'>('annotated');
  const [tagMessage, setTagMessage] = useState('');
  const [pushAfterCreate, setPushAfterCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const localBranches = useMemo(() => branches.filter(b => !b.remote), [branches]);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const commandPreview = tagName.trim()
    ? tagType === 'annotated'
      ? `git tag -a ${tagName.trim()}${tagRef !== 'HEAD' ? ' ' + tagRef : ''} -m "${tagMessage || tagName.trim()}"`
      : `git tag ${tagName.trim()}${tagRef !== 'HEAD' ? ' ' + tagRef : ''}`
    : '';

  const handleSubmit = async () => {
    if (!tagName.trim()) return;
    setLoading(true); setError('');
    try {
      await window.electronAPI.git.createTag(
        tagName.trim(),
        tagRef === 'HEAD' ? undefined : tagRef,
        tagType === 'annotated' ? (tagMessage.trim() || tagName.trim()) : undefined
      );
      if (pushAfterCreate) {
        try { await window.electronAPI.git.pushTag(tagName.trim()); } catch { /* 非致命 */ }
      }
      await refresh();
      onCreated?.();
      onClose();
    } catch (e: any) { setError(e.message || '创建标签失败'); }
    finally { setLoading(false); }
  };

  return (
    <div style={D.overlay} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={D.card(440)}>
        <div style={D.header}>
          <h3 style={D.title}>
            <svg width="16" height="16" fill="none" stroke={C.accent} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
            新建标签
          </h3>
          <button onClick={onClose} style={D.closeBtn} onMouseEnter={e => e.currentTarget.style.background = C.btnHover} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✕</button>
        </div>
        <div style={D.body}>
          <div style={D.field}>
            <label style={D.label}>标签名称</label>
            <input ref={nameRef} style={D.input} placeholder="v1.0.0" value={tagName}
              onChange={e => setTagName(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>

          {/* 标签类型切换 */}
          <div style={D.radioGroup}>
            <button style={D.radioBtn(tagType === 'annotated')} onClick={() => setTagType('annotated')}>
              🏷 注释标签
            </button>
            <button style={D.radioBtn(tagType === 'lightweight')} onClick={() => setTagType('lightweight')}>
              📌 轻量标签
            </button>
          </div>

          {tagType === 'annotated' && (
            <div style={D.field}>
              <label style={D.label}>标签消息</label>
              <textarea style={D.textarea} placeholder="Release v1.0.0&#10;&#10;功能说明..." value={tagMessage}
                onChange={e => setTagMessage(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
            </div>
          )}

          <div style={D.field}>
            <label style={D.label}>基于提交/分支</label>
            <select style={D.select} value={tagRef} onChange={e => setTagRef(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}>
              <option value="HEAD">HEAD（当前提交）</option>
              {localBranches.map(b => <option key={b.name} value={b.name}>{b.name}{b.current ? ' (当前)' : ''}</option>)}
            </select>
          </div>

          <label style={D.checkLabel}>
            <input type="checkbox" style={D.checkbox} checked={pushAfterCreate} onChange={e => setPushAfterCreate(e.target.checked)} />
            创建后立即推送到远程
          </label>

          {commandPreview && (
            <div style={D.commandPreview}>
              <span style={{ color: C.textFaint }}>$ </span>
              <span style={{ color: C.accent }}>{commandPreview.split(' ')[0]}</span>
              {' ' + commandPreview.split(' ').slice(1).join(' ')}
            </div>
          )}

          {error && <div style={D.error}>⚠ {error}</div>}

          <div style={D.footer}>
            <button onClick={onClose} style={D.btnCancel}
              onMouseEnter={e => e.currentTarget.style.background = C.btnHover}
              onMouseLeave={e => e.currentTarget.style.background = C.btnBg}>取消</button>
            <button onClick={handleSubmit} disabled={loading || !tagName.trim()} style={D.btnPrimary(loading || !tagName.trim())}>
              {loading ? '创建中...' : '创建标签'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================================================================== */
/*  删除标签弹窗                                                        */
/* =================================================================== */
interface DeleteTagDialogProps {
  onClose: () => void;
  tagName?: string;
}

export function DeleteTagDialog({ onClose, tagName: defaultName }: DeleteTagDialogProps) {
  const { tags, refresh } = useRepoStore();
  const [selected, setSelected] = useState(defaultName || '');
  const [deleteRemote, setDeleteRemote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const commandPreview = selected
    ? deleteRemote
      ? `git tag -d ${selected} && git push origin :refs/tags/${selected}`
      : `git tag -d ${selected}`
    : '';

  const handleSubmit = async () => {
    if (!selected) return;
    setLoading(true); setError('');
    try {
      await window.electronAPI.git.deleteTag(selected);
      if (deleteRemote) {
        try { await window.electronAPI.git.push({ remote: 'origin', branch: `:refs/tags/${selected}` }); } catch { /* 非致命 */ }
      }
      await refresh(); onClose();
    } catch (e: any) { setError(e.message || '删除标签失败'); }
    finally { setLoading(false); }
  };

  return (
    <div style={D.overlay} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={D.card(420)}>
        <div style={D.header}>
          <h3 style={D.title}>
            <svg width="16" height="16" fill="none" stroke={C.danger} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            删除标签
          </h3>
          <button onClick={onClose} style={D.closeBtn} onMouseEnter={e => e.currentTarget.style.background = C.btnHover} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✕</button>
        </div>
        <div style={D.body}>
          <div style={D.field}>
            <label style={D.label}>选择要删除的标签</label>
            {tags.length === 0 ? (
              <div style={{ ...D.input, color: C.textFaint, textAlign: 'center' as const }}>暂无标签</div>
            ) : (
              <div style={D.tagListWrap}>
                {tags.map(t => (
                  <div key={t.name} style={D.tagItem(selected === t.name)} onClick={() => setSelected(t.name)}
                    onMouseEnter={e => { if (selected !== t.name) e.currentTarget.style.background = C.btnBg; }}
                    onMouseLeave={e => { if (selected !== t.name) e.currentTarget.style.background = 'transparent'; }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span style={{ flex: 1 }}>{t.name}</span>
                    {selected === t.name && <span style={{ color: C.accent, fontSize: 12 }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <label style={D.checkLabel}>
            <input type="checkbox" style={D.checkbox} checked={deleteRemote} onChange={e => setDeleteRemote(e.target.checked)} />
            同时删除远程标签
          </label>

          {commandPreview && (
            <div style={D.commandPreview}>
              <span style={{ color: C.textFaint }}>$ </span>
              <span style={{ color: C.accent }}>{commandPreview.split(' ')[0]}</span>
              {' ' + commandPreview.split(' ').slice(1).join(' ')}
            </div>
          )}

          {error && <div style={D.error}>⚠ {error}</div>}

          <div style={D.footer}>
            <button onClick={onClose} style={D.btnCancel}
              onMouseEnter={e => e.currentTarget.style.background = C.btnHover}
              onMouseLeave={e => e.currentTarget.style.background = C.btnBg}>取消</button>
            <button onClick={handleSubmit} disabled={loading || !selected} style={D.btnPrimary(loading || !selected, true)}>
              {loading ? '删除中...' : '删除标签'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================================================================== */
/*  推送标签弹窗                                                        */
/* =================================================================== */
interface PushTagDialogProps {
  onClose: () => void;
  tagName?: string;
}

export function PushTagDialog({ onClose, tagName: defaultName }: PushTagDialogProps) {
  const { tags, refresh } = useRepoStore();
  const [selected, setSelected] = useState(defaultName || '');
  const [pushAll, setPushAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const commandPreview = pushAll
    ? 'git push origin --tags'
    : selected
      ? `git push origin ${selected}`
      : '';

  const handleSubmit = async () => {
    if (!selected && !pushAll) return;
    setLoading(true); setError('');
    try {
      if (pushAll) {
        await window.electronAPI.git.pushAllTags?.();
      } else {
        await window.electronAPI.git.pushTag(selected);
      }
      await refresh(); onClose();
    } catch (e: any) { setError(e.message || '推送标签失败'); }
    finally { setLoading(false); }
  };

  return (
    <div style={D.overlay} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={D.card(420)}>
        <div style={D.header}>
          <h3 style={D.title}>
            <svg width="16" height="16" fill="none" stroke={C.accent} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            推送标签
          </h3>
          <button onClick={onClose} style={D.closeBtn} onMouseEnter={e => e.currentTarget.style.background = C.btnHover} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✕</button>
        </div>
        <div style={D.body}>
          <div style={D.field}>
            <label style={D.label}>选择要推送的标签</label>
            <div style={D.tagListWrap}>
              {tags.length === 0 ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 13, color: C.textFaint }}>暂无标签</div>
              ) : (
                tags.map(t => (
                  <div key={t.name} style={D.tagItem(selected === t.name)} onClick={() => { setSelected(t.name); setPushAll(false); }}
                    onMouseEnter={e => { if (selected !== t.name) e.currentTarget.style.background = C.btnBg; }}
                    onMouseLeave={e => { if (selected !== t.name) e.currentTarget.style.background = 'transparent'; }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span style={{ flex: 1 }}>{t.name}</span>
                    {selected === t.name && <span style={{ color: C.accent, fontSize: 12 }}>✓</span>}
                  </div>
                ))
              )}
            </div>
          </div>

          <label style={D.checkLabel}>
            <input type="checkbox" style={D.checkbox} checked={pushAll} onChange={e => { setPushAll(e.target.checked); if (e.target.checked) setSelected(''); }} />
            推送所有标签（--tags）
          </label>

          {commandPreview && (
            <div style={D.commandPreview}>
              <span style={{ color: C.textFaint }}>$ </span>
              <span style={{ color: C.accent }}>{commandPreview.split(' ')[0]}</span>
              {' ' + commandPreview.split(' ').slice(1).join(' ')}
            </div>
          )}

          {error && <div style={D.error}>⚠ {error}</div>}

          <div style={D.footer}>
            <button onClick={onClose} style={D.btnCancel}
              onMouseEnter={e => e.currentTarget.style.background = C.btnHover}
              onMouseLeave={e => e.currentTarget.style.background = C.btnBg}>取消</button>
            <button onClick={handleSubmit} disabled={loading || (!selected && !pushAll)} style={D.btnPrimary(loading || (!selected && !pushAll))}>
              {loading ? '推送中...' : '推送'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
