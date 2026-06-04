/**
 * 远程仓库管理组件
 * 显示所有远程仓库，支持添加/编辑/删除
 */

import React, { useState, useEffect } from 'react';
import { useRepoStore } from '../../stores/repoStore';
import { zhCN } from '../../i18n/zh-CN';

interface RemotesSectionProps {
  onRemoteChange?: () => void;
}

export function RemotesSection({ onRemoteChange }: RemotesSectionProps) {
  const { currentRepo } = useRepoStore();
  const i18n = zhCN;

  const [remotes, setRemotes] = useState<Array<{ name: string; url: string }>>([]);
  const [expandedRemotes, setExpandedRemotes] = useState<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRemote, setEditingRemote] = useState<{ name: string; url: string } | null>(null);
  const [remoteBranches, setRemoteBranches] = useState<Record<string, string[]>>({});

  // 加载远程仓库列表
  const loadRemotes = async () => {
    if (!currentRepo) return;
    try {
      const remoteList = await window.electronAPI.git.getRemotes();
      setRemotes(remoteList.map(r => ({ name: r.name, url: r.url })));
    } catch (error) {
      console.error('Failed to load remotes:', error);
    }
  };

  useEffect(() => {
    loadRemotes();
  }, [currentRepo]);

  // 加载指定远程的分支
  const loadRemoteBranches = async (remoteName: string) => {
    try {
      const branches = await window.electronAPI.git.getBranches();
      const remoteBranchesList = branches
        .filter(b => b.remote === remoteName)
        .map(b => b.name.replace(/^[^/]+\//, ''));
      setRemoteBranches(prev => ({ ...prev, [remoteName]: remoteBranchesList }));
    } catch (error) {
      console.error('Failed to load remote branches:', error);
    }
  };

  // 切换远程展开状态
  const toggleRemote = async (remoteName: string) => {
    const newExpanded = new Set(expandedRemotes);
    if (newExpanded.has(remoteName)) {
      newExpanded.delete(remoteName);
    } else {
      newExpanded.add(remoteName);
      if (!remoteBranches[remoteName]) {
        await loadRemoteBranches(remoteName);
      }
    }
    setExpandedRemotes(newExpanded);
  };

  // 添加远程
  const handleAddRemote = async (name: string, url: string) => {
    try {
      await window.electronAPI.git.addRemote(name, url);
      await loadRemotes();
      setShowAddDialog(false);
      onRemoteChange?.();
    } catch (error) {
      console.error('Failed to add remote:', error);
    }
  };

  // 编辑远程
  const handleEditRemote = async (name: string, url: string) => {
    try {
      await window.electronAPI.git.setRemoteUrl(name, url);
      await loadRemotes();
      setEditingRemote(null);
      onRemoteChange?.();
    } catch (error) {
      console.error('Failed to edit remote:', error);
    }
  };

  // 删除远程
  const handleDeleteRemote = async (name: string) => {
    if (!confirm(i18n.remote.confirmDelete.replace('{name}', name))) {
      return;
    }
    try {
      await window.electronAPI.git.removeRemote(name);
      await loadRemotes();
      onRemoteChange?.();
    } catch (error) {
      console.error('Failed to delete remote:', error);
    }
  };

  // 验证 URL 格式
  const isValidUrl = (url: string): boolean => {
    // HTTPS URL
    const httpsRegex = /^https?:\/\/.+/;
    // SSH URL
    const sshRegex = /^[\w-]+@[\w.-]+:.+$/;
    // Git protocol
    const gitRegex = /^git:\/\/.+/;
    return httpsRegex.test(url) || sshRegex.test(url) || gitRegex.test(url);
  };

  return (
    <div className="py-1">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-xs font-medium text-gray-400">{i18n.remote.title}</span>
        <button
          onClick={() => setShowAddDialog(true)}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-sidebar-hover text-gray-400 hover:text-white transition-colors"
          title={i18n.remote.add}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* 远程列表 */}
      {remotes.length === 0 ? (
        <div className="px-3 py-2 text-xs text-gray-500">
          {i18n.statusBar.noRemote}
        </div>
      ) : (
        remotes.map(remote => (
          <div key={remote.name}>
            {/* 远程项 */}
            <div
              className="flex items-center gap-1 px-3 py-1 hover:bg-sidebar-hover cursor-pointer group"
              onClick={() => toggleRemote(remote.name)}
            >
              {/* 展开箭头 */}
              <svg
                className={`w-3 h-3 text-gray-500 transition-transform ${expandedRemotes.has(remote.name) ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>

              {/* 远程图标 */}
              <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>

              {/* 名称 */}
              <span className="flex-1 text-sm text-gray-300 truncate">{remote.name}</span>

              {/* 操作按钮 */}
              <div className="hidden group-hover:flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingRemote(remote); }}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-gray-500 hover:text-white"
                  title={i18n.remote.edit}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteRemote(remote.name); }}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-600/30 text-gray-500 hover:text-red-400"
                  title={i18n.remote.delete}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 展开显示 URL 和分支 */}
            {expandedRemotes.has(remote.name) && (
              <div className="ml-6 pl-3 border-l border-[#3c3c3c]">
                {/* URL */}
                <div className="px-3 py-1 text-xs text-gray-500 truncate" title={remote.url}>
                  {remote.url}
                </div>
                {/* 分支列表 */}
                {remoteBranches[remote.name]?.map(branch => (
                  <div
                    key={branch}
                    className="flex items-center gap-2 px-3 py-0.5 text-xs text-gray-400 hover:text-white cursor-pointer hover:bg-sidebar-hover rounded"
                    onClick={() => window.electronAPI.git.checkout(`remotes/${remote.name}/${branch}`)}
                  >
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

      {/* 添加远程对话框 */}
      {showAddDialog && (
        <RemoteDialog
          title={i18n.remote.add}
          onSave={handleAddRemote}
          onClose={() => setShowAddDialog(false)}
          isValidUrl={isValidUrl}
          i18n={i18n}
        />
      )}

      {/* 编辑远程对话框 */}
      {editingRemote && (
        <RemoteDialog
          title={i18n.remote.edit}
          initialName={editingRemote.name}
          initialUrl={editingRemote.url}
          onSave={handleEditRemote}
          onClose={() => setEditingRemote(null)}
          isValidUrl={isValidUrl}
          i18n={i18n}
        />
      )}
    </div>
  );
}

// 远程仓库对话框组件
interface RemoteDialogProps {
  title: string;
  initialName?: string;
  initialUrl?: string;
  onSave: (name: string, url: string) => void;
  onClose: () => void;
  isValidUrl: (url: string) => boolean;
  i18n: typeof zhCN;
}

function RemoteDialog({ title, initialName = '', initialUrl = '', onSave, onClose, isValidUrl, i18n }: RemoteDialogProps) {
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(initialUrl);
  const [urlError, setUrlError] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    if (!isValidUrl(url)) {
      setUrlError(i18n.remote.invalidUrl);
      return;
    }
    onSave(name.trim(), url.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg shadow-xl border border-[#3c3c3c] w-[400px]">
        <div className="px-4 py-3 border-b border-[#3c3c3c]">
          <h3 className="text-sm font-medium text-white">{title}</h3>
        </div>
        <div className="p-4 space-y-4">
          {/* 名称 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">{i18n.remote.name}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={i18n.remote.namePlaceholder}
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-primary-500"
            />
          </div>
          {/* URL */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">{i18n.remote.url}</label>
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(''); }}
              placeholder={i18n.remote.urlPlaceholder}
              className={`w-full bg-[#1e1e1e] border rounded px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-primary-500 ${urlError ? 'border-red-500' : 'border-[#3c3c3c]'}`}
            />
            {urlError && <p className="text-xs text-red-400 mt-1">{urlError}</p>}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-[#3c3c3c] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {i18n.common.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !url.trim()}
            className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {i18n.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RemotesSection;
