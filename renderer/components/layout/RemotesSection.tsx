/**
 * 远程仓库管理组件（增强版）
 * 显示所有远程仓库，支持添加/编辑/删除
 * 增强：远程分支展开+PR列表UI+Gitee标识+Fetch按钮
 */
import React, { useState, useEffect } from 'react';
import { useRepoStore } from '../../stores/repoStore';
import { useI18 } from '../../i18n';

interface PullRequest {
  id: number; title: string; state: string; url: string; author: string;
}

interface RemotesSectionProps {
  onRemoteChange?: () => void;
}

export function RemotesSection({ onRemoteChange }: RemotesSectionProps) {
  const { currentRepo } = useRepoStore();
  const { t } = useI18();

  const [remotes, setRemotes] = useState<Array<{ name: string; url: string }>>([]);
  const [expandedRemotes, setExpandedRemotes] = useState<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRemote, setEditingRemote] = useState<{ name: string; url: string } | null>(null);
  const [remoteBranches, setRemoteBranches] = useState<Record<string, string[]>>({});
  const [pullRequests, setPullRequests] = useState<Record<string, PullRequest[]>>({});
  const [loadingPRs, setLoadingPRs] = useState<Set<string>>(new Set());

  const loadRemotes = async () => {
    if (!currentRepo) return;
    try {
      const remoteList = await window.electronAPI.git.getRemotes();
      setRemotes(remoteList.map(r => ({ name: r.name, url: r.url })));
    } catch (error) { console.error('Failed to load remotes:', error); }
  };

  useEffect(() => { loadRemotes(); }, [currentRepo]);

  const loadRemoteBranches = async (remoteName: string) => {
    try {
      const branches = await window.electronAPI.git.getBranches();
      const remoteBranchesList = branches
        .filter(b => b.remote === remoteName)
        .map(b => b.name.replace(/^[^/]+\//, ''));
      setRemoteBranches(prev => ({ ...prev, [remoteName]: remoteBranchesList }));
    } catch (error) { console.error('Failed to load remote branches:', error); }
  };

  const loadPullRequests = async (remoteName: string) => {
    setLoadingPRs(prev => new Set(prev).add(remoteName));
    try {
      const prs = await window.electronAPI.git.getPullRequests(remoteName);
      setPullRequests(prev => ({ ...prev, [remoteName]: prs || [] }));
    } catch (error) {
      console.error('Failed to load PRs:', error);
      setPullRequests(prev => ({ ...prev, [remoteName]: [] }));
    } finally {
      setLoadingPRs(prev => { const s = new Set(prev); s.delete(remoteName); return s; });
    }
  };

  const toggleRemote = async (remoteName: string) => {
    const newExpanded = new Set(expandedRemotes);
    if (newExpanded.has(remoteName)) {
      newExpanded.delete(remoteName);
    } else {
      newExpanded.add(remoteName);
      if (!remoteBranches[remoteName]) await loadRemoteBranches(remoteName);
    }
    setExpandedRemotes(newExpanded);
  };

  const handleAddRemote = async (name: string, url: string) => {
    try { await window.electronAPI.git.addRemote(name, url); await loadRemotes(); setShowAddDialog(false); onRemoteChange?.(); }
    catch (error) { console.error('Failed to add remote:', error); }
  };

  const handleEditRemote = async (name: string, url: string) => {
    try { await window.electronAPI.git.setRemoteUrl(name, url); await loadRemotes(); setEditingRemote(null); onRemoteChange?.(); }
    catch (error) { console.error('Failed to edit remote:', error); }
  };

  const handleDeleteRemote = async (name: string) => {
    if (!confirm(t('remote.confirmDelete')?.replace('{name}', name) || `确定删除远程 ${name}?`)) return;
    try { await window.electronAPI.git.removeRemote(name); await loadRemotes(); onRemoteChange?.(); }
    catch (error) { console.error('Failed to delete remote:', error); }
  };

  const handleFetchRemote = async (remoteName: string) => {
    try { await window.electronAPI.git.fetch({ remote: remoteName }); await loadRemoteBranches(remoteName); }
    catch (error) { console.error('Failed to fetch:', error); }
  };

  const isValidUrl = (url: string): boolean => {
    const httpsRegex = /^https?:\/\/.+/;
    const sshRegex = /^[\w-]+@[\w.-]+:.+$/;
    const gitRegex = /^git:\/\/.+/;
    return httpsRegex.test(url) || sshRegex.test(url) || gitRegex.test(url);
  };

  const isGitee = (url: string) => /gitee\.com/i.test(url);
  const isGitHub = (url: string) => /github\.com/i.test(url);
  const getPlatformIcon = (url: string) => {
    if (isGitee(url)) return '🟠';
    if (isGitHub(url)) return '⚫';
    return '🌐';
  };

  return (
    <div className="py-1">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-xs font-medium text-gray-400">{t('remote.title')}</span>
        <button onClick={() => setShowAddDialog(true)}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-gray-400 hover:text-white transition-colors"
          title={t('remote.add')}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* 远程列表 */}
      {remotes.length === 0 ? (
        <div className="px-3 py-2 text-xs text-gray-500">{t('statusBar.noRemote')}</div>
      ) : (
        remotes.map(remote => (
          <div key={remote.name}>
            <div className="flex items-center gap-1 px-3 py-1 hover:bg-[#2a2d2e] cursor-pointer group"
              onClick={() => toggleRemote(remote.name)}>
              <svg className={`w-3 h-3 text-gray-500 transition-transform ${expandedRemotes.has(remote.name) ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm">{getPlatformIcon(remote.url)}</span>
              <span className="flex-1 text-sm text-gray-300 truncate">{remote.name}</span>
              {/* Gitee/GitHub badge */}
              {isGitee(remote.url) && <span className="text-[10px] px-1 bg-orange-500/20 text-orange-400 rounded">Gitee</span>}
              {isGitHub(remote.url) && <span className="text-[10px] px-1 bg-gray-500/20 text-gray-400 rounded">GitHub</span>}
              {/* 操作按钮 */}
              <div className="hidden group-hover:flex items-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); handleFetchRemote(remote.name); }}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-gray-500 hover:text-white" title="Fetch">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); setEditingRemote(remote); }}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-gray-500 hover:text-white" title={t('remote.edit')}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteRemote(remote.name); }}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-600/30 text-gray-500 hover:text-red-400" title={t('remote.delete')}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 展开显示 URL、分支、PR */}
            {expandedRemotes.has(remote.name) && (
              <div className="ml-6 pl-3 border-l border-[#3c3c3c]">
                <div className="px-3 py-1 text-xs text-gray-500 truncate" title={remote.url}>{remote.url}</div>

                {/* PR 列表按钮 */}
                {(isGitee(remote.url) || isGitHub(remote.url)) && (
                  <div className="px-3 py-1">
                    <button
                      onClick={() => loadPullRequests(remote.name)}
                      className="text-xs text-[#5799da] hover:text-[#7db8e8] flex items-center gap-1"
                      disabled={loadingPRs.has(remote.name)}
                    >
                      {loadingPRs.has(remote.name) ? '⏳ 加载中...' : '📋 查看 Pull Requests'}
                    </button>
                    {pullRequests[remote.name] && (
                      <div className="mt-1">
                        {pullRequests[remote.name].length === 0 ? (
                          <div className="text-xs text-gray-500 py-1">无 Pull Request</div>
                        ) : (
                          pullRequests[remote.name].map(pr => (
                            <div key={pr.id} className="flex items-center gap-2 py-0.5 text-xs hover:bg-[#2a2d2e] rounded px-1">
                              <span className={pr.state === 'open' ? 'text-green-400' : 'text-purple-400'}>
                                {pr.state === 'open' ? '○' : '●'}
                              </span>
                              <span className="text-gray-300 truncate flex-1">#{pr.id} {pr.title}</span>
                              <span className="text-gray-500 flex-shrink-0">{pr.author}</span>
                              <a href={pr.url} className="text-[#5799da] hover:underline flex-shrink-0" target="_blank" rel="noopener">↗</a>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 分支列表 */}
                {remoteBranches[remote.name]?.map(branch => (
                  <div key={branch}
                    className="flex items-center gap-2 px-3 py-0.5 text-xs text-gray-400 hover:text-white cursor-pointer hover:bg-[#2a2d2e] rounded"
                    onClick={() => window.electronAPI.git.checkout(`remotes/${remote.name}/${branch}`)}>
                    <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="truncate">{branch}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      {/* 添加/编辑远程对话框 */}
      {showAddDialog && (
        <RemoteDialog title={t('remote.add')} onSave={handleAddRemote}
          onClose={() => setShowAddDialog(false)} isValidUrl={isValidUrl} />
      )}
      {editingRemote && (
        <RemoteDialog title={t('remote.edit')} initialName={editingRemote.name} initialUrl={editingRemote.url}
          onSave={handleEditRemote} onClose={() => setEditingRemote(null)} isValidUrl={isValidUrl} />
      )}
    </div>
  );
}

function RemoteDialog({ title, initialName = '', initialUrl = '', onSave, onClose, isValidUrl }: {
  title: string; initialName?: string; initialUrl?: string;
  onSave: (name: string, url: string) => void; onClose: () => void;
  isValidUrl: (url: string) => boolean;
}) {
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(initialUrl);
  const [urlError, setUrlError] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    if (!isValidUrl(url)) { setUrlError('URL 格式无效'); return; }
    onSave(name.trim(), url.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg shadow-xl border border-[#3c3c3c] w-[400px]">
        <div className="px-4 py-3 border-b border-[#3c3c3c]">
          <h3 className="text-sm font-medium text-white">{title}</h3>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">名称</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="origin" className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#094771]" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">URL</label>
            <input type="text" value={url} onChange={(e) => { setUrl(e.target.value); setUrlError(''); }}
              placeholder="https://gitee.com/user/repo.git"
              className={`w-full bg-[#1e1e1e] border rounded px-3 py-2 text-sm text-white outline-none focus:border-[#094771] ${urlError ? 'border-red-500' : 'border-[#3c3c3c]'}`} />
            {urlError && <p className="text-xs text-red-400 mt-1">{urlError}</p>}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-[#3c3c3c] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-[#3c3c3c] rounded">取消</button>
          <button onClick={handleSave} disabled={!name.trim() || !url.trim()}
            className="px-4 py-1.5 text-sm bg-[#094771] text-white rounded hover:bg-[#0b5394] disabled:opacity-50">保存</button>
        </div>
      </div>
    </div>
  );
}

export default RemotesSection;
