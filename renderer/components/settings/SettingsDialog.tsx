/**
 * 偏好设置对话框
 * 通用/外观/Git/通知四大分类设置
 */
import React, { useState, useEffect } from 'react';
import './SettingsDialog.css';

interface AppPreferences {
  general: { defaultCloneDir: string; language: string; checkUpdateOnStart: boolean; minimizeToTray: boolean; autoFetchInterval: number; };
  appearance: { theme: string; fontSize: number; tabWidth: number; showWhitespace: boolean; colorBlindMode: boolean; commitGraphStyle: string; };
  git: { mergeStrategy: string; pullRebase: boolean; pushAutoSetUpstream: boolean; autoPushAfterCommit: boolean; gpgSign: boolean; commitTemplatePath: string; externalDiffTool: string; externalMergeTool: string; };
  notifications: { showOnComplete: boolean; showOnConflict: boolean; soundEnabled: boolean; };
}

type TabKey = 'general' | 'appearance' | 'git' | 'notifications';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'general', label: '通用' },
  { key: 'appearance', label: '外观' },
  { key: 'git', label: 'Git' },
  { key: 'notifications', label: '通知' },
];

const defaultPrefs: AppPreferences = {
  general: { defaultCloneDir: '', language: 'zh-CN', checkUpdateOnStart: true, minimizeToTray: false, autoFetchInterval: 0 },
  appearance: { theme: 'dark', fontSize: 14, tabWidth: 4, showWhitespace: false, colorBlindMode: false, commitGraphStyle: 'curved' },
  git: { mergeStrategy: 'merge', pullRebase: false, pushAutoSetUpstream: true, autoPushAfterCommit: false, gpgSign: false, commitTemplatePath: '', externalDiffTool: '', externalMergeTool: '' },
  notifications: { showOnComplete: true, showOnConflict: true, soundEnabled: false },
};

interface Props { visible: boolean; onClose: () => void; }

export const SettingsDialog: React.FC<Props> = ({ visible, onClose }) => {
  const [prefs, setPrefs] = useState<AppPreferences>(defaultPrefs);
  const [tab, setTab] = useState<TabKey>('general');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      window.electronAPI.git.getPreferences().then(p => {
        setPrefs({ ...defaultPrefs, ...p });
      }).catch(() => {});
    }
  }, [visible]);

  const updatePref = (section: keyof AppPreferences, key: string, value: any) => {
    setPrefs(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.electronAPI.git.savePreferences(prefs as any);
      onClose();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  if (!visible) return null;

  const renderSection = () => {
    switch (tab) {
      case 'general': return (
        <div className="settings-section">
          <label>语言<select value={prefs.general.language} onChange={e => updatePref('general', 'language', e.target.value)}>
            <option value="zh-CN">中文</option><option value="en-US">English</option>
          </select></label>
          <label>默认克隆目录<input value={prefs.general.defaultCloneDir} onChange={e => updatePref('general', 'defaultCloneDir', e.target.value)} /></label>
          <label>自动 Fetch 间隔（分钟，0=禁用）<input type="number" value={prefs.general.autoFetchInterval} onChange={e => updatePref('general', 'autoFetchInterval', parseInt(e.target.value) || 0)} /></label>
          <label><input type="checkbox" checked={prefs.general.checkUpdateOnStart} onChange={e => updatePref('general', 'checkUpdateOnStart', e.target.checked)} />启动时检查更新</label>
          <label><input type="checkbox" checked={prefs.general.minimizeToTray} onChange={e => updatePref('general', 'minimizeToTray', e.target.checked)} />最小化到系统托盘</label>
        </div>
      );
      case 'appearance': return (
        <div className="settings-section">
          <label>主题<select value={prefs.appearance.theme} onChange={e => updatePref('appearance', 'theme', e.target.value)}>
            <option value="dark">深色</option><option value="light">浅色</option><option value="system">跟随系统</option>
          </select></label>
          <label>字体大小<input type="number" value={prefs.appearance.fontSize} onChange={e => updatePref('appearance', 'fontSize', parseInt(e.target.value) || 14)} /></label>
          <label>Tab 宽度<input type="number" value={prefs.appearance.tabWidth} onChange={e => updatePref('appearance', 'tabWidth', parseInt(e.target.value) || 4)} /></label>
          <label><input type="checkbox" checked={prefs.appearance.showWhitespace} onChange={e => updatePref('appearance', 'showWhitespace', e.target.checked)} />显示空白字符</label>
          <label><input type="checkbox" checked={prefs.appearance.colorBlindMode} onChange={e => updatePref('appearance', 'colorBlindMode', e.target.checked)} />色盲模式</label>
          <label>提交图样式<select value={prefs.appearance.commitGraphStyle} onChange={e => updatePref('appearance', 'commitGraphStyle', e.target.value)}>
            <option value="curved">曲线</option><option value="straight">直线</option>
          </select></label>
        </div>
      );
      case 'git': return (
        <div className="settings-section">
          <label>默认合并策略<select value={prefs.git.mergeStrategy} onChange={e => updatePref('git', 'mergeStrategy', e.target.value)}>
            <option value="merge">Merge</option><option value="rebase">Rebase</option><option value="squash">Squash</option>
          </select></label>
          <label><input type="checkbox" checked={prefs.git.pullRebase} onChange={e => updatePref('git', 'pullRebase', e.target.checked)} />Pull 默认使用 Rebase</label>
          <label><input type="checkbox" checked={prefs.git.pushAutoSetUpstream} onChange={e => updatePref('git', 'pushAutoSetUpstream', e.target.checked)} />推送自动设置上游</label>
          <label><input type="checkbox" checked={prefs.git.autoPushAfterCommit} onChange={e => updatePref('git', 'autoPushAfterCommit', e.target.checked)} />提交后自动推送</label>
          <label><input type="checkbox" checked={prefs.git.gpgSign} onChange={e => updatePref('git', 'gpgSign', e.target.checked)} />GPG 签名</label>
          <label>外部 Diff 工具<input value={prefs.git.externalDiffTool} onChange={e => updatePref('git', 'externalDiffTool', e.target.value)} /></label>
          <label>外部合并工具<input value={prefs.git.externalMergeTool} onChange={e => updatePref('git', 'externalMergeTool', e.target.value)} /></label>
        </div>
      );
      case 'notifications': return (
        <div className="settings-section">
          <label><input type="checkbox" checked={prefs.notifications.showOnComplete} onChange={e => updatePref('notifications', 'showOnComplete', e.target.checked)} />操作完成通知</label>
          <label><input type="checkbox" checked={prefs.notifications.showOnConflict} onChange={e => updatePref('notifications', 'showOnConflict', e.target.checked)} />冲突通知</label>
          <label><input type="checkbox" checked={prefs.notifications.soundEnabled} onChange={e => updatePref('notifications', 'soundEnabled', e.target.checked)} />通知声音</label>
        </div>
      );
    }
  };

  return (
    <div className="settings-overlay">
      <div className="settings-dialog">
        <div className="settings-header">
          <h3>偏好设置</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="settings-body">
          <div className="settings-sidebar">
            {TABS.map(t => (
              <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>
          <div className="settings-content">{renderSection()}</div>
        </div>
        <div className="settings-footer">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-save" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>
    </div>
  );
};
export default SettingsDialog;
