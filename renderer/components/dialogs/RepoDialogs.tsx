/**
 * 仓库操作专业弹窗集 — Fork 风格
 * 初始化仓库 / 远程仓库管理 / .gitignore 编辑器 / Stash 增强
 *
 * 设计对标 Fork：
 * - 初始化仓库：选路径 + 初始分支名 + .gitignore 模板 + LICENSE
 * - 远程仓库管理：CRUD 列表式管理
 * - .gitignore 编辑器：带模板选择
 * - Stash：支持部分 stash + 消息
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRepoStore } from '../../stores/repoStore';

/* 公共设计令牌 */
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
  card: (w = 480) => ({ width: w, background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)' }),
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 12px' },
  title: { margin: 0, fontSize: 15, fontWeight: 600, color: C.text },
  closeBtn: { background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  body: { padding: '4px 24px 20px' },
  field: { marginBottom: 18 },
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 6 },
  input: { width: '100%', boxSizing: 'border-box' as const, background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 6, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none' },
  inputWithBtn: { display: 'flex', gap: 8 },
  select: { width: '100%', boxSizing: 'border-box' as const, background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 6, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none', appearance: 'none' as const, cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238b949e' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' },
  textarea: { width: '100%', boxSizing: 'border-box' as const, background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 6, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none', resize: 'vertical' as const, minHeight: 160, fontFamily: 'monospace', lineHeight: 1.6 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textMuted, cursor: 'pointer', marginBottom: 6 },
  checkbox: { width: 16, height: 16, borderRadius: 4, accentColor: C.accent, cursor: 'pointer' },
  commandPreview: { background: C.inputBg, borderRadius: 6, padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', color: C.textFaint, marginBottom: 16, border: `1px solid ${C.inputBorder}` },
  footer: { display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: `1px solid ${C.divider}` },
  btnCancel: { padding: '7px 20px', fontSize: 13, fontWeight: 500, background: C.btnBg, color: C.textMuted, border: `1px solid ${C.btnBorder}`, borderRadius: 6, cursor: 'pointer' },
  btnPrimary: (disabled: boolean) => ({ padding: '7px 24px', fontSize: 13, fontWeight: 600, background: disabled ? C.btnBg : C.accent, color: disabled ? C.textFaint : '#0a0e14', border: 'none', borderRadius: 6, cursor: disabled ? 'not-allowed' as const : 'pointer' as const, opacity: disabled ? 0.5 : 1 }),
  btnSmall: { padding: '6px 12px', fontSize: 12, background: C.btnBg, color: C.textMuted, border: `1px solid ${C.btnBorder}`, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  btnSmallAccent: { padding: '6px 12px', fontSize: 12, background: C.accent, color: '#0a0e14', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' as const },
  btnSmallDanger: { padding: '4px 10px', fontSize: 11, background: C.dangerDim, color: C.danger, border: `1px solid ${C.danger}33`, borderRadius: 4, cursor: 'pointer' },
  error: { fontSize: 12, color: C.danger, marginBottom: 12, padding: '8px 12px', background: C.dangerDim, borderRadius: 6 },
  hint: { fontSize: 11, color: C.textFaint, marginTop: 4 },
  remoteListWrap: { background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 6, maxHeight: 200, overflowY: 'auto' },
  remoteItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: `1px solid ${C.divider}`, fontSize: 13 },
  remoteName: { fontWeight: 600, color: C.accent, minWidth: 60 },
  remoteUrl: { flex: 1, color: C.textMuted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  optionsToggle: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.accent, cursor: 'pointer', background: 'none', border: 'none', padding: '4px 0', marginBottom: 12 },
  optionsPanel: { background: C.inputBg, borderRadius: 8, padding: '12px 14px', marginBottom: 16, border: `1px solid ${C.inputBorder}` },
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
/*  初始化仓库弹窗                                                      */
/* =================================================================== */
interface InitRepoDialogProps {
  onClose: () => void;
}

export function InitRepoDialog({ onClose }: InitRepoDialogProps) {
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [initialBranch, setInitialBranch] = useState('main');
  const [gitignoreTemplate, setGitignoreTemplate] = useState('none');
  const [license, setLicense] = useState('none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBrowse = async () => {
    const folder = await window.electronAPI.fs.selectFolder();
    if (folder) setPath(folder);
  };

  const commandPreview = path
    ? `git init${initialBranch !== 'main' ? ` -b ${initialBranch}` : ''} "${path}${name ? '/' + name : ''}"`
    : '';

  const handleSubmit = async () => {
    if (!path) return;
    setLoading(true); setError('');
    try {
      const targetPath = name ? `${path}/${name}` : path;
      await window.electronAPI.git.init?.(targetPath, initialBranch);
      await window.electronAPI.fs.openRepo(targetPath);
      onClose();
    } catch (e: any) { setError(e.message || '初始化仓库失败'); }
    finally { setLoading(false); }
  };

  return (
    <div style={D.overlay} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={D.card(480)}>
        <div style={D.header}>
          <h3 style={D.title}>
            <svg width="16" height="16" fill="none" stroke={C.accent} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M12 4v16m8-8H4" />
            </svg>
            初始化新仓库
          </h3>
          <button onClick={onClose} style={D.closeBtn} onMouseEnter={e => e.currentTarget.style.background = C.btnHover} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✕</button>
        </div>
        <div style={D.body}>
          <div style={D.field}>
            <label style={D.label}>仓库路径</label>
            <div style={D.inputWithBtn}>
              <input style={{ ...D.input, flex: 1 }} placeholder="选择或输入路径" value={path}
                onChange={e => setPath(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
              <button style={D.btnSmall} onClick={handleBrowse}>浏览...</button>
            </div>
          </div>

          <div style={D.field}>
            <label style={D.label}>仓库名称</label>
            <input style={D.input} placeholder="my-project" value={name}
              onChange={e => setName(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
            {path && <div style={D.hint}>将创建于: <span style={{ color: C.accent }}>{path}{name ? '/' + name : ''}</span></div>}
          </div>

          <div style={D.field}>
            <label style={D.label}>初始分支名</label>
            <input style={D.input} placeholder="main" value={initialBranch}
              onChange={e => setInitialBranch(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
          </div>

          <div style={D.field}>
            <label style={D.label}>.gitignore 模板</label>
            <select style={D.select} value={gitignoreTemplate} onChange={e => setGitignoreTemplate(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}>
              <option value="none">不创建</option>
              <option value="Node">Node</option>
              <option value="Python">Python</option>
              <option value="Java">Java</option>
              <option value="Go">Go</option>
              <option value="Rust">Rust</option>
              <option value="C++">C++</option>
              <option value="Global">Global/通用</option>
            </select>
          </div>

          <div style={D.field}>
            <label style={D.label}>LICENSE</label>
            <select style={D.select} value={license} onChange={e => setLicense(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}>
              <option value="none">不创建</option>
              <option value="MIT">MIT</option>
              <option value="Apache-2.0">Apache-2.0</option>
              <option value="GPL-3.0">GPL-3.0</option>
            </select>
          </div>

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
            <button onClick={handleSubmit} disabled={loading || !path} style={D.btnPrimary(loading || !path)}>
              {loading ? '初始化中...' : '创建仓库'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================================================================== */
/*  远程仓库管理弹窗                                                    */
/* =================================================================== */
interface RemotesManagerDialogProps {
  onClose: () => void;
}

export function RemotesManagerDialog({ onClose }: RemotesManagerDialogProps) {
  const { currentRepo, refresh } = useRepoStore();
  const [remotes, setRemotes] = useState<{ name: string; url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadRemotes(); }, []);

  const loadRemotes = async () => {
    try {
      const list = await window.electronAPI.git.getRemotes?.();
      if (Array.isArray(list)) setRemotes(list.map((r: any) => ({ name: r.name || r.remote, url: r.url || r.refs?.fetch || '' })));
    } catch { /* ignore */ }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newUrl.trim()) return;
    setLoading(true); setError('');
    try {
      await window.electronAPI.git.addRemote?.(newName.trim(), newUrl.trim());
      setNewName(''); setNewUrl('');
      await loadRemotes();
      await refresh();
    } catch (e: any) { setError(e.message || '添加远程仓库失败'); }
    finally { setLoading(false); }
  };

  const handleRemove = async (name: string) => {
    setLoading(true); setError('');
    try {
      await window.electronAPI.git.removeRemote?.(name);
      await loadRemotes();
      await refresh();
    } catch (e: any) { setError(e.message || '删除远程仓库失败'); }
    finally { setLoading(false); }
  };

  const handleSaveEdit = async (oldName: string) => {
    if (!editUrl.trim()) return;
    setLoading(true); setError('');
    try {
      await window.electronAPI.git.setRemoteUrl?.(oldName, editUrl.trim());
      setEditingIndex(null);
      await loadRemotes();
      await refresh();
    } catch (e: any) { setError(e.message || '更新远程仓库失败'); }
    finally { setLoading(false); }
  };

  return (
    <div style={D.overlay} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={D.card(520)}>
        <div style={D.header}>
          <h3 style={D.title}>
            <svg width="16" height="16" fill="none" stroke={C.accent} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9" />
            </svg>
            管理远程仓库
          </h3>
          <button onClick={onClose} style={D.closeBtn} onMouseEnter={e => e.currentTarget.style.background = C.btnHover} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✕</button>
        </div>
        <div style={D.body}>
          {/* 添加远程仓库 */}
          <div style={{ ...D.field, background: C.inputBg, borderRadius: 8, padding: 14, border: `1px solid ${C.inputBorder}` }}>
            <label style={{ ...D.label, marginBottom: 10 }}>添加远程仓库</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input style={{ ...D.input, width: 100, flex: 'none' }} placeholder="origin" value={newName}
                onChange={e => setNewName(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
              <input style={{ ...D.input, flex: 1 }} placeholder="https://github.com/user/repo.git" value={newUrl}
                onChange={e => setNewUrl(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
              <button style={D.btnSmallAccent} onClick={handleAdd} disabled={!newName.trim() || !newUrl.trim()}>添加</button>
            </div>
          </div>

          {/* 远程仓库列表 */}
          <div style={D.remoteListWrap}>
            {remotes.length === 0 ? (
              <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 13, color: C.textFaint }}>暂无远程仓库</div>
            ) : (
              remotes.map((remote, idx) => (
                <div key={remote.name} style={D.remoteItem}>
                  <span style={D.remoteName}>{remote.name}</span>
                  {editingIndex === idx ? (
                    <>
                      <input style={{ ...D.input, flex: 1, padding: '4px 8px', fontSize: 12 }} value={editUrl}
                        onChange={e => setEditUrl(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}
                        onKeyDown={e => e.key === 'Enter' && handleSaveEdit(remote.name)} />
                      <button style={{ ...D.btnSmallAccent, padding: '3px 8px', fontSize: 11 }} onClick={() => handleSaveEdit(remote.name)}>保存</button>
                      <button style={{ ...D.btnSmall, padding: '3px 8px', fontSize: 11 }} onClick={() => setEditingIndex(null)}>取消</button>
                    </>
                  ) : (
                    <>
                      <span style={D.remoteUrl}>{remote.url}</span>
                      <button style={{ ...D.btnSmall, padding: '3px 8px', fontSize: 11 }} onClick={() => { setEditingIndex(idx); setEditUrl(remote.url); }}>编辑</button>
                      <button style={D.btnSmallDanger} onClick={() => handleRemove(remote.name)}>删除</button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {error && <div style={D.error}>⚠ {error}</div>}

          <div style={D.footer}>
            <button onClick={onClose} style={D.btnCancel}
              onMouseEnter={e => e.currentTarget.style.background = C.btnHover}
              onMouseLeave={e => e.currentTarget.style.background = C.btnBg}>关闭</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================================================================== */
/*  .gitignore 编辑器弹窗                                              */
/* =================================================================== */
interface GitignoreEditorDialogProps {
  onClose: () => void;
}

const GITIGNORE_TEMPLATES: Record<string, string> = {
  'Node': 'node_modules/\ndist/\n.env\n*.log\n',
  'Python': '__pycache__/\n*.py[cod]\n*.egg-info/\n.venv/\n',
  'Java': 'target/\n*.class\n*.jar\n*.war\n.gradle/\n',
  'Go': 'bin/\n*.exe\n*.test\nvendor/\n',
  'Rust': 'target/\nCargo.lock\n**/*.rs.bk\n',
  'C++': 'build/\n*.o\n*.so\n*.out\ncmake-build-*/\n',
  'Global': '.DS_Store\nThumbs.db\n*.swp\n*.swo\n*~\n.idea/\n.vscode/\n',
};

export function GitignoreEditorDialog({ onClose }: GitignoreEditorDialogProps) {
  const { currentRepo } = useRepoStore();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadGitignore(); }, []);

  const loadGitignore = async () => {
    if (!currentRepo) return;
    setLoading(true);
    try {
      const text = await window.electronAPI.fs.readFile?.(`${currentRepo.path}/.gitignore`);
      setContent(text || '');
    } catch { setContent(''); }
    finally { setLoading(false); }
  };

  const handleApplyTemplate = (template: string) => {
    const tpl = GITIGNORE_TEMPLATES[template];
    if (tpl) {
      setContent(prev => prev ? prev + '\n' + tpl : tpl);
    }
  };

  const handleSave = async () => {
    if (!currentRepo) return;
    setSaving(true); setError('');
    try {
      await window.electronAPI.fs.writeFile?.(`${currentRepo.path}/.gitignore`, content);
      onClose();
    } catch (e: any) { setError(e.message || '保存失败'); }
    finally { setSaving(false); }
  };

  return (
    <div style={D.overlay} onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div style={D.card(540)}>
        <div style={D.header}>
          <h3 style={D.title}>
            <svg width="16" height="16" fill="none" stroke={C.accent} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            编辑 .gitignore
          </h3>
          <button onClick={onClose} style={D.closeBtn} onMouseEnter={e => e.currentTarget.style.background = C.btnHover} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✕</button>
        </div>
        <div style={D.body}>
          {/* 模板快捷插入 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 11, color: C.textFaint, lineHeight: '24px' }}>插入模板:</span>
            {Object.keys(GITIGNORE_TEMPLATES).map(tpl => (
              <button key={tpl} style={{ ...D.btnSmall, padding: '2px 8px', fontSize: 11 }} onClick={() => handleApplyTemplate(tpl)}>{tpl}</button>
            ))}
          </div>

          <div style={D.field}>
            <textarea ref={textareaRef} style={D.textarea} value={content}
              onChange={e => setContent(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}
              placeholder="# 添加要忽略的文件模式&#10;node_modules/&#10;dist/&#10;*.log" />
          </div>

          {error && <div style={D.error}>⚠ {error}</div>}

          <div style={D.footer}>
            <button onClick={onClose} style={D.btnCancel}
              onMouseEnter={e => e.currentTarget.style.background = C.btnHover}
              onMouseLeave={e => e.currentTarget.style.background = C.btnBg}>取消</button>
            <button onClick={handleSave} disabled={saving} style={D.btnPrimary(saving)}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================================================================== */
/*  Stash 增强（菜单入口用）                                            */
/* =================================================================== */
interface StashMenuDialogProps {
  onClose: () => void;
}

export function StashMenuDialog({ onClose }: StashMenuDialogProps) {
  const { currentRepo, refresh, status } = useRepoStore();
  const [message, setMessage] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(true);
  const [keepIndex, setKeepIndex] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const commandParts = ['git stash push'];
  if (message.trim()) commandParts.push(`-m "${message.trim()}"`);
  if (includeUntracked) commandParts.push('--include-untracked');
  if (keepIndex) commandParts.push('--keep-index');
  const commandPreview = commandParts.join(' ');

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      await window.electronAPI.git.stash({
        message: message.trim() || undefined,
        includeUntracked,
        keepIndex,
      });
      await refresh(); onClose();
    } catch (e: any) { setError(e.message || 'Stash 失败'); }
    finally { setLoading(false); }
  };

  return (
    <div style={D.overlay} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={D.card(440)}>
        <div style={D.header}>
          <h3 style={D.title}>
            <svg width="16" height="16" fill="none" stroke={C.accent} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            暂存更改 (Stash)
          </h3>
          <button onClick={onClose} style={D.closeBtn} onMouseEnter={e => e.currentTarget.style.background = C.btnHover} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✕</button>
        </div>
        <div style={D.body}>
          <div style={D.field}>
            <label style={D.label}>Stash 消息（可选）</label>
            <input style={D.input} placeholder="WIP: feature/login" value={message}
              onChange={e => setMessage(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>

          <label style={D.checkLabel}>
            <input type="checkbox" style={D.checkbox} checked={includeUntracked} onChange={e => setIncludeUntracked(e.target.checked)} />
            包含未跟踪文件（--include-untracked）
          </label>
          <label style={D.checkLabel}>
            <input type="checkbox" style={D.checkbox} checked={keepIndex} onChange={e => setKeepIndex(e.target.checked)} />
            保留暂存区（--keep-index）
          </label>

          <div style={D.commandPreview}>
            <span style={{ color: C.textFaint }}>$ </span>
            <span style={{ color: C.accent }}>{commandPreview.split(' ')[0]}</span>
            {' ' + commandPreview.split(' ').slice(1).join(' ')}
          </div>

          {error && <div style={D.error}>⚠ {error}</div>}

          <div style={D.footer}>
            <button onClick={onClose} style={D.btnCancel}
              onMouseEnter={e => e.currentTarget.style.background = C.btnHover}
              onMouseLeave={e => e.currentTarget.style.background = C.btnBg}>取消</button>
            <button onClick={handleSubmit} disabled={loading} style={D.btnPrimary(loading)}>
              {loading ? '暂存中...' : 'Stash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
