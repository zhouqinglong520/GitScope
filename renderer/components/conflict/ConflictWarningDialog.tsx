/**
 * 冲突预判确认对话框
 * 在执行 merge/rebase/cherry-pick 前显示警告
 */

import React, { useState, useEffect } from 'react';
import { zhCN } from '../../i18n/zh-CN';

interface ConflictWarningDialogProps {
  /** 是否显示对话框 */
  isOpen: boolean;
  /** 冲突类型 */
  type: 'merge' | 'rebase' | 'cherrypick';
  /** 冲突文件列表 */
  conflictingFiles: string[];
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
}

function ConflictWarningDialog({
  isOpen,
  type,
  conflictingFiles,
  onConfirm,
  onCancel,
}: ConflictWarningDialogProps) {
  const i18n = zhCN;

  // 获取对应类型的标题
  const getTitle = () => {
    switch (type) {
      case 'merge':
        return i18n.conflict.mergeConflict;
      case 'rebase':
        return i18n.conflict.rebaseConflict;
      case 'cherrypick':
        return i18n.conflict.cherryPickConflict;
      default:
        return i18n.conflict.warningTitle;
    }
  };

  // 格式化消息
  const getMessage = () => {
    const count = conflictingFiles.length;
    return i18n.conflict.warningMessage.replace('{count}', count.toString());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* 对话框 */}
      <div className="relative bg-panel-bg border border-panel-border rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* 标题 */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-panel-border">
          <span className="text-2xl">⚠️</span>
          <h2 className="text-lg font-semibold text-gray-200">
            {i18n.conflict.warningTitle}
          </h2>
        </div>

        {/* 内容 */}
        <div className="px-6 py-4">
          <p className="text-gray-300 mb-4">
            {getMessage()}
          </p>

          {/* 冲突文件列表 */}
          {conflictingFiles.length > 0 && (
            <div className="bg-gray-800 rounded p-3 max-h-48 overflow-auto">
              <p className="text-sm text-gray-400 mb-2">
                {i18n.conflict.conflictingFiles}:
              </p>
              <ul className="space-y-1">
                {conflictingFiles.map((file, index) => (
                  <li 
                    key={index}
                    className="text-sm text-yellow-400 font-mono flex items-center gap-2"
                  >
                    <span className="text-red-400">⚡</span>
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 提示 */}
          <p className="text-sm text-gray-500 mt-4">
            {i18n.conflict.manualMerge}
          </p>
        </div>

        {/* 按钮 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-panel-border bg-gray-900/30">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            {i18n.conflict.cancel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm text-white bg-yellow-600 hover:bg-yellow-500 rounded transition-colors"
          >
            {i18n.conflict.continue}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 冲突检测 Hook
 * 用于在执行危险操作前进行冲突预检
 */
interface ConflictCheckOptions {
  /** 操作类型 */
  type: 'merge' | 'rebase' | 'cherrypick';
  /** 目标引用（分支名/upstream/oid） */
  ref: string;
}

interface UseConflictCheckResult {
  /** 是否正在检查 */
  isChecking: boolean;
  /** 是否有冲突 */
  hasConflict: boolean;
  /** 冲突文件列表 */
  conflictingFiles: string[];
  /** 是否已确认（用户点击继续） */
  isConfirmed: boolean;
  /** 错误信息 */
  error: string | null;
  /** 执行检查 */
  check: () => Promise<void>;
  /** 确认继续 */
  confirm: () => void;
  /** 取消 */
  cancel: () => void;
  /** 重置状态 */
  reset: () => void;
}

export function useConflictCheck(
  options: ConflictCheckOptions,
  onContinue: () => void
): UseConflictCheckResult {
  const [isChecking, setIsChecking] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictingFiles, setConflictingFiles] = useState<string[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setIsChecking(true);
    setError(null);

    try {
      let result: { hasConflict: boolean; conflictingFiles?: string[] };

      switch (options.type) {
        case 'merge':
          result = await window.electronAPI.git.checkMergeConflict(options.ref);
          break;
        case 'rebase':
          result = await window.electronAPI.git.checkRebaseConflict(options.ref);
          break;
        case 'cherrypick':
          result = await window.electronAPI.git.checkCherryPickConflict(options.ref);
          break;
        default:
          result = { hasConflict: false };
      }

      setHasConflict(result.hasConflict);
      setConflictingFiles(result.conflictingFiles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '检查冲突失败');
      setHasConflict(false);
      setConflictingFiles([]);
    } finally {
      setIsChecking(false);
    }
  };

  const confirm = () => {
    setIsConfirmed(true);
    onContinue();
  };

  const cancel = () => {
    setIsConfirmed(false);
    setHasConflict(false);
    setConflictingFiles([]);
  };

  const reset = () => {
    setIsChecking(false);
    setHasConflict(false);
    setConflictingFiles([]);
    setIsConfirmed(false);
    setError(null);
  };

  return {
    isChecking,
    hasConflict,
    conflictingFiles,
    isConfirmed,
    error,
    check,
    confirm,
    cancel,
    reset,
  };
}

export default ConflictWarningDialog;
