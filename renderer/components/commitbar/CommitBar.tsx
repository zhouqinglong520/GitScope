/**
 * 底部常驻提交栏组件
 * 提交消息输入 + Commit 按钮 + Amend/Sign/Co-author
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { zhCN } from '../../i18n/zh-CN';

interface CoAuthor {
  name: string;
  email: string;
}

interface CommitBarProps {
  /** 是否有暂存的更改 */
  hasStaged: boolean;
  /** 提交回调 */
  onCommit: (message: string, options?: { amend?: boolean; sign?: boolean }) => Promise<void>;
  /** 是否正在提交 */
  isCommitting?: boolean;
  /** 暂存的更改数量 */
  stagedCount?: number;
}

function CommitBar({ hasStaged, onCommit, isCommitting = false, stagedCount = 0 }: CommitBarProps) {
  const i18n = zhCN;
  const [message, setMessage] = useState('');
  const [amend, setAmend] = useState(false);
  const [sign, setSign] = useState(false);
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([]);
  const [coAuthorInput, setCoAuthorInput] = useState('');
  const [showCoAuthorInput, setShowCoAuthorInput] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [subjectLength] = useState(72);
  const [recentMessages, setRecentMessages] = useState<string[]>([]);
  const [showRecentMessages, setShowRecentMessages] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整文本框高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [message]);

  // 加载最近提交消息 — Fork 风格
  useEffect(() => {
    (async () => {
      try {
        const log = await window.electronAPI.git.getLog({ depth: 15 });
        if (log && Array.isArray(log)) {
          const messages = log.map((c: any) => c.message || '').filter(Boolean);
          // 去重
          const unique = [...new Set(messages)];
          setRecentMessages(unique.slice(0, 10));
        }
      } catch {}
    })();
  }, [hasStaged]);

  // 加载提交模板
  useEffect(() => {
    if (hasStaged && !message) {
      window.electronAPI.git.getCommitTemplate().then((template) => {
        if (template) {
          setMessage(template);
        }
      }).catch(() => {});
    }
  }, [hasStaged]);

  // Amend 时加载上次提交消息
  useEffect(() => {
    if (amend) {
      const confirmed = window.confirm(i18n.commitDialog.amendConfirm);
      if (!confirmed) {
        setAmend(false);
      }
    }
  }, [amend]);

  // 获取主题行长度
  const subjectLine = message.split('\n')[0] || '';
  const subjectLen = subjectLine.length;

  // 构建完整提交消息（含 co-authors）
  const buildFullMessage = (): string => {
    let fullMsg = message.trim();
    if (coAuthors.length > 0) {
      const coAuthorLines = coAuthors
        .map(a => `Co-authored-by: ${a.name} <${a.email}>`)
        .join('\n');
      fullMsg += '\n\n' + coAuthorLines;
    }
    return fullMsg;
  };

  // 处理提交
  const handleCommit = async () => {
    const fullMsg = buildFullMessage();
    if (!fullMsg || !hasStaged) return;

    try {
      await onCommit(fullMsg, { amend, sign });
      setMessage('');
      setAmend(false);
      setCoAuthors([]);
    } catch (error) {
      console.error('提交失败:', error);
    }
  };

  // 处理键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    }

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

  // 添加共提交者
  const addCoAuthor = useCallback(() => {
    const input = coAuthorInput.trim();
    if (!input) return;

    // 解析 "Name <email>" 格式
    const match = input.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      setCoAuthors(prev => [...prev, { name: match[1].trim(), email: match[2].trim() }]);
    } else {
      // 简单格式，只填了名字
      setCoAuthors(prev => [...prev, { name: input, email: '' }]);
    }
    setCoAuthorInput('');
    setShowCoAuthorInput(false);
  }, [coAuthorInput]);

  // 移除共提交者
  const removeCoAuthor = useCallback((index: number) => {
    setCoAuthors(prev => prev.filter((_, i) => i !== index));
  }, []);

  // AI 生成 commit message
  const handleAiGenerate = async () => {
    setAiGenerating(true);
    try {
      // 获取暂存区 diff
      const diff = await window.electronAPI.git.getStagedDiff?.() || '';
      if (!diff || diff.trim().length === 0) {
        setMessage('feat: update files');
        return;
      }
      const result = await window.electronAPI.ai.generateCommitMessage(diff, 'zh');
      if (result && !result.error) {
        setMessage(result.trim());
      } else if (result?.error) {
        console.error('AI 生成失败:', result.error);
      }
    } catch (e) {
      console.error('AI 生成失败:', e);
    } finally {
      setAiGenerating(false);
    }
  };

  const canCommit = message.trim().length > 0 && hasStaged && !isCommitting;

  // 主题长度颜色
  const subjectColor = subjectLen > 72 ? 'text-red-500 font-bold' : subjectLen > 50 ? 'text-orange-400 font-medium' : 'text-gray-500';

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
            placeholder={hasStaged ? i18n.commitDialog.messagePlaceholder : '输入提交信息... (需先暂存文件)'}
            className={`
              w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-white
              placeholder:text-gray-500 resize-none outline-none
              focus:border-primary-500 focus:ring-1 focus:ring-primary-500
            `}
            rows={2}
            style={{ minHeight: '60px', maxHeight: '120px' }}
          />

          {/* 最近提交消息 — Fork 风格 */}
          {recentMessages.length > 0 && (
            <div style={{ marginTop: 4, maxHeight: showRecentMessages ? 160 : 0, overflow: 'hidden', transition: 'max-height 0.2s ease' }}>
              <div style={{ background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ padding: '4px 8px', fontSize: 10, color: '#8b949e', borderBottom: '1px solid #3c3c3c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>最近提交</span>
                  <button onClick={() => setShowRecentMessages(false)} style={{ background: 'none', border: 'none', color: '#484f58', cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>
                {recentMessages.slice(0, 8).map((msg, i) => (
                  <div
                    key={i}
                    onClick={() => { setMessage(msg); setShowRecentMessages(false); }}
                    style={{ padding: '4px 8px', fontSize: 12, color: '#e6edf3', cursor: 'pointer', borderBottom: i < recentMessages.length - 1 ? '1px solid #252b34' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#252b34')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    title={msg}
                  >
                    {msg.split('\n')[0]}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!showRecentMessages && recentMessages.length > 0 && (
            <button onClick={() => setShowRecentMessages(true)} style={{ marginTop: 2, background: 'none', border: 'none', color: '#484f58', cursor: 'pointer', fontSize: 10, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              最近提交
            </button>
          )}

          {/* 主题长度计数器 */}
          <div className="flex items-center justify-between mt-1">
            <span className={`text-xs ${subjectColor}`}>
              {subjectLen}/{subjectLength}
            </span>
            {/* Co-author 列表 */}
            {coAuthors.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {coAuthors.map((author, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#3c3c3c] rounded text-xs text-gray-300">
                    {author.name}{author.email ? ` <${author.email}>` : ''}
                    <button
                      onClick={() => removeCoAuthor(i)}
                      className="text-gray-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧操作区 */}
        <div className="flex flex-col items-end justify-between p-3 border-l border-[#3c3c3c] min-w-[140px]">
          {/* 复选框选项 */}
          <div className="flex flex-col gap-1.5">
            {/* Amend */}
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

            {/* Sign */}
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-white" title={i18n.commitDialog.signTooltip}>
              <input
                type="checkbox"
                checked={sign}
                onChange={(e) => setSign(e.target.checked)}
                disabled={!hasStaged}
                className="w-3.5 h-3.5 rounded border-[#3c3c3c] bg-[#3c3c3c] text-primary-500 focus:ring-primary-500 focus:ring-offset-0 disabled:opacity-50"
              />
              <span>{i18n.commitDialog.sign}</span>
            </label>

            {/* Co-author */}
            <button
              onClick={() => setShowCoAuthorInput(!showCoAuthorInput)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
              disabled={!hasStaged}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              {i18n.commitDialog.coAuthor}
            </button>

            {/* AI 生成 */}
            <button
              onClick={handleAiGenerate}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-[var(--accent,#00d4aa)]"
              disabled={!hasStaged || aiGenerating}
              title="AI 生成 Commit Message"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {aiGenerating ? '生成中...' : 'AI 生成'}
            </button>
          </div>

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

      {/* Co-author 输入区 */}
      {showCoAuthorInput && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-[#3c3c3c]">
          <input
            value={coAuthorInput}
            onChange={(e) => setCoAuthorInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCoAuthor();
              }
            }}
            placeholder={i18n.commitDialog.coAuthorPlaceholder}
            className="flex-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-1 text-xs text-white placeholder:text-gray-500 outline-none focus:border-primary-500"
          />
          <button
            onClick={addCoAuthor}
            className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            {i18n.common.ok}
          </button>
        </div>
      )}

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
