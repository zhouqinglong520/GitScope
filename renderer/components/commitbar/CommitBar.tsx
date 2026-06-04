/**
 * 底部常驻提交栏组件
 * 提交消息输入 + Commit 按钮 + Amend 复选框
 */

import React, { useState, useRef, useEffect } from 'react';
import { zhCN } from '../../i18n/zh-CN';

interface CommitBarProps {
  /** 是否有暂存的更改 */
  hasStaged: boolean;
  /** 提交回调 */
  onCommit: (message: string, amend: boolean) => Promise<void>;
  /** 是否正在提交 */
  isCommitting?: boolean;
  /** 暂存的更改数量 */
  stagedCount?: number;
}

function CommitBar({ hasStaged, onCommit, isCommitting = false, stagedCount = 0 }: CommitBarProps) {
  const i18n = zhCN;
  const [message, setMessage] = useState('');
  const [amend, setAmend] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整文本框高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [message]);

  // 处理提交
  const handleCommit = async () => {
    if (!message.trim() || !hasStaged) return;

    try {
      await onCommit(message.trim(), amend);
      setMessage('');
      setAmend(false);
    } catch (error) {
      console.error('提交失败:', error);
    }
  };

  // 处理键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter 提交
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    }

    // Shift+Enter 换行（阻止默认行为）
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = message.substring(0, start) + '\n' + message.substring(end);
        setMessage(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1;
        }, 0);
      }
    }
  };

  const canCommit = message.trim().length > 0 && hasStaged && !isCommitting;

  return (
    <div className="bg-[#252526] border-t border-[#3c3c3c]">
      {/* 暂存统计 */}
      {hasStaged && (
        <div className="px-4 py-1.5 text-xs text-gray-400 bg-[#1e1e1e] border-b border-[#3c3c3c]">
          <span className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {stagedCount} 个文件已暂存
          </span>
        </div>
      )}

      {/* 输入区域 */}
      <div className="flex items-stretch">
        {/* 提交消息输入 */}
        <div className="flex-1 px-4 py-3">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasStaged ? i18n.commitDialog.messagePlaceholder : '先暂存文件才能提交...'}
            disabled={!hasStaged}
            className={`
              w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-white
              placeholder:text-gray-500 resize-none outline-none
              focus:border-primary-500 focus:ring-1 focus:ring-primary-500
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            rows={2}
            style={{ minHeight: '60px', maxHeight: '120px' }}
          />
        </div>

        {/* 右侧操作区 */}
        <div className="flex flex-col items-end justify-between p-3 border-l border-[#3c3c3c]">
          {/* Amend 复选框 */}
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-white">
            <input
              type="checkbox"
              checked={amend}
              onChange={(e) => setAmend(e.target.checked)}
              disabled={!hasStaged}
              className="w-3.5 h-3.5 rounded border-[#3c3c3c] bg-[#3c3c3c] text-primary-500 focus:ring-primary-500 focus:ring-offset-0 disabled:opacity-50"
            />
            <span>{i18n.commitDialog.amend}</span>
          </label>

          {/* 提交按钮 */}
          <button
            onClick={handleCommit}
            disabled={!canCommit}
            className={`
              mt-2 px-4 py-1.5 rounded text-sm font-medium transition-colors
              ${canCommit
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-[#3c3c3c] text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {isCommitting ? (
              <span className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {i18n.common.loading}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {i18n.toolbar.commit}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 快捷键提示 */}
      <div className="px-4 py-1.5 text-xs text-gray-500 border-t border-[#3c3c3c]">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-[#3c3c3c] rounded">Ctrl</kbd>
            <kbd className="px-1.5 py-0.5 bg-[#3c3c3c] rounded">Enter</kbd>
            提交
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-[#3c3c3c] rounded">Shift</kbd>
            <kbd className="px-1.5 py-0.5 bg-[#3c3c3c] rounded">Enter</kbd>
            换行
          </span>
        </span>
      </div>
    </div>
  );
}

export default CommitBar;
