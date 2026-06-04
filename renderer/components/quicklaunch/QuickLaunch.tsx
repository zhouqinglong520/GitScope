/**
 * Quick Launch 命令面板组件
 * 类似 VS Code 的 Ctrl+P 或 Fork 的 Quick Launch
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface QuickLaunchCommand {
  /** 命令 ID */
  id: string;
  /** 命令名称 */
  label: string;
  /** 命令描述 */
  description?: string;
  /** 分类 */
  category: string;
  /** 快捷键 */
  shortcut?: string;
  /** 图标 */
  icon?: React.ReactNode;
  /** 执行回调 */
  action: () => void;
}

interface QuickLaunchProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 命令列表 */
  commands: QuickLaunchCommand[];
}

// 默认命令列表
const defaultCommands: QuickLaunchCommand[] = [
  {
    id: 'clone',
    label: 'Clone Repository',
    description: '克隆一个新的远程仓库',
    category: '仓库',
    shortcut: 'Ctrl+Shift+O',
    action: () => {},
  },
  {
    id: 'new-branch',
    label: 'New Branch',
    description: '创建一个新的分支',
    category: '分支',
    shortcut: 'Ctrl+B',
    action: () => {},
  },
  {
    id: 'switch-branch',
    label: 'Switch Branch',
    description: '切换到其他分支',
    category: '分支',
    shortcut: 'Ctrl+Shift+1',
    action: () => {},
  },
  {
    id: 'commit-all',
    label: 'Commit All',
    description: '提交所有更改',
    category: '提交',
    shortcut: 'Ctrl+Enter',
    action: () => {},
  },
  {
    id: 'push',
    label: 'Push',
    description: '推送到远程仓库',
    category: '远程',
    shortcut: 'Ctrl+P',
    action: () => {},
  },
  {
    id: 'pull',
    label: 'Pull',
    description: '从远程仓库拉取',
    category: '远程',
    shortcut: 'Ctrl+Shift+P',
    action: () => {},
  },
  {
    id: 'fetch',
    label: 'Fetch',
    description: '获取远程更新',
    category: '远程',
    action: () => {},
  },
  {
    id: 'stash',
    label: 'Stash Changes',
    description: '暂存当前更改',
    category: '暂存',
    shortcut: 'Ctrl+Shift+S',
    action: () => {},
  },
  {
    id: 'stash-pop',
    label: 'Stash Pop',
    description: '恢复暂存的更改',
    category: '暂存',
    action: () => {},
  },
  {
    id: 'create-tag',
    label: 'Create Tag',
    description: '创建新的标签',
    category: '标签',
    action: () => {},
  },
  {
    id: 'open-terminal',
    label: 'Open in Terminal',
    description: '在终端中打开',
    category: '工具',
    shortcut: 'Ctrl+`',
    action: () => {},
  },
  {
    id: 'settings',
    label: 'Settings',
    description: '打开设置',
    category: '工具',
    shortcut: 'Ctrl+,',
    action: () => {},
  },
];

function QuickLaunch({ isOpen, onClose, commands }: QuickLaunchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allCommands = commands.length > 0 ? commands : defaultCommands;

  // 过滤命令
  const filteredCommands = allCommands.filter((cmd) => {
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q)
    );
  });

  // 按分类分组
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, QuickLaunchCommand[]>);

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // 滚动到选中项
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  let currentGlobalIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 命令面板 */}
      <div className="relative w-[560px] bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-2xl overflow-hidden">
        {/* 搜索框 */}
        <div className="flex items-center px-4 py-3 border-b border-[#3c3c3c]">
          <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="输入命令或搜索..."
            className="flex-1 bg-transparent text-white text-base outline-none placeholder:text-gray-500"
          />
          <kbd className="px-2 py-0.5 text-xs text-gray-500 bg-[#3c3c3c] rounded">Esc</kbd>
        </div>

        {/* 命令列表 */}
        <div
          ref={listRef}
          className="max-h-[400px] overflow-y-auto py-2"
          style={{ scrollbarWidth: 'thin' }}
        >
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category}>
              {/* 分类标题 */}
              <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase bg-[#1e1e1e]">
                {category}
              </div>

              {/* 命令项 */}
              {cmds.map((cmd) => {
                const itemIndex = currentGlobalIndex++;
                const isSelected = itemIndex === selectedIndex;

                return (
                  <div
                    key={cmd.id}
                    data-index={itemIndex}
                    onClick={() => {
                      cmd.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                    className={`
                      flex items-center gap-3 px-4 py-2 cursor-pointer
                      ${isSelected ? 'bg-[#094771]' : 'hover:bg-[#2a2d2e]'}
                    `}
                  >
                    {cmd.icon ? (
                      <span className="text-gray-400">{cmd.icon}</span>
                    ) : (
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white">{cmd.label}</div>
                      {cmd.description && (
                        <div className="text-xs text-gray-500 truncate">{cmd.description}</div>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <kbd className="px-2 py-0.5 text-xs text-gray-400 bg-[#3c3c3c] rounded">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {filteredCommands.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              <p>未找到匹配的命令</p>
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-4 py-2 border-t border-[#3c3c3c] text-xs text-gray-500 flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-[#3c3c3c] rounded">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-[#3c3c3c] rounded">↓</kbd>
            导航
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-[#3c3c3c] rounded">Enter</kbd>
            执行
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-[#3c3c3c] rounded">Esc</kbd>
            关闭
          </span>
        </div>
      </div>
    </div>
  );
}

export default QuickLaunch;
export { defaultCommands };
