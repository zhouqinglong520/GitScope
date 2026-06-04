/**
 * 提交对话框组件
 */

import React, { useState } from 'react';
import Button from '../common/Button';
import { zhCN } from '../../i18n/zh-CN';
import { useRepoStore } from '../../stores/repoStore';

interface CommitDialogProps {
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

function CommitDialog({ isOpen, onClose }: CommitDialogProps) {
  const i18n = zhCN;
  const { status, refresh } = useRepoStore();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // 没有暂存的文件时禁用提交
  const hasStaged = status && status.staged.length > 0;

  // 处理提交
  const handleCommit = async () => {
    if (!message.trim() || !hasStaged) return;

    setLoading(true);
    try {
      await window.electronAPI.git.commit(message.trim());
      setMessage('');
      await refresh();
      onClose();
    } catch (error) {
      console.error('提交失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] bg-panel-bg border border-panel-border rounded-lg shadow-xl z-50">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border">
          <h2 className="text-lg font-semibold">{i18n.commitDialog.title}</h2>
          <button
            onClick={onClose}
            className="btn-icon"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-4">
          {/* 暂存的文件 */}
          {hasStaged && (
            <div className="bg-[#1e1e1e] rounded p-3 max-h-32 overflow-auto">
              <div className="text-xs text-gray-400 mb-2">
                {status!.staged.length} 个文件已暂存
              </div>
              {status!.staged.map((file) => (
                <div key={file.path} className="text-sm py-0.5 truncate">
                  <span className="text-green-400 mr-2">+</span>
                  {file.path}
                </div>
              ))}
            </div>
          )}

          {/* 提交消息 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {i18n.commitDialog.message}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={i18n.commitDialog.messagePlaceholder}
              className="input w-full h-32 resize-none"
              autoFocus
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-panel-border">
          <Button variant="secondary" onClick={onClose}>
            {i18n.commitDialog.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={handleCommit}
            loading={loading}
            disabled={!message.trim() || !hasStaged}
          >
            {i18n.commitDialog.commit}
          </Button>
        </div>
      </div>
    </>
  );
}

export default CommitDialog;
