/**
 * 快捷键速查表
 * 按 ? 键弹出，像 GitHub 一样的 overlay
 */

import React, { useState, useMemo } from 'react';
import './ShortcutsDialog.css';

interface ShortcutItem {
  keys: string;
  description: string;
  category: string;
}

const SHORTCUTS: ShortcutItem[] = [
  // 通用
  { keys: 'Ctrl+K', description: '命令面板', category: '通用' },
  { keys: 'Ctrl+Shift+P', description: '命令面板', category: '通用' },
  { keys: '?', description: '快捷键速查表', category: '通用' },
  { keys: 'Ctrl+,', description: '打开设置', category: '通用' },
  { keys: 'F5', description: '刷新', category: '通用' },
  // 文件
  { keys: 'Ctrl+O', description: '打开仓库', category: '仓库' },
  { keys: 'Ctrl+W', description: '关闭当前仓库', category: '仓库' },
  { keys: 'Ctrl+Shift+O', description: '克隆仓库', category: '仓库' },
  // 提交
  { keys: 'Ctrl+Enter', description: '提交', category: '提交' },
  { keys: 'Ctrl+Shift+Enter', description: 'Amend 提交', category: '提交' },
  { keys: 'Ctrl+S', description: '暂存所有更改', category: '提交' },
  // 分支
  { keys: 'Ctrl+B', description: '新建/切换分支', category: '分支' },
  // 远程
  { keys: 'Ctrl+P', description: '推送', category: '远程' },
  { keys: 'Ctrl+Shift+P', description: '拉取', category: '远程' },
  { keys: 'Ctrl+Shift+F', description: 'Fetch', category: '远程' },
  // 暂存
  { keys: 'Ctrl+Shift+S', description: 'Stash', category: '暂存' },
  // Diff
  { keys: 'Ctrl+F', description: '搜索 Diff', category: 'Diff' },
  { keys: 'Ctrl+Shift+S', description: '切换 Diff 模式', category: 'Diff' },
  // 面板
  { keys: 'Ctrl+`', description: '内置终端', category: '面板' },
  { keys: 'Ctrl+G', description: 'Gitee 面板', category: '面板' },
  { keys: 'Esc', description: '关闭弹窗/面板', category: '面板' },
  // 导航
  { keys: '↑ / ↓', description: '上下导航提交列表', category: '导航' },
  { keys: 'Enter', description: '选中/确认', category: '导航' },
  { keys: 'j / k', description: '上下导航（Vim 风格）', category: '导航' },
  // 布局
  { keys: 'Ctrl+B', description: '切换侧边栏', category: '布局' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

function ShortcutsDialog({ visible, onClose }: Props) {
  const [filter, setFilter] = useState('');

  const grouped = useMemo(() => {
    const q = filter.toLowerCase();
    const filtered = filter
      ? SHORTCUTS.filter(s =>
          s.description.toLowerCase().includes(q) ||
          s.keys.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
        )
      : SHORTCUTS;

    const groups: Record<string, ShortcutItem[]> = {};
    for (const s of filtered) {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    }
    return groups;
  }, [filter]);

  if (!visible) return null;

  return (
    <div className="sd-overlay" onClick={onClose}>
      <div className="sd-dialog" onClick={e => e.stopPropagation()}>
        <div className="sd-header">
          <h3 className="sd-title">⌨️ 快捷键</h3>
          <input
            className="sd-filter"
            placeholder="搜索快捷键..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            autoFocus
          />
          <button className="sd-close" onClick={onClose}>✕</button>
        </div>
        <div className="sd-content">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="sd-group">
              <div className="sd-group-label">{category}</div>
              <div className="sd-grid">
                {items.map((item, idx) => (
                  <div key={idx} className="sd-item">
                    <kbd className="sd-keys">{item.keys}</kbd>
                    <span className="sd-desc">{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="sd-footer">
          按 <kbd>Esc</kbd> 或 <kbd>?</kbd> 关闭
        </div>
      </div>
    </div>
  );
}

export default ShortcutsDialog;
