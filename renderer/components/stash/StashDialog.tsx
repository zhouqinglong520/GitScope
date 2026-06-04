/**
 * Stash 创建对话框组件
 * 支持 includeUntracked 和 keepIndex 选项
 */

import React, { useState } from 'react';
import { zhCN } from '../../i18n/zh-CN';

interface StashDialogProps {
  /** 是否显示对话框 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 成功回调 */
  onSuccess?: () => void;
}

export default function StashDialog({ isOpen, onClose, onSuccess }: StashDialogProps) {
  const i18n = zhCN.stash;
  const t = zhCN.common;
  
  const [message, setMessage] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [keepIndex, setKeepIndex] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await window.electronAPI.git.stash({
        message: message.trim() || undefined,
        includeUntracked,
        keepIndex,
      });
      
      // 重置表单
      setMessage('');
      setIncludeUntracked(false);
      setKeepIndex(false);
      
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Stash failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMessage('');
    setIncludeUntracked(false);
    setKeepIndex(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-2xl w-[400px]">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c]">
          <h2 className="text-sm font-medium">{i18n.create}</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-[#3c3c3c] rounded"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Stash 消息 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {zhCN.commitDialog.message}
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={i18n.branchNamePlaceholder}
              className="w-full px-3 py-2 text-sm bg-[#1e1e1e] border border-[#3c3c3c] rounded outline-none focus:border-primary-500"
              autoFocus
            />
          </div>

          {/* 选项 */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeUntracked}
                onChange={(e) => setIncludeUntracked(e.target.checked)}
                className="w-4 h-4 rounded bg-[#1e1e1e] border border-[#3c3c3c] text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
              />
              <span className="text-sm">{i18n.includeUntracked}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={keepIndex}
                onChange={(e) => setKeepIndex(e.target.checked)}
                className="w-4 h-4 rounded bg-[#1e1e1e] border border-[#3c3c3c] text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
              />
              <span className="text-sm">{i18n.keepIndex}</span>
            </label>
          </div>

          {/* 按钮 */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-1.5 text-sm text-gray-300 hover:bg-[#3c3c3c] rounded transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t.loading : i18n.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
