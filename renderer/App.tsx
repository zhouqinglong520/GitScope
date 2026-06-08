/**
 * 主应用组件
 * Fork 风格布局：简化标题栏 + 多仓库 Tab + 工具栏
 * 集成专业弹窗系统
 */

import React, { useState, useEffect, useReducer, useCallback } from 'react';
import MainLayout from './components/layout/MainLayout';
import Sidebar from './components/layout/Sidebar';
import QuickLaunch, { type QuickLaunchCommand } from './components/quicklaunch/QuickLaunch';
import { useRepoStore } from './stores/repoStore';
import { useMenuEvents, initialDialogState, dialogReducer, type DialogState, type DialogAction } from './hooks/useMenuEvents';
import { NewBranchDialog, DeleteBranchDialog, RenameBranchDialog, MergeBranchDialog, SwitchBranchDialog } from './components/dialogs/BranchDialogs';
import { NewTagDialog, DeleteTagDialog, PushTagDialog } from './components/dialogs/TagDialogs';
import { InitRepoDialog, RemotesManagerDialog, GitignoreEditorDialog, StashMenuDialog } from './components/dialogs/RepoDialogs';
import { zhCN } from './i18n/zh-CN';

function useI18n() { return zhCN; }

// ===== 克隆仓库弹窗（Fork 风格） =====
type CloneProtocol = 'https' | 'ssh';
interface CloneProgress { stage: string; message: string; percent: number; }

function CloneDialog({ onClose, onCloned }: { onClose: () => void; onCloned: (path: string) => void }) {
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneProtocol, setCloneProtocol] = useState<CloneProtocol>('https');
  const [clonePath, setClonePath] = useState('');
  const [cloneBranch, setCloneBranch] = useState('');
  const [cloneDepth, setCloneDepth] = useState('');
  const [cloneSingleBranch, setCloneSingleBranch] = useState(false);
  const [cloneSubmodules, setCloneSubmodules] = useState(false);
  const [cloneProgress, setCloneProgress] = useState<CloneProgress>({ stage: 'idle', message: '', percent: 0 });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clipboardHint, setClipboardHint] = useState('');

  useEffect(() => {
    try { const last = localStorage.getItem('majie_last_clone_path'); if (last) setClonePath(last); } catch {}
    (async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && (text.includes('github.com') || text.includes('gitee.com') || text.includes('gitlab.com') || text.endsWith('.git'))) {
          setClipboardHint(text.trim());
        }
      } catch {}
    })();
  }, []);

  const handleBrowsePath = async () => {
    const folder = await window.electronAPI.fs.selectFolder();
    if (folder) { setClonePath(folder); try { localStorage.setItem('majie_last_clone_path', folder); } catch {} }
  };

  const getRepoNameFromUrl = (url: string): string => { const match = url.match(/\/([^\/]+?)(\.git)?$/); return match ? match[1] : ''; };

  const buildCloneUrl = (): string => {
    if (!cloneUrl) return '';
    if (cloneUrl.startsWith('https://') || cloneUrl.startsWith('git@') || cloneUrl.startsWith('ssh://')) {
      if (cloneProtocol === 'ssh' && cloneUrl.startsWith('https://')) { const match = cloneUrl.match(/https:\/\/([^\/]+)\/(.+)/); if (match) return `git@${match[1]}:${match[2]}`; }
      if (cloneProtocol === 'https' && cloneUrl.startsWith('git@')) { const match = cloneUrl.match(/git@([^:]+):(.+)/); if (match) return `https://${match[1]}/${match[2]}`; }
      return cloneUrl;
    }
    if (cloneUrl.includes('/') && !cloneUrl.includes(' ')) { return cloneProtocol === 'ssh' ? `git@github.com:${cloneUrl}` : `https://github.com/${cloneUrl}`; }
    return cloneUrl;
  };

  const handleClone = async () => {
    const url = buildCloneUrl();
    if (!url || !clonePath) return;
    setCloneProgress({ stage: 'resolving', message: '正在解析仓库地址...', percent: 5 });
    try {
      const repoName = getRepoNameFromUrl(url);
      const targetPath = clonePath + (clonePath.endsWith('/') || clonePath.endsWith('\\') ? '' : '/') + (repoName || 'repo');
      setCloneProgress({ stage: 'downloading', message: '正在下载对象...', percent: 40 });
      const options: any = { url, path: targetPath };
      if (cloneBranch) options.branch = cloneBranch;
      if (cloneDepth && Number(cloneDepth) > 0) options.depth = Number(cloneDepth);
      if (cloneSingleBranch) options.singleBranch = true;
      await window.electronAPI.git.clone(options);
      setCloneProgress({ stage: 'done', message: '克隆完成！', percent: 100 });
      setTimeout(() => onCloned(targetPath), 800);
    } catch (e: any) { setCloneProgress({ stage: 'error', message: e.message || '克隆失败', percent: 0 }); }
  };

  const isCloning = !['idle', 'error', 'done'].includes(cloneProgress.stage);

  // 复用统一设计令牌
  const CS = {
    card: '#1e2229', cardBorder: '#2d333b', inputBg: '#0d1117', inputBorder: '#30363d',
    text: '#e6edf3', textMuted: '#8b949e', accent: '#00d4aa', btnBg: '#21262d', btnHover: '#30363d',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
      <div style={{ width: 520, background: CS.card, border: `1px solid ${CS.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.55)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 12px' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: CS.text }}>
            <svg width="16" height="16" fill="none" stroke={CS.accent} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            克隆仓库
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: CS.textMuted, cursor: 'pointer', fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>✕</button>
        </div>

        <div style={{ padding: '4px 24px 20px' }}>
          {/* 协议选择 */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: CS.textMuted, marginBottom: 6 }}>协议</label>
            <div style={{ display: 'flex', background: CS.inputBg, borderRadius: 6, border: `1px solid ${CS.inputBorder}`, overflow: 'hidden' }}>
              <button style={{ flex: 1, padding: '8px 0', textAlign: 'center', fontSize: 12, border: 'none', cursor: 'pointer', background: cloneProtocol === 'https' ? CS.accent : 'transparent', color: cloneProtocol === 'https' ? '#0a0e14' : CS.textMuted, fontWeight: cloneProtocol === 'https' ? 600 : 400 }} onClick={() => setCloneProtocol('https')}>HTTPS</button>
              <button style={{ flex: 1, padding: '8px 0', textAlign: 'center', fontSize: 12, border: 'none', cursor: 'pointer', background: cloneProtocol === 'ssh' ? CS.accent : 'transparent', color: cloneProtocol === 'ssh' ? '#0a0e14' : CS.textMuted, fontWeight: cloneProtocol === 'ssh' ? 600 : 400 }} onClick={() => setCloneProtocol('ssh')}>SSH</button>
            </div>
          </div>

          {/* 仓库 URL */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: CS.textMuted, marginBottom: 6 }}>仓库 URL</label>
            <div style={{ position: 'relative' }}>
              <input placeholder={cloneProtocol === 'https' ? 'https://github.com/user/repo.git' : 'git@github.com:user/repo.git'} value={cloneUrl} onChange={e => { setCloneUrl(e.target.value); setClipboardHint(''); }} style={{ width: '100%', boxSizing: 'border-box', background: CS.inputBg, border: `1px solid ${CS.inputBorder}`, borderRadius: 6, padding: '8px 12px', color: CS.text, fontSize: 13, outline: 'none', paddingRight: clipboardHint ? 70 : 12 }} />
              {clipboardHint && !cloneUrl && (
                <button onClick={() => { setCloneUrl(clipboardHint); setClipboardHint(''); }} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', padding: '3px 10px', fontSize: 11, background: '#00d4aa22', color: '#00d4aa', border: '1px solid #00d4aa44', borderRadius: 4, cursor: 'pointer' }}>粘贴</button>
              )}
            </div>
          </div>

          {/* 本地路径 */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: CS.textMuted, marginBottom: 6 }}>本地路径</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="选择本地存储路径" value={clonePath} onChange={e => setClonePath(e.target.value)} style={{ flex: 1, boxSizing: 'border-box', background: CS.inputBg, border: `1px solid ${CS.inputBorder}`, borderRadius: 6, padding: '8px 12px', color: CS.text, fontSize: 13, outline: 'none' }} />
              <button onClick={handleBrowsePath} style={{ padding: '8px 16px', fontSize: 12, background: CS.btnBg, color: CS.textMuted, border: `1px solid ${CS.inputBorder}`, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>浏览...</button>
            </div>
          </div>

          {/* 目标预览 */}
          {clonePath && cloneUrl && (
            <div style={{ marginBottom: 12, fontSize: 11, color: CS.textMuted }}>
              将克隆到: <span style={{ color: CS.accent }}>{clonePath}{clonePath.endsWith('/') ? '' : '/'}{getRepoNameFromUrl(buildCloneUrl()) || 'repo'}</span>
            </div>
          )}

          {/* 高级选项 */}
          <div style={{ marginBottom: 8 }}>
            <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: CS.accent, cursor: 'pointer', background: 'none', border: 'none', padding: '4px 0' }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                <path d="M9 5l7 7-7 7" />
              </svg>
              修改选项
            </button>
          </div>
          {showAdvanced && (
            <div style={{ background: CS.inputBg, borderRadius: 8, padding: '12px 14px', marginBottom: 16, border: `1px solid ${CS.inputBorder}`, display: 'flex', flexWrap: 'wrap', gap: '12px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 12, color: CS.textMuted, width: 48 }}>分支</label>
                <input placeholder="默认" value={cloneBranch} onChange={e => setCloneBranch(e.target.value)} style={{ width: 100, fontSize: 12, padding: '4px 8px', background: CS.inputBg, border: `1px solid ${CS.inputBorder}`, borderRadius: 4, color: CS.text, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 12, color: CS.textMuted, width: 60 }}>克隆深度</label>
                <input placeholder="完整" value={cloneDepth} onChange={e => setCloneDepth(e.target.value.replace(/\D/g, ''))} style={{ width: 60, fontSize: 12, padding: '4px 8px', background: CS.inputBg, border: `1px solid ${CS.inputBorder}`, borderRadius: 4, color: CS.text, outline: 'none' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: CS.textMuted, cursor: 'pointer' }}>
                <input type="checkbox" checked={cloneSingleBranch} onChange={e => setCloneSingleBranch(e.target.checked)} /> 单分支
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: CS.textMuted, cursor: 'pointer' }}>
                <input type="checkbox" checked={cloneSubmodules} onChange={e => setCloneSubmodules(e.target.checked)} /> 递归子模块
              </label>
            </div>
          )}

          {/* 进度条 */}
          {isCloning && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: CS.textMuted, marginBottom: 4 }}>{cloneProgress.message}</div>
              <div style={{ height: 4, background: CS.inputBg, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: CS.accent, borderRadius: 2, width: `${cloneProgress.percent}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
          {cloneProgress.stage === 'error' && <div style={{ marginBottom: 8, fontSize: 12, color: '#f85149' }}>⚠ {cloneProgress.message}</div>}
          {cloneProgress.stage === 'done' && <div style={{ marginBottom: 8, fontSize: 12, color: CS.accent }}>✓ {cloneProgress.message}</div>}

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #21262d' }}>
            <button onClick={onClose} style={{ padding: '7px 20px', fontSize: 13, fontWeight: 500, background: CS.btnBg, color: CS.textMuted, border: '1px solid #30363d', borderRadius: 6, cursor: 'pointer' }}>取消</button>
            <button onClick={handleClone} disabled={isCloning || !cloneUrl || !clonePath} style={{ padding: '7px 24px', fontSize: 13, fontWeight: 600, background: (isCloning || !cloneUrl || !clonePath) ? CS.btnBg : CS.accent, color: (isCloning || !cloneUrl || !clonePath) ? CS.textMuted : '#0a0e14', border: 'none', borderRadius: 6, cursor: (isCloning || !cloneUrl || !clonePath) ? 'not-allowed' : 'pointer', opacity: (isCloning || !cloneUrl || !clonePath) ? 0.5 : 1 }}>
              {isCloning ? '克隆中...' : '开始克隆'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================== 主 App 组件 ======================== */
function App() {
  const i18n = useI18n();

  // 弹窗状态管理
  const [dialogs, dispatch] = useReducer(dialogReducer, initialDialogState);

  // 监听主进程菜单事件
  useMenuEvents(dispatch);

  const {
    repos, activeRepoId, currentRepo, sidebarCollapsed,
    setActiveRepo, openRepo, closeRepo, isLoading, error,
    toggleSidebar, refresh, ahead, behind,
  } = useRepoStore();

  const [showQuickLaunch, setShowQuickLaunch] = useState(false);
  const [sidebarWidth] = useState(220);
  const [showCloneDialog, setShowCloneDialog] = useState(false);

  // 弹窗关闭回调
  const closeDialog = useCallback((dialog: keyof DialogState) => {
    dispatch({ type: 'HIDE', dialog });
  }, []);

  const handleOpenRepo = async () => {
    const path = await window.electronAPI.fs.selectFolder();
    if (path) await openRepo(path);
  };

  const handleCloseRepo = (repoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    closeRepo(repoId);
  };

  // Quick Launch 命令 — 使用专业弹窗
  const quickLaunchCommands: QuickLaunchCommand[] = [
    { id: 'clone', label: '克隆仓库', description: '克隆一个新的远程仓库', category: '仓库', shortcut: 'Ctrl+Shift+O', action: async () => { setShowCloneDialog(true); } },
    { id: 'new-branch', label: '新建分支', description: '创建一个新的分支', category: '分支', shortcut: 'Ctrl+Shift+N', action: async () => { dispatch({ type: 'SHOW', dialog: 'newBranch' }); } },
    { id: 'switch-branch', label: '切换分支', description: '切换到其他分支', category: '分支', action: () => { dispatch({ type: 'SHOW', dialog: 'switchBranch' }); } },
    { id: 'commit-all', label: '提交所有更改', description: '暂存并提交所有更改', category: '提交', shortcut: 'Ctrl+Enter', action: () => {} },
    { id: 'push', label: '推送', description: '推送到远程仓库', category: '远程', shortcut: 'Ctrl+P', action: async () => { if (currentRepo) await window.electronAPI.git.push(); } },
    { id: 'pull', label: '拉取', description: '从远程仓库拉取', category: '远程', shortcut: 'Ctrl+Shift+P', action: async () => { if (currentRepo) await window.electronAPI.git.pull(); } },
    { id: 'fetch', label: '获取', description: '获取远程更新', category: '远程', action: async () => { if (currentRepo) await window.electronAPI.git.fetch(); } },
    { id: 'stash', label: '暂存更改', description: '暂存当前更改', category: '暂存', shortcut: 'Ctrl+Shift+S', action: async () => { dispatch({ type: 'SHOW', dialog: 'stashMenu' }); } },
    { id: 'stash-pop', label: '恢复暂存', description: '恢复最近暂存的更改', category: '暂存', action: async () => { if (currentRepo) await window.electronAPI.git.stashPop(); } },
    { id: 'create-tag', label: '创建标签', description: '创建新的标签', category: '标签', action: async () => { dispatch({ type: 'SHOW', dialog: 'newTag' }); } },
    { id: 'open-terminal', label: '在终端中打开', description: '打开系统终端', category: '工具', shortcut: 'Ctrl+`', action: async () => { if (currentRepo) await window.electronAPI.shell.openTerminal(currentRepo.path); } },
    { id: 'refresh', label: '刷新', description: '刷新仓库状态', category: '工具', shortcut: 'F5', action: async () => { if (currentRepo) await window.electronAPI.git.refresh(); } },
    { id: 'amend', label: 'Amend Last Commit', description: '修改上次提交', category: '提交', shortcut: 'Ctrl+Shift+Enter', action: async () => { if (currentRepo) try { await window.electronAPI.git.commit('', { amend: true }); } catch (e) { console.error(e); } } },
    { id: 'reflog-visual', label: '操作时间线', description: '可视化 Reflog 时间线', category: '仓库', action: () => { window.dispatchEvent(new CustomEvent('showReflogVisual')); } },
    { id: 'shortcuts', label: '快捷键速查表', description: '查看所有快捷键', category: '工具', action: () => { window.dispatchEvent(new CustomEvent('showShortcuts')); } },
    { id: 'init-repo', label: '初始化仓库', description: '创建新的 Git 仓库', category: '仓库', action: () => { dispatch({ type: 'SHOW', dialog: 'initRepo' }); } },
    { id: 'manage-remotes', label: '管理远程仓库', description: '添加/编辑/删除远程仓库', category: '仓库', action: () => { dispatch({ type: 'SHOW', dialog: 'remotesManager' }); } },
    { id: 'edit-gitignore', label: '编辑 .gitignore', description: '编辑忽略规则文件', category: '仓库', action: () => { dispatch({ type: 'SHOW', dialog: 'gitignoreEditor' }); } },
  ];

  // 全局键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === 'k') || (e.ctrlKey && e.shiftKey && e.key === 'p')) { e.preventDefault(); setShowQuickLaunch(true); }
      if (e.ctrlKey && e.key === 'o') { e.preventDefault(); handleOpenRepo(); }
      if (e.ctrlKey && e.key === 'w') { e.preventDefault(); if (activeRepoId) closeRepo(activeRepoId); }
      if (e.ctrlKey && e.key === 'b') { e.preventDefault(); toggleSidebar(); }
      if (e.ctrlKey && e.key === '`') { e.preventDefault(); window.dispatchEvent(new CustomEvent('toggleTerminal')); }
      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') { e.preventDefault(); window.dispatchEvent(new CustomEvent('menu:amendCommit')); }
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') { e.preventDefault(); window.dispatchEvent(new CustomEvent('showShortcuts')); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeRepoId, closeRepo, toggleSidebar]);

  useEffect(() => {
    const unsubscribe = window.electronAPI.window.onMaximizeChange((isMaximized) => { console.log('窗口最大化状态:', isMaximized); });
    return unsubscribe;
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#10141a] text-white overflow-hidden">
      {/* 简化标题栏 */}
      <header className="h-9 bg-[#1e2229] flex items-center justify-between px-3 drag-region border-b border-[#252b34]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 no-drag">
            <svg className="w-4 h-4 text-[var(--accent)]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            <span className="font-semibold text-sm text-gradient">Majie</span>
          </div>
        </div>
        <div className="flex items-center no-drag">
          <button onClick={() => window.electronAPI.window.minimize()} className="w-10 h-7 flex items-center justify-center hover:bg-[#252b34] transition-colors" title={i18n.window.minimize}><span className="text-xs">─</span></button>
          <button onClick={() => window.electronAPI.window.maximize()} className="w-10 h-7 flex items-center justify-center hover:bg-[#252b34] transition-colors" title={i18n.window.maximize}><span className="text-xs">□</span></button>
          <button onClick={() => window.electronAPI.window.close()} className="w-10 h-7 flex items-center justify-center hover:bg-[#e81123] transition-colors" title={i18n.window.close}><span className="text-xs">✕</span></button>
        </div>
      </header>

      {/* 多仓库 Tab */}
      {repos.length > 0 && (
        <div className="h-9 bg-[#171b22] flex items-center border-b border-[#252b34]">
          <div className="flex-1 flex items-center overflow-x-auto">
            {repos.map((repo) => (
              <div key={repo.id} onClick={() => setActiveRepo(repo.id)} className={`group relative flex items-center gap-2 px-4 h-full cursor-pointer border-r border-[#252b34] ${activeRepoId === repo.id ? 'bg-[#10141a] text-white border-b-2 border-b-primary-500' : 'bg-[#1e2229] text-gray-400 hover:text-white hover:bg-[#333337]'}`}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                <span className="text-sm max-w-[120px] truncate">{repo.name}</span>
                <button onClick={(e) => handleCloseRepo(repo.id, e)} className="ml-1 w-5 h-5 flex items-center justify-center rounded hover:bg-[#252b34] opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-xs">✕</span></button>
                {activeRepoId === repo.id && repo.currentBranch && (<span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary-600/30 text-primary-400 rounded">{repo.currentBranch}</span>)}
              </div>
            ))}
          </div>
          <button onClick={handleOpenRepo} className="flex-shrink-0 w-9 h-full flex items-center justify-center hover:bg-[#252b34] transition-colors" title={i18n.toolbar.openRepo}><span className="text-lg">+</span></button>
        </div>
      )}

      {/* 工具栏 — 使用专业弹窗入口 */}
      {currentRepo && (
        <div className="h-10 bg-[#171b22] flex items-center justify-between px-3 border-b border-panel-border">
          <div className="flex items-center gap-1">
            <button onClick={() => window.dispatchEvent(new CustomEvent('showPushPullDialog', { detail: 'fetch' }))} className="btn-icon flex items-center gap-1.5 px-2 text-xs" title={`${i18n.toolbar.fetch} (Ctrl+Shift+F)`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <span>{i18n.toolbar.fetch}</span>
            </button>
            <button onClick={() => window.dispatchEvent(new CustomEvent('showPushPullDialog', { detail: 'pull' }))} className="btn-icon flex items-center gap-1.5 px-2" title={`${i18n.toolbar.pull} (Ctrl+Shift+P)`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              <span className="text-xs">{i18n.toolbar.pull}</span>
              {behind > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-600 text-white">↓ {behind}</span>}
            </button>
            <button onClick={() => window.dispatchEvent(new CustomEvent('showPushPullDialog', { detail: 'push' }))} className="btn-icon flex items-center gap-1.5 px-2" title={`${i18n.toolbar.push} (Ctrl+P)`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              <span className="text-xs">{i18n.toolbar.push}</span>
              {ahead > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-green-600 text-white">↑ {ahead}</span>}
            </button>
            <div className="h-5 w-px bg-[#252b34] mx-2" />
            <button onClick={() => dispatch({ type: 'SHOW', dialog: 'stashMenu' })} className="btn-icon flex items-center gap-1.5 px-2" title="Stash">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
              <span className="text-xs">Stash</span>
            </button>
            <div className="h-5 w-px bg-[#252b34] mx-2" />
            {/* 分支选择器 — 改为打开专业切换弹窗 */}
            <button onClick={() => dispatch({ type: 'SHOW', dialog: 'switchBranch' })} className="btn-icon flex items-center gap-1.5 px-2" title={i18n.branch.current}>
              <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <span className="text-xs text-primary-400 font-medium">{currentRepo.currentBranch}</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowQuickLaunch(true)} className="flex items-center gap-2 px-3 py-1.5 bg-[#252b34] hover:bg-[#2f353e] rounded text-xs text-gray-400 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <span>Quick Launch</span>
              <kbd className="px-1.5 py-0.5 bg-[#171b22] rounded text-[10px]">Ctrl+K</kbd>
            </button>
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {currentRepo && !sidebarCollapsed && (
          <aside className="bg-sidebar-bg border-r border-panel-border flex flex-col overflow-hidden" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
            <Sidebar onOpenRepo={handleOpenRepo} />
          </aside>
        )}
        <main className="flex-1 flex flex-col overflow-hidden">
          {currentRepo ? (
            <MainLayout />
          ) : (
            <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
              <div className="text-center animate-fade-in">
                <svg className="w-20 h-20 mx-auto mb-4 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                {isLoading ? <div className="text-[var(--text-muted)] mb-4">{i18n.common.loading}</div> : error ? <div className="text-[var(--danger)] mb-4">{error}</div> : <p className="text-[var(--text-muted)] text-sm mb-6">打开一个 Git 仓库开始工作</p>}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button onClick={handleOpenRepo} className="btn btn-primary px-6" disabled={isLoading}>{i18n.toolbar.openRepo}</button>
                  <button onClick={() => setShowCloneDialog(true)} className="btn px-6" style={{ background: '#2a2d2e', color: '#00d4aa', border: '1px solid #00d4aa44' }} disabled={isLoading}>克隆仓库</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 状态栏 */}
      <footer className="h-[22px] flex items-center justify-between px-3 text-[11px] select-none" style={{ background: 'var(--accent)', color: 'rgba(255,255,255,0.9)' }}>
        <div className="flex items-center gap-3">
          {currentRepo && (<><span className="flex items-center gap-1 font-medium"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>{currentRepo.currentBranch}</span>{ahead > 0 && <span className="opacity-80">↑{ahead}</span>}{behind > 0 && <span className="opacity-80">↓{behind}</span>}{ahead === 0 && behind === 0 && <span className="opacity-60">同步</span>}</>)}
        </div>
        <div className="flex items-center gap-3 opacity-80">
          <span>UTF-8</span><span>LF</span>
          {currentRepo && <span className="max-w-[250px] truncate">{currentRepo.path}</span>}
        </div>
      </footer>

      {/* Quick Launch */}
      <QuickLaunch isOpen={showQuickLaunch} onClose={() => setShowQuickLaunch(false)} commands={quickLaunchCommands} />

      {/* ===== 专业弹窗渲染 ===== */}
      {dialogs.cloneRepo && <CloneDialog onClose={() => closeDialog('cloneRepo')} onCloned={async (path) => { await openRepo(path); closeDialog('cloneRepo'); }} />}
      {showCloneDialog && <CloneDialog onClose={() => setShowCloneDialog(false)} onCloned={async (path) => { await openRepo(path); setShowCloneDialog(false); }} />}
      {dialogs.newBranch && <NewBranchDialog onClose={() => closeDialog('newBranch')} />}
      {dialogs.deleteBranch !== null && dialogs.deleteBranch !== false && <DeleteBranchDialog onClose={() => closeDialog('deleteBranch')} branchName={typeof dialogs.deleteBranch === 'string' ? dialogs.deleteBranch : undefined} />}
      {dialogs.renameBranch !== null && dialogs.renameBranch !== false && <RenameBranchDialog onClose={() => closeDialog('renameBranch')} branchName={typeof dialogs.renameBranch === 'string' ? dialogs.renameBranch : undefined} />}
      {dialogs.switchBranch && <SwitchBranchDialog onClose={() => closeDialog('switchBranch')} />}
      {dialogs.mergeBranch !== null && dialogs.mergeBranch !== false && <MergeBranchDialog onClose={() => closeDialog('mergeBranch')} sourceBranch={typeof dialogs.mergeBranch === 'string' ? dialogs.mergeBranch : undefined} />}
      {dialogs.newTag && <NewTagDialog onClose={() => closeDialog('newTag')} />}
      {dialogs.deleteTag !== null && dialogs.deleteTag !== false && <DeleteTagDialog onClose={() => closeDialog('deleteTag')} tagName={typeof dialogs.deleteTag === 'string' ? dialogs.deleteTag : undefined} />}
      {dialogs.pushTag !== null && dialogs.pushTag !== false && <PushTagDialog onClose={() => closeDialog('pushTag')} tagName={typeof dialogs.pushTag === 'string' ? dialogs.pushTag : undefined} />}
      {dialogs.initRepo && <InitRepoDialog onClose={() => closeDialog('initRepo')} />}
      {dialogs.remotesManager && <RemotesManagerDialog onClose={() => closeDialog('remotesManager')} />}
      {dialogs.gitignoreEditor && <GitignoreEditorDialog onClose={() => closeDialog('gitignoreEditor')} />}
      {dialogs.stashMenu && <StashMenuDialog onClose={() => closeDialog('stashMenu')} />}
    </div>
  );
}

export default App;
