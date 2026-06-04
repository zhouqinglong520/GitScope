/**
 * 冲突解决面板
 * 在 merge/rebase/cherry-pick 产生冲突后显示
 * 支持 Use Mine/Use Theirs/批量解决/继续/中止
 */

import React, { useState, useEffect, useCallback } from 'react';
import { zhCN } from '../../i18n/zh-CN';

interface ConflictedFile {
  path: string;
  conflictCount: number;
}

interface ConflictResolutionPanelProps {
  /** 是否显示面板 */
  isOpen: boolean;
  /** 冲突操作类型 */
  operationType: 'merge' | 'rebase' | 'cherrypick';
  /** 关闭面板回调 */
  onClose: () => void;
  /** 操作完成后刷新 */
  onRefresh: () => void;
}

function ConflictResolutionPanel({
  isOpen,
  operationType,
  onClose,
  onRefresh,
}: ConflictResolutionPanelProps) {
  const i18n = zhCN;
  const [conflictedFiles, setConflictedFiles] = useState<ConflictedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resolvingFile, setResolvingFile] = useState<string | null>(null);

  // 加载冲突文件列表
  const loadConflicts = useCallback(async () => {
    setIsLoading(true);
    try {
      const files = await window.electronAPI.git.getConflictedFiles();
      setConflictedFiles(files);
    } catch (error) {
      console.error('加载冲突文件失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadConflicts();
    }
  }, [isOpen, loadConflicts]);

  // Use Mine
  const handleUseMine = useCallback(async (filePath: string) => {
    setResolvingFile(filePath);
    try {
      await window.electronAPI.git.resolveConflictUseOurs(filePath);
      await loadConflicts();
      onRefresh();
    } catch (error) {
      console.error('解决冲突失败:', error);
    } finally {
      setResolvingFile(null);
    }
  }, [loadConflicts, onRefresh]);

  // Use Theirs
  const handleUseTheirs = useCallback(async (filePath: string) => {
    setResolvingFile(filePath);
    try {
      await window.electronAPI.git.resolveConflictUseTheirs(filePath);
      await loadConflicts();
      onRefresh();
    } catch (error) {
      console.error('解决冲突失败:', error);
    } finally {
      setResolvingFile(null);
    }
  }, [loadConflicts, onRefresh]);

  // 批量解决
  const handleResolveAll = useCallback(async (strategy: 'ours' | 'theirs') => {
    const confirmMsg = strategy === 'ours'
      ? i18n.conflictResolve.useMineAllConfirm
      : i18n.conflictResolve.useTheirsAllConfirm;

    if (!window.confirm(confirmMsg)) return;

    setIsLoading(true);
    try {
      await window.electronAPI.git.resolveAllConflicts(strategy);
      await loadConflicts();
      onRefresh();
    } catch (error) {
      console.error('批量解决冲突失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadConflicts, onRefresh]);

  // 继续操作
  const handleContinue = useCallback(async () => {
    setIsLoading(true);
    try {
      if (operationType === 'merge') {
        await window.electronAPI.git.continueMerge();
      } else if (operationType === 'rebase') {
        await window.electronAPI.git.continueRebase();
      } else {
        await window.electronAPI.git.continueCherryPick();
      }
      onClose();
      onRefresh();
    } catch (error) {
      console.error('继续操作失败:', error);
      alert('操作失败，请确保所有冲突已解决');
    } finally {
      setIsLoading(false);
    }
  }, [operationType, onClose, onRefresh]);

  // 中止操作
  const handleAbort = useCallback(async () => {
    if (!window.confirm(i18n.conflictResolve.abortConfirm)) return;

    setIsLoading(true);
    try {
      if (operationType === 'merge') {
        await window.electronAPI.git.abortMerge();
      } else if (operationType === 'rebase') {
        await window.electronAPI.git.abortRebase();
      } else {
        await window.electronAPI.git.abortCherryPick();
      }
      onClose();
      onRefresh();
    } catch (error) {
      console.error('中止操作失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [operationType, onClose, onRefresh]);

  if (!isOpen) return null;

  const allResolved = conflictedFiles.length === 0;
  const continueLabel = operationType === 'merge'
    ? i18n.conflictResolve.continueMerge
    : operationType === 'rebase'
      ? i18n.conflictResolve.continueRebase
      : i18n.conflictResolve.continueCherryPick;
  const abortLabel = operationType === 'merge'
    ? i18n.conflictResolve.abortMerge
    : operationType === 'rebase'
      ? i18n.conflictResolve.abortRebase
      : i18n.conflictResolve.abortCherryPick;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#1e1e1e] border-t-2 border-orange-500 z-50 max-h-[50vh] flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-orange-500/10 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="font-medium text-orange-400">{i18n.conflictResolve.title}</span>
          {!allResolved && (
            <span className="text-xs text-orange-300 bg-orange-500/20 px-2 py-0.5 rounded">
              {conflictedFiles.length} {i18n.conflictResolve.conflictsRemaining}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 操作按钮栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#3c3c3c]">
        {!allResolved && (
          <>
            <button
              onClick={() => handleResolveAll('ours')}
              disabled={isLoading}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {i18n.conflictResolve.useMineAll}
            </button>
            <button
              onClick={() => handleResolveAll('theirs')}
              disabled={isLoading}
              className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {i18n.conflictResolve.useTheirsAll}
            </button>
            <div className="h-4 w-px bg-[#3c3c3c]" />
          </>
        )}
        {allResolved && (
          <span className="text-xs text-green-400 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {i18n.conflictResolve.allResolved}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={handleAbort}
          disabled={isLoading}
          className="px-3 py-1 text-xs bg-red-600/80 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          {abortLabel}
        </button>
        <button
          onClick={handleContinue}
          disabled={isLoading || !allResolved}
          className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {continueLabel}
        </button>
      </div>

      {/* 冲突文件列表 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && conflictedFiles.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">{i18n.common.loading}</div>
        ) : (
          conflictedFiles.map((file) => (
            <div
              key={file.path}
              className="flex items-center gap-3 px-4 py-2 border-b border-[#3c3c3c] hover:bg-[#2d2d30]"
            >
              {/* 文件信息 */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{file.path}</div>
                <div className="text-xs text-orange-400">
                  {i18n.conflictResolve.conflictCount.replace('{count}', String(file.conflictCount))}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleUseMine(file.path)}
                  disabled={resolvingFile === file.path}
                  className="px-2 py-1 text-xs bg-blue-600/80 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {i18n.conflictResolve.useMine}
                </button>
                <button
                  onClick={() => handleUseTheirs(file.path)}
                  disabled={resolvingFile === file.path}
                  className="px-2 py-1 text-xs bg-purple-600/80 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  {i18n.conflictResolve.useTheirs}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ConflictResolutionPanel;
