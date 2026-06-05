/**
 * Push/Pull 操作对话框
 * 支持 Force Push、Force with Lease、Set Upstream、Rebase 等选项
 */

import React, { useState, useEffect } from 'react';
import { zhCN } from '../../i18n/zh-CN';

interface PushOptions {
  force?: boolean;
  forceWithLease?: boolean;
  setUpstream?: boolean;
}

interface PullOptions {
  rebase?: boolean;
}

interface FetchOptions {
  prune?: boolean;
}

interface PushDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPush: (options: PushOptions) => Promise<void>;
  remote?: string;
  branch?: string;
  hasUpstream: boolean;
  i18n: typeof zhCN;
}

interface PullDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPull: (options: PullOptions) => Promise<void>;
  i18n: typeof zhCN;
}

interface FetchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFetch: (options: FetchOptions & { fetchAll?: boolean }) => Promise<void>;
  i18n: typeof zhCN;
}

// ========== Push 对话框 ==========
export function PushDialog({ isOpen, onClose, onPush, remote = 'origin', branch, hasUpstream, i18n }: PushDialogProps) {
  const [forceMode, setForceMode] = useState<'none' | 'force' | 'forceWithLease'>('none');
  const [setUpstream, setSetUpstream] = useState(!hasUpstream);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  const handlePush = async () => {
    if (forceMode !== 'none') {
      setShowConfirm(true);
      return;
    }
    await doPush();
  };

  const doPush = async () => {
    setIsPushing(true);
    try {
      await onPush({
        force: forceMode === 'force',
        forceWithLease: forceMode === 'forceWithLease',
        setUpstream,
      });
      onClose();
    } catch (error) {
      console.error('Push failed:', error);
    } finally {
      setIsPushing(false);
      setShowConfirm(false);
    }
  };

  if (!isOpen) return null;

  if (showConfirm) {
    const isForceWithLease = forceMode === 'forceWithLease';
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#252526] rounded-lg shadow-xl border border-[#3c3c3c] w-[450px]">
          <div className="px-4 py-3 border-b border-[#3c3c3c]">
            <h3 className="text-sm font-medium text-white">
              {isForceWithLease ? i18n.confirm.forceWithLease : i18n.confirm.forcePush}
            </h3>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-300 whitespace-pre-line">
              {isForceWithLease ? i18n.confirm.forceWithLeaseMessage : i18n.confirm.forcePushMessage}
            </p>
          </div>
          <div className="px-4 py-3 border-t border-[#3c3c3c] flex justify-end gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-[#3c3c3c] rounded transition-colors"
            >
              {i18n.confirm.cancel}
            </button>
            <button
              onClick={doPush}
              disabled={isPushing}
              className="px-4 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              {isPushing ? '...' : (isForceWithLease ? i18n.confirm.useForceWithLeaseAnyway : i18n.confirm.useForceAnyway)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg shadow-xl border border-[#3c3c3c] w-[400px]">
        <div className="px-4 py-3 border-b border-[#3c3c3c]">
          <h3 className="text-sm font-medium text-white">{i18n.toolbar.push}</h3>
        </div>
        <div className="p-4 space-y-4">
          {/* 目标信息 */}
          <div className="text-sm text-gray-400">
            推送到: <span className="text-white">{remote}</span>
            {branch && <span className="text-gray-500">/{branch}</span>}
          </div>

          {/* 设置上游 */}
          {!hasUpstream && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={setUpstream}
                onChange={(e) => setSetUpstream(e.target.checked)}
                className="w-4 h-4 rounded border-gray-500 bg-[#1e1e1e] text-primary-500 focus:ring-primary-500"
              />
              <div>
                <div className="text-sm text-white">{i18n.pushPreferences.setUpstream}</div>
                <div className="text-xs text-gray-500">{i18n.pushPreferences.setUpstreamDesc}</div>
              </div>
            </label>
          )}

          {/* Force Push 选项 */}
          <div className="space-y-2">
            <div className="text-xs text-gray-400 uppercase">Push Mode</div>
            
            <label className="flex items-center gap-3 cursor-pointer hover:bg-[#3c3c3c] rounded p-2 -mx-2 transition-colors">
              <input
                type="radio"
                name="forceMode"
                checked={forceMode === 'none'}
                onChange={() => setForceMode('none')}
                className="w-4 h-4 border-gray-500 bg-[#1e1e1e] text-primary-500"
              />
              <div>
                <div className="text-sm text-white">Normal Push</div>
                <div className="text-xs text-gray-500">Safe push</div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer hover:bg-[#3c3c3c] rounded p-2 -mx-2 transition-colors">
              <input
                type="radio"
                name="forceMode"
                checked={forceMode === 'forceWithLease'}
                onChange={() => setForceMode('forceWithLease')}
                className="w-4 h-4 border-gray-500 bg-[#1e1e1e] text-orange-500"
              />
              <div>
                <div className="text-sm text-orange-400">{i18n.pushPreferences.forceWithLease}</div>
                <div className="text-xs text-gray-500">{i18n.pushPreferences.forceWithLeaseDesc}</div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer hover:bg-[#3c3c3c] rounded p-2 -mx-2 transition-colors">
              <input
                type="radio"
                name="forceMode"
                checked={forceMode === 'force'}
                onChange={() => setForceMode('force')}
                className="w-4 h-4 border-gray-500 bg-[#1e1e1e] text-red-500"
              />
              <div>
                <div className="text-sm text-red-400">{i18n.pushPreferences.force}</div>
                <div className="text-xs text-gray-500">{i18n.pushPreferences.forceDesc}</div>
              </div>
            </label>
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
            onClick={handlePush}
            disabled={isPushing}
            className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-500 disabled:opacity-50 transition-colors"
          >
            {isPushing ? '...' : i18n.toolbar.push}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== Pull 对话框 ==========
export function PullDialog({ isOpen, onClose, onPull, i18n }: PullDialogProps) {
  const [rebase, setRebase] = useState(() => {
    return localStorage.getItem('gitgui-pull-rebase') === 'true';
  });
  const [isPulling, setIsPulling] = useState(false);

  const handlePull = async () => {
    setIsPulling(true);
    try {
      await onPull({ rebase });
      localStorage.setItem('gitgui-pull-rebase', String(rebase));
      onClose();
    } catch (error) {
      console.error('Pull failed:', error);
    } finally {
      setIsPulling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg shadow-xl border border-[#3c3c3c] w-[400px]">
        <div className="px-4 py-3 border-b border-[#3c3c3c]">
          <h3 className="text-sm font-medium text-white">{i18n.toolbar.pull}</h3>
        </div>
        <div className="p-4 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={rebase}
              onChange={(e) => setRebase(e.target.checked)}
              className="w-4 h-4 rounded border-gray-500 bg-[#1e1e1e] text-primary-500 focus:ring-primary-500"
            />
            <div>
              <div className="text-sm text-white">{i18n.pullPreferences.rebase}</div>
              <div className="text-xs text-gray-500">{i18n.pullPreferences.rebaseDesc}</div>
            </div>
          </label>
        </div>
        <div className="px-4 py-3 border-t border-[#3c3c3c] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {i18n.common.cancel}
          </button>
          <button
            onClick={handlePull}
            disabled={isPulling}
            className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-500 disabled:opacity-50 transition-colors"
          >
            {isPulling ? '...' : i18n.toolbar.pull}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== Fetch 对话框 ==========
export function FetchDialog({ isOpen, onClose, onFetch, i18n }: FetchDialogProps) {
  const [prune, setPrune] = useState(() => {
    return localStorage.getItem('gitgui-fetch-prune') === 'true';
  });
  const [fetchAll, setFetchAll] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const handleFetch = async () => {
    setIsFetching(true);
    try {
      await onFetch({ prune, fetchAll });
      localStorage.setItem('gitgui-fetch-prune', String(prune));
      onClose();
    } catch (error) {
      console.error('Fetch failed:', error);
    } finally {
      setIsFetching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg shadow-xl border border-[#3c3c3c] w-[400px]">
        <div className="px-4 py-3 border-b border-[#3c3c3c]">
          <h3 className="text-sm font-medium text-white">{i18n.toolbar.fetch}</h3>
        </div>
        <div className="p-4 space-y-4">
          {/* Fetch 目标 */}
          <div className="space-y-2">
            <div className="text-xs text-gray-400 uppercase">Target</div>
            
            <label className="flex items-center gap-3 cursor-pointer hover:bg-[#3c3c3c] rounded p-2 -mx-2 transition-colors">
              <input
                type="radio"
                name="fetchTarget"
                checked={!fetchAll}
                onChange={() => setFetchAll(false)}
                className="w-4 h-4 border-gray-500 bg-[#1e1e1e] text-primary-500"
              />
              <div className="text-sm text-white">{i18n.fetchMenu.fetchOrigin}</div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer hover:bg-[#3c3c3c] rounded p-2 -mx-2 transition-colors">
              <input
                type="radio"
                name="fetchTarget"
                checked={fetchAll}
                onChange={() => setFetchAll(true)}
                className="w-4 h-4 border-gray-500 bg-[#1e1e1e] text-primary-500"
              />
              <div className="text-sm text-white">{i18n.fetchMenu.fetchAll}</div>
            </label>
          </div>

          {/* Prune 选项 */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prune}
              onChange={(e) => setPrune(e.target.checked)}
              className="w-4 h-4 rounded border-gray-500 bg-[#1e1e1e] text-primary-500 focus:ring-primary-500"
            />
            <div>
              <div className="text-sm text-white">{i18n.fetchPreferences.prune}</div>
              <div className="text-xs text-gray-500">{i18n.fetchPreferences.pruneDesc}</div>
            </div>
          </label>
        </div>
        <div className="px-4 py-3 border-t border-[#3c3c3c] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {i18n.common.cancel}
          </button>
          <button
            onClick={handleFetch}
            disabled={isFetching}
            className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-500 disabled:opacity-50 transition-colors"
          >
            {isFetching ? '...' : i18n.toolbar.fetch}
          </button>
        </div>
      </div>
    </div>
  );
}

export default { PushDialog, PullDialog, FetchDialog };
