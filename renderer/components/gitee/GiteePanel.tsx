/**
 * Majie 码界 — Gitee 集成面板
 * OAuth 登录 + PR/MR 管理 + 仓库浏览
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { GiteeUser } from '../../../shared/types/ipc';
import './GiteePanel.css';

// GiteeUser imported from shared

interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  user: { login: string; avatar_url: string };
  head: { ref: string; sha: string; label: string };
  base: { ref: string; sha: string; label: string };
  created_at: string;
  updated_at: string;
  mergeable: boolean | null;
  merged: boolean;
  labels: Array<{ name: string; color: string }>;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  repoPath?: string;
}

type TabType = 'prs' | 'repos' | 'settings';

function GiteePanel({ visible, onClose, repoPath }: Props) {
  const [user, setUser] = useState<GiteeUser | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [tab, setTab] = useState<TabType>('prs');
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [prState, setPrState] = useState<'open' | 'closed' | 'merged'>('open');
  const [ownerRepo, setOwnerRepo] = useState<{ owner: string; repo: string } | null>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => { if (visible) checkLogin(); }, [visible]);
  useEffect(() => { if (visible && repoPath) detectGiteeRemote(); }, [visible, repoPath]);

  const checkLogin = async () => {
    try {
      const isLogged = await window.electronAPI.gitee.isLoggedIn();
      setLoggedIn(isLogged);
      if (isLogged) {
        const u = await window.electronAPI.gitee.getCurrentUser();
        if (u.login) setUser(u);
      }
    } catch {}
  };

  const detectGiteeRemote = async () => {
    try {
      const remotes: any[] = await window.electronAPI.git.getRemotes();
      const giteeRemote = remotes.find((r: any) => r.url?.includes('gitee.com'));
      if (giteeRemote?.url) {
        const parsed = await window.electronAPI.gitee.parseRepoFromRemote(giteeRemote.url);
        if (parsed) setOwnerRepo(parsed);
      }
    } catch {}
  };

  const handleLogin = async () => {
    setLoading(true); setError('');
    try {
      const result = await window.electronAPI.gitee.login();
      if (result.error) setError(result.error);
      else await checkLogin();
    } catch (e: any) { setError(e.message || '登录失败'); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await window.electronAPI.gitee.logout();
    setLoggedIn(false); setUser(null); setPrs([]); setRepos([]);
  };

  const loadPrs = useCallback(async (state: string = 'open') => {
    if (!ownerRepo) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.gitee.listPullRequests(ownerRepo.owner, ownerRepo.repo, state);
      if (result.error) setError(result.error);
      else setPrs(Array.isArray(result) ? result : []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [ownerRepo]);

  const loadRepos = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.gitee.listRepos();
      if (result.error) setError(result.error);
      else setRepos(Array.isArray(result) ? result : []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!visible || !loggedIn) return;
    if (tab === 'prs') loadPrs(prState);
    if (tab === 'repos') loadRepos();
  }, [tab, loggedIn, visible]);

  useEffect(() => {
    if (tab === 'prs' && loggedIn) loadPrs(prState);
  }, [prState]);

  const handleSaveOAuth = async () => {
    if (!clientId || !clientSecret) return;
    await window.electronAPI.gitee.setOAuthConfig(clientId, clientSecret);
    setError('');
  };

  if (!visible) return null;

  if (!loggedIn) {
    return (
      <div className="gitee-overlay">
        <div className="gitee-dialog" style={{ width: 440 }}>
          <div className="gitee-header">
            <div className="gitee-logo-area">
              <svg viewBox="0 0 24 24" className="gitee-logo-icon" fill="currentColor">
                <path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.926c0 .328-.265.593-.592.593H5.926a.593.593 0 0 1-.593-.593V9.778c0-3.27 2.652-5.926 5.926-5.926h6.815z"/>
              </svg>
              <h3>连接 Gitee</h3>
            </div>
            <button className="gitee-close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="gitee-login-body">
            <p className="gitee-login-desc">授权后可直接在 Majie 中管理 Pull Request、浏览仓库、查看 CI 状态</p>
            {error && <div className="gitee-error">{error}</div>}
            <div className="gitee-oauth-setup">
              <p className="gitee-setup-step">1. 前往 <a href="https://gitee.com/oauth/applications" target="_blank" rel="noreferrer">Gitee 开发者设置</a> 创建应用</p>
              <p className="gitee-setup-step">2. 回调地址填: <code>http://localhost:17892/callback</code></p>
              <p className="gitee-setup-step">3. 权限勾选: projects、pull_requests、issues</p>
              <div className="gitee-form-row">
                <label>Client ID</label>
                <input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="填入 Client ID" />
              </div>
              <div className="gitee-form-row">
                <label>Client Secret</label>
                <input value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="填入 Client Secret" type="password" />
              </div>
              <button className="gitee-btn gitee-btn-primary" onClick={handleLogin} disabled={!clientId || !clientSecret || loading}>
                {loading ? '授权中...' : '🔑 授权 Gitee 登录'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gitee-overlay">
      <div className="gitee-dialog" style={{ width: 640 }}>
        <div className="gitee-header">
          <div className="gitee-logo-area">
            {user?.avatar_url && <img src={user.avatar_url} className="gitee-avatar" />}
            <div>
              <h3>{user?.name || user?.login}</h3>
              <span className="gitee-username">@{user?.login}</span>
            </div>
          </div>
          <div className="gitee-header-actions">
            <button className="gitee-btn-sm" onClick={handleLogout}>退出</button>
            <button className="gitee-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="gitee-tabs">
          <button className={`gitee-tab ${tab === 'prs' ? 'active' : ''}`} onClick={() => setTab('prs')}>Pull Requests</button>
          <button className={`gitee-tab ${tab === 'repos' ? 'active' : ''}`} onClick={() => setTab('repos')}>仓库</button>
          <button className={`gitee-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>设置</button>
        </div>
        {error && <div className="gitee-error">{error}</div>}
        {tab === 'prs' && (
          <div className="gitee-content">
            {ownerRepo ? (
              <>
                <div className="gitee-pr-filters">
                  <span className="gitee-repo-label">{ownerRepo.owner}/{ownerRepo.repo}</span>
                  <div className="gitee-pr-state-btns">
                    {(['open', 'closed', 'merged'] as const).map(s => (
                      <button key={s} className={`gitee-state-btn ${prState === s ? 'active' : ''}`} onClick={() => setPrState(s)}>
                        {s === 'open' ? '打开' : s === 'closed' ? '已关闭' : '已合并'}
                      </button>
                    ))}
                  </div>
                </div>
                {loading ? <div className="gitee-loading">加载中...</div> :
                 prs.length === 0 ? <div className="gitee-empty">暂无 Pull Request</div> : (
                  <div className="gitee-pr-list">
                    {prs.map(pr => (
                      <div key={pr.id} className="gitee-pr-item">
                        <div className="gitee-pr-icon">{pr.merged ? '🔀' : pr.state === 'closed' ? '❌' : '🟢'}</div>
                        <div className="gitee-pr-info">
                          <div className="gitee-pr-title">#{pr.number} {pr.title}</div>
                          <div className="gitee-pr-meta">
                            <span>{pr.user?.login}</span>
                            <span>{pr.head.ref} → {pr.base.ref}</span>
                            <span>{new Date(pr.updated_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : <div className="gitee-empty">当前仓库未关联 Gitee 远程<br/><span className="gitee-hint">请添加 gitee.com 远程地址后重试</span></div>}
          </div>
        )}
        {tab === 'repos' && (
          <div className="gitee-content">
            {loading ? <div className="gitee-loading">加载中...</div> :
             repos.length === 0 ? <div className="gitee-empty">暂无仓库</div> : (
              <div className="gitee-repo-list">
                {repos.map(r => (
                  <div key={r.id} className="gitee-repo-item">
                    <div className="gitee-repo-icon">{r.private ? '🔒' : '📖'}</div>
                    <div className="gitee-repo-info">
                      <div className="gitee-repo-name">{r.full_name}</div>
                      <div className="gitee-repo-desc">{r.description || '无描述'}</div>
                    </div>
                    <span className="gitee-repo-branch">{r.default_branch}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === 'settings' && (
          <div className="gitee-content">
            <div className="gitee-settings">
              <h4>OAuth 配置</h4>
              <div className="gitee-form-row">
                <label>Client ID</label>
                <input value={clientId} onChange={e => setClientId(e.target.value)} />
              </div>
              <div className="gitee-form-row">
                <label>Client Secret</label>
                <input value={clientSecret} onChange={e => setClientSecret(e.target.value)} type="password" />
              </div>
              <button className="gitee-btn gitee-btn-primary" onClick={handleSaveOAuth}>保存</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GiteePanel;
