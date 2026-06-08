/**
 * P1-7: Git Flow 工作流弹窗 — Fork 风格
 * 内置 Feature / Release / Hotfix 工作流
 * 包含初始化配置 + 日常操作
 */

import React, { useState, useEffect } from 'react';
import { useRepoStore } from '../../stores/repoStore';

const COLOR = {
  card: '#1e2229', cardBorder: '#2d333b', inputBg: '#0d1117', inputBorder: '#30363d',
  inputFocus: '#00d4aa', text: '#e6edf3', textMuted: '#8b949e', textFaint: '#484f58',
  accent: '#00d4aa', accentDim: '#00d4aa22', danger: '#f85149', dangerDim: '#f8514922',
  btnBg: '#21262d', btnBorder: '#30363d', btnHover: '#30363d', divider: '#21262d',
  overlay: 'rgba(0,0,0,0.65)',
};

type GitFlowTab = 'feature' | 'release' | 'hotfix';

interface GitFlowDialogProps {
  onClose: () => void;
}

export function GitFlowDialog({ onClose }: GitFlowDialogProps) {
  const { branches, refresh } = useRepoStore();
  const [initialized, setInitialized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<GitFlowTab>('feature');

  // 初始化配置
  const [masterBranch, setMasterBranch] = useState('main');
  const [developBranch, setDevelopBranch] = useState('develop');
  const [featurePrefix, setFeaturePrefix] = useState('feature/');
  const [releasePrefix, setReleasePrefix] = useState('release/');
  const [hotfixPrefix, setHotfixPrefix] = useState('hotfix/');

  // 操作输入
  const [featureName, setFeatureName] = useState('');
  const [releaseVersion, setReleaseVersion] = useState('');
  const [hotfixVersion, setHotfixVersion] = useState('');
  const [tagMessage, setTagMessage] = useState('');
  const [squash, setSquash] = useState(false);
  const [deleteBranch, setDeleteBranch] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const isInit = await window.electronAPI.git.gitflowIsInitialized();
        setInitialized(isInit);
        if (isInit) {
          const config = await window.electronAPI.git.gitflowGetConfig();
          if (config['gitflow.branch.master']) setMasterBranch(config['gitflow.branch.master']);
          if (config['gitflow.branch.develop']) setDevelopBranch(config['gitflow.branch.develop']);
          if (config['gitflow.prefix.feature']) setFeaturePrefix(config['gitflow.prefix.feature']);
          if (config['gitflow.prefix.release']) setReleasePrefix(config['gitflow.prefix.release']);
          if (config['gitflow.prefix.hotfix']) setHotfixPrefix(config['gitflow.prefix.hotfix']);
        }
      } catch {}
      finally { setChecking(false); }
    })();
  }, []);

  // 匹配当前分支
  const featureBranches = branches.filter(b => !b.remote && b.name.startsWith(featurePrefix));
  const releaseBranches = branches.filter(b => !b.remote && b.name.startsWith(releasePrefix));
  const hotfixBranches = branches.filter(b => !b.remote && b.name.startsWith(hotfixPrefix));
  const currentBranch = branches.find(b => b.current)?.name || '';

  const handleInit = async () => {
    setLoading(true); setError('');
    try {
      await window.electronAPI.git.gitflowInit({
        masterBranch, developBranch, featurePrefix, releasePrefix, hotfixPrefix,
      });
      setInitialized(true);
      setSuccessMsg('Git Flow 初始化完成');
      setTimeout(() => setSuccessMsg(''), 3000);
      await refresh();
    } catch (e: any) { setError(e.message || '初始化失败'); }
    finally { setLoading(false); }
  };

  const handleStartFeature = async () => {
    if (!featureName.trim()) return;
    setLoading(true); setError('');
    try {
      const name = await window.electronAPI.git.gitflowStartFeature(featureName.trim());
      setSuccessMsg(`已创建并切换到 ${name}`);
      setFeatureName('');
      await refresh();
    } catch (e: any) { setError(e.message || '创建失败'); }
    finally { setLoading(false); }
  };

  const handleFinishFeature = async (name: string) => {
    setLoading(true); setError('');
    try {
      await window.electronAPI.git.gitflowFinishFeature(name, { squash, deleteBranch });
      setSuccessMsg(`Feature ${name} 已完成`);
      await refresh();
    } catch (e: any) { setError(e.message || '完成失败'); }
    finally { setLoading(false); }
  };

  const handleStartRelease = async () => {
    if (!releaseVersion.trim()) return;
    setLoading(true); setError('');
    try {
      const name = await window.electronAPI.git.gitflowStartRelease(releaseVersion.trim());
      setSuccessMsg(`已创建并切换到 ${name}`);
      setReleaseVersion('');
      await refresh();
    } catch (e: any) { setError(e.message || '创建失败'); }
    finally { setLoading(false); }
  };

  const handleFinishRelease = async (version: string) => {
    setLoading(true); setError('');
    try {
      await window.electronAPI.git.gitflowFinishRelease(version, { tagMessage: tagMessage || `Release ${version}`, deleteBranch });
      setSuccessMsg(`Release ${version} 已完成`);
      await refresh();
    } catch (e: any) { setError(e.message || '完成失败'); }
    finally { setLoading(false); }
  };

  const handleStartHotfix = async () => {
    if (!hotfixVersion.trim()) return;
    setLoading(true); setError('');
    try {
      const name = await window.electronAPI.git.gitflowStartHotfix(hotfixVersion.trim());
      setSuccessMsg(`已创建并切换到 ${name}`);
      setHotfixVersion('');
      await refresh();
    } catch (e: any) { setError(e.message || '创建失败'); }
    finally { setLoading(false); }
  };

  const handleFinishHotfix = async (version: string) => {
    setLoading(true); setError('');
    try {
      await window.electronAPI.git.gitflowFinishHotfix(version, { tagMessage: tagMessage || `Hotfix ${version}`, deleteBranch });
      setSuccessMsg(`Hotfix ${version} 已完成`);
      await refresh();
    } catch (e: any) { setError(e.message || '完成失败'); }
    finally { setLoading(false); }
  };

  const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = COLOR.inputFocus; e.currentTarget.style.boxShadow = `0 0 0 2px ${COLOR.accentDim}`; };
  const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = COLOR.inputBorder; e.currentTarget.style.boxShadow = 'none'; };
  const inputBase = { width: '100%', boxSizing: 'border-box' as const, background: COLOR.inputBg, border: `1px solid ${COLOR.inputBorder}`, borderRadius: 6, padding: '8px 12px', color: COLOR.text, fontSize: 13, outline: 'none' as const };

  // 未初始化：显示初始化表单
  if (!checking && !initialized) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLOR.overlay, backdropFilter: 'blur(6px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={{ width: 480, background: COLOR.card, border: `1px solid ${COLOR.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.55)' }}>
          <div style={{ padding: '16px 24px 12px' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: COLOR.text }}>
              <svg width="16" height="16" fill="none" stroke={COLOR.accent} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              初始化 Git Flow
            </h3>
          </div>
          <div style={{ padding: '4px 24px 20px' }}>
            <div style={{ fontSize: 12, color: COLOR.textMuted, marginBottom: 16 }}>
              配置 Git Flow 工作流的分支命名约定。初始化后将创建 develop 分支并保存配置。
            </div>
            {[
              { label: '主分支 (Production)', value: masterBranch, set: setMasterBranch, placeholder: 'main' },
              { label: '开发分支 (Develop)', value: developBranch, set: setDevelopBranch, placeholder: 'develop' },
              { label: 'Feature 前缀', value: featurePrefix, set: setFeaturePrefix, placeholder: 'feature/' },
              { label: 'Release 前缀', value: releasePrefix, set: setReleasePrefix, placeholder: 'release/' },
              { label: 'Hotfix 前缀', value: hotfixPrefix, set: setHotfixPrefix, placeholder: 'hotfix/' },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: COLOR.textMuted, marginBottom: 6 }}>{f.label}</label>
                <input style={inputBase} value={f.value} onChange={e => f.set(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} placeholder={f.placeholder} />
              </div>
            ))}
            <div style={{ background: COLOR.inputBg, borderRadius: 6, padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', color: COLOR.textFaint, border: `1px solid ${COLOR.inputBorder}`, marginBottom: 16 }}>
              <span style={{ color: COLOR.textFaint }}>$ </span>
              <span style={{ color: COLOR.accent }}>git flow init</span>
              {' '}--master={masterBranch} --develop={developBranch}
            </div>
            {error && <div style={{ fontSize: 12, color: COLOR.danger, marginBottom: 12, padding: '8px 12px', background: COLOR.dangerDim, borderRadius: 6 }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: `1px solid ${COLOR.divider}` }}>
              <button onClick={onClose} style={{ padding: '7px 20px', fontSize: 13, fontWeight: 500, background: COLOR.btnBg, color: COLOR.textMuted, border: `1px solid ${COLOR.btnBorder}`, borderRadius: 6, cursor: 'pointer' }}>取消</button>
              <button onClick={handleInit} disabled={loading} style={{ padding: '7px 24px', fontSize: 13, fontWeight: 600, background: loading ? COLOR.btnBg : COLOR.accent, color: loading ? COLOR.textFaint : '#0a0e14', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' as const : 'pointer' as const }}>
                {loading ? '初始化中...' : '初始化 Git Flow'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 已初始化：显示操作面板
  const tabs: Array<{ key: GitFlowTab; label: string; color: string; count: number }> = [
    { key: 'feature', label: 'Feature', color: '#58a6ff', count: featureBranches.length },
    { key: 'release', label: 'Release', color: '#d29922', count: releaseBranches.length },
    { key: 'hotfix', label: 'Hotfix', color: COLOR.danger, count: hotfixBranches.length },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLOR.overlay, backdropFilter: 'blur(6px)' }} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={{ width: 540, background: COLOR.card, border: `1px solid ${COLOR.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.55)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 12px' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: COLOR.text }}>
            <svg width="16" height="16" fill="none" stroke={COLOR.accent} strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: -2 }}>
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Git Flow
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: COLOR.textMuted, cursor: 'pointer', fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>✕</button>
        </div>

        {/* Tab 切换 */}
        <div style={{ display: 'flex', gap: 0, padding: '0 24px', borderBottom: `1px solid ${COLOR.divider}`, marginBottom: 16 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '8px 16px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? t.color : COLOR.textMuted, background: 'none', border: 'none', borderBottom: tab === t.key ? `2px solid ${t.color}` : '2px solid transparent', cursor: 'pointer', transition: 'border-color 0.15s' }}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <div style={{ padding: '0 24px 20px' }}>
          {/* 开始操作区 */}
          {tab === 'feature' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: COLOR.textMuted, marginBottom: 6 }}>开始新 Feature</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inputBase, flex: 1 }} placeholder="feature-name" value={featureName} onChange={e => setFeatureName(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} onKeyDown={e => e.key === 'Enter' && handleStartFeature()} />
                <button onClick={handleStartFeature} disabled={loading || !featureName.trim()} style={{ padding: '7px 20px', fontSize: 13, fontWeight: 600, background: (loading || !featureName.trim()) ? COLOR.btnBg : '#58a6ff', color: (loading || !featureName.trim()) ? COLOR.textFaint : '#fff', border: 'none', borderRadius: 6, cursor: (loading || !featureName.trim()) ? 'not-allowed' as const : 'pointer' as const, whiteSpace: 'nowrap' as const }}>
                  开始
                </button>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: COLOR.textFaint }}>将创建 {featurePrefix}{featureName || '...'} 并从 {developBranch} 切出</div>
            </div>
          )}
          {tab === 'release' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: COLOR.textMuted, marginBottom: 6 }}>开始新 Release</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inputBase, flex: 1 }} placeholder="v1.0.0" value={releaseVersion} onChange={e => setReleaseVersion(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} onKeyDown={e => e.key === 'Enter' && handleStartRelease()} />
                <button onClick={handleStartRelease} disabled={loading || !releaseVersion.trim()} style={{ padding: '7px 20px', fontSize: 13, fontWeight: 600, background: (loading || !releaseVersion.trim()) ? COLOR.btnBg : '#d29922', color: (loading || !releaseVersion.trim()) ? COLOR.textFaint : '#fff', border: 'none', borderRadius: 6, cursor: (loading || !releaseVersion.trim()) ? 'not-allowed' as const : 'pointer' as const, whiteSpace: 'nowrap' as const }}>
                  开始
                </button>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: COLOR.textFaint }}>将创建 {releasePrefix}{releaseVersion || '...'} 并从 {developBranch} 切出</div>
            </div>
          )}
          {tab === 'hotfix' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: COLOR.textMuted, marginBottom: 6 }}>开始新 Hotfix</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inputBase, flex: 1 }} placeholder="v1.0.1" value={hotfixVersion} onChange={e => setHotfixVersion(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} onKeyDown={e => e.key === 'Enter' && handleStartHotfix()} />
                <button onClick={handleStartHotfix} disabled={loading || !hotfixVersion.trim()} style={{ padding: '7px 20px', fontSize: 13, fontWeight: 600, background: (loading || !hotfixVersion.trim()) ? COLOR.btnBg : COLOR.danger, color: (loading || !hotfixVersion.trim()) ? COLOR.textFaint : '#fff', border: 'none', borderRadius: 6, cursor: (loading || !hotfixVersion.trim()) ? 'not-allowed' as const : 'pointer' as const, whiteSpace: 'nowrap' as const }}>
                  开始
                </button>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: COLOR.textFaint }}>将创建 {hotfixPrefix}{hotfixVersion || '...'} 并从 {masterBranch} 切出</div>
            </div>
          )}

          {/* 选项 */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLOR.textMuted, cursor: 'pointer' }}>
              <input type="checkbox" checked={squash} onChange={e => setSquash(e.target.checked)} style={{ accentColor: COLOR.accent }} /> Squash 合并
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLOR.textMuted, cursor: 'pointer' }}>
              <input type="checkbox" checked={deleteBranch} onChange={e => setDeleteBranch(e.target.checked)} style={{ accentColor: COLOR.accent }} /> 完成后删除分支
            </label>
            {(tab === 'release' || tab === 'hotfix') && (
              <div style={{ flex: 1 }}>
                <input style={{ ...inputBase, fontSize: 12, padding: '4px 8px' }} placeholder="标签消息" value={tagMessage} onChange={e => setTagMessage(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
            )}
          </div>

          {/* 活跃分支列表 */}
          <div style={{ background: COLOR.inputBg, borderRadius: 6, border: `1px solid ${COLOR.inputBorder}`, maxHeight: 200, overflowY: 'auto' }}>
            {tab === 'feature' && featureBranches.map(b => (
              <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: `1px solid ${COLOR.divider}` }}>
                <svg width="14" height="14" fill="none" stroke="#58a6ff" strokeWidth={2} viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span style={{ flex: 1, fontSize: 13, color: COLOR.text }}>{b.name}</span>
                {b.current && <span style={{ fontSize: 10, color: COLOR.accent, background: COLOR.accentDim, padding: '1px 6px', borderRadius: 3 }}>当前</span>}
                <button onClick={() => handleFinishFeature(b.name)} disabled={loading} style={{ padding: '3px 12px', fontSize: 11, background: COLOR.btnBg, color: '#58a6ff', border: `1px solid #58a6ff33`, borderRadius: 4, cursor: 'pointer' }}>
                  完成
                </button>
              </div>
            ))}
            {tab === 'release' && releaseBranches.map(b => (
              <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: `1px solid ${COLOR.divider}` }}>
                <svg width="14" height="14" fill="none" stroke="#d29922" strokeWidth={2} viewBox="0 0 24 24"><path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
                <span style={{ flex: 1, fontSize: 13, color: COLOR.text }}>{b.name}</span>
                {b.current && <span style={{ fontSize: 10, color: COLOR.accent, background: COLOR.accentDim, padding: '1px 6px', borderRadius: 3 }}>当前</span>}
                <button onClick={() => handleFinishRelease(b.name.replace(releasePrefix, ''))} disabled={loading} style={{ padding: '3px 12px', fontSize: 11, background: COLOR.btnBg, color: '#d29922', border: '1px solid #d2992233', borderRadius: 4, cursor: 'pointer' }}>
                  完成
                </button>
              </div>
            ))}
            {tab === 'hotfix' && hotfixBranches.map(b => (
              <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: `1px solid ${COLOR.divider}` }}>
                <svg width="14" height="14" fill="none" stroke={COLOR.danger} strokeWidth={2} viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span style={{ flex: 1, fontSize: 13, color: COLOR.text }}>{b.name}</span>
                {b.current && <span style={{ fontSize: 10, color: COLOR.accent, background: COLOR.accentDim, padding: '1px 6px', borderRadius: 3 }}>当前</span>}
                <button onClick={() => handleFinishHotfix(b.name.replace(hotfixPrefix, ''))} disabled={loading} style={{ padding: '3px 12px', fontSize: 11, background: COLOR.btnBg, color: COLOR.danger, border: `1px solid ${COLOR.dangerDim}`, borderRadius: 4, cursor: 'pointer' }}>
                  完成
                </button>
              </div>
            ))}
            {((tab === 'feature' && featureBranches.length === 0) || (tab === 'release' && releaseBranches.length === 0) || (tab === 'hotfix' && hotfixBranches.length === 0)) && (
              <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: COLOR.textFaint }}>无活跃分支</div>
            )}
          </div>

          {successMsg && <div style={{ fontSize: 12, color: COLOR.accent, marginTop: 12, padding: '8px 12px', background: COLOR.accentDim, borderRadius: 6 }}>✓ {successMsg}</div>}
          {error && <div style={{ fontSize: 12, color: COLOR.danger, marginTop: 12, padding: '8px 12px', background: COLOR.dangerDim, borderRadius: 6 }}>⚠ {error}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: `1px solid ${COLOR.divider}`, marginTop: 16 }}>
            <button onClick={onClose} style={{ padding: '7px 20px', fontSize: 13, fontWeight: 500, background: COLOR.btnBg, color: COLOR.textMuted, border: `1px solid ${COLOR.btnBorder}`, borderRadius: 6, cursor: 'pointer' }}>关闭</button>
          </div>
        </div>
      </div>
    </div>
  );
}
