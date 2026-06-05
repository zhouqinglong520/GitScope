/**
 * 交互式 Rebase 对话框
 * Fork 风格拖拽式 Rebase 编辑器 - 核心差异化功能
 * 支持拖拽排序、Squash/Fixup/Reword/Edit/Drop 操作
 * 增强：多选批量操作、冲突预判、IR中Amend、键盘快捷键
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './RebaseDialog.css';

interface RebaseCommitItem {
  oid: string;
  shortOid: string;
  message: string;
  author: string;
  action: 'pick' | 'squash' | 'fixup' | 'reword' | 'edit' | 'drop';
  order: number;
  selected?: boolean;
}

interface Props {
  visible: boolean;
  upstream: string;
  onClose: () => void;
  onComplete: () => void;
}

export const InteractiveRebaseDialog: React.FC<Props> = ({ visible, upstream, onClose, onComplete }) => {
  const [commits, setCommits] = useState<RebaseCommitItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateRefs, setUpdateRefs] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 加载待 Rebase 的提交列表
  useEffect(() => {
    if (visible && upstream) {
      loadCommits();
      checkConflicts();
    }
  }, [visible, upstream]);

  const loadCommits = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.git.getRebaseActions(upstream);
      setCommits(result.map((c: any, i: number) => ({
        ...c,
        action: 'pick' as const,
        order: i,
        selected: false,
      })));
      setSelectedIds(new Set());
    } catch (e: any) {
      setError(e.message || '加载提交列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 冲突预判
  const checkConflicts = async () => {
    try {
      const hasConflict = await window.electronAPI.git.checkRebaseConflict(upstream);
      if (hasConflict) {
        setConflictWarning('⚠️ Rebase 可能产生冲突，请准备好手动解决');
      } else {
        setConflictWarning(null);
      }
    } catch {
      // 冲突检测失败不阻塞操作
      setConflictWarning(null);
    }
  };

  // 多选逻辑：Ctrl+点击多选，Shift+点击范围选
  const handleSelect = (index: number, e: React.MouseEvent) => {
    const commit = commits[index];
    const newSelected = new Set(selectedIds);

    if (e.shiftKey && lastClickedIndex !== null) {
      // Shift 范围选
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      for (let i = start; i <= end; i++) {
        newSelected.add(commits[i].oid);
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl 多选切换
      if (newSelected.has(commit.oid)) {
        newSelected.delete(commit.oid);
      } else {
        newSelected.add(commit.oid);
      }
    } else {
      // 单选
      if (newSelected.size === 1 && newSelected.has(commit.oid)) {
        newSelected.clear();
      } else {
        newSelected.clear();
        newSelected.add(commit.oid);
      }
    }

    setSelectedIds(newSelected);
    setLastClickedIndex(index);
  };

  const selectAll = () => {
    setSelectedIds(new Set(commits.map(c => c.oid)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  // 批量操作
  const batchSetAction = (action: RebaseCommitItem['action']) => {
    if (selectedIds.size === 0) return;
    setCommits(prev => prev.map(c =>
      selectedIds.has(c.oid) ? { ...c, action } : c
    ));
  };

  // 拖拽排序
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDropIndex(index);
  };
  const handleDrop = () => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      const newCommits = [...commits];
      const [moved] = newCommits.splice(dragIndex, 1);
      newCommits.splice(dropIndex, 0, moved);
      setCommits(newCommits.map((c, i) => ({ ...c, order: i })));
    }
    setDragIndex(null);
    setDropIndex(null);
  };

  // 修改操作类型
  const setAction = (index: number, action: RebaseCommitItem['action']) => {
    setCommits(prev => prev.map((c, i) => i === index ? { ...c, action } : c));
  };

  // 编辑提交消息（reword）
  const startEditMessage = (index: number) => {
    setEditingMessage(commits[index].oid);
    setNewMessage(commits[index].message);
  };
  const saveMessage = () => {
    if (editingMessage) {
      setCommits(prev => prev.map(c =>
        c.oid === editingMessage ? { ...c, message: newMessage, action: 'reword' } : c
      ));
    }
    setEditingMessage(null);
  };

  // IR 中 Amend：将选中的 pick 改为 edit
  const amendSelected = () => {
    if (selectedIds.size === 0) return;
    setCommits(prev => prev.map(c =>
      selectedIds.has(c.oid) ? { ...c, action: 'edit' } : c
    ));
  };

  // 键盘快捷键
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!visible) return;
    if (editingMessage) return; // 编辑消息时不拦截

    switch (e.key) {
      case 'p': batchSetAction('pick'); break;
      case 's': if (!e.ctrlKey && !e.metaKey) batchSetAction('squash'); break;
      case 'f': batchSetAction('fixup'); break;
      case 'r': batchSetAction('reword'); break;
      case 'e': batchSetAction('edit'); break;
      case 'd': batchSetAction('drop'); break;
      case 'a':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); selectAll(); }
        break;
      case 'Escape': selectNone(); break;
    }
  }, [visible, selectedIds, commits, editingMessage]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 执行 Rebase
  const executeRebase = async () => {
    setExecuting(true);
    setError(null);
    try {
      const activeCommits = commits.filter(c => c.action !== 'drop');
      await window.electronAPI.git.executeRebasePlan({
        upstream,
        actions: activeCommits.map(c => ({ action: c.action, oid: c.oid, shortOid: c.shortOid, message: c.message, author: c.author, order: c.order })),
        updateRefs,
      });
      onComplete();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Rebase 执行失败');
    } finally {
      setExecuting(false);
    }
  };

  // 操作类型的颜色和图标
  const actionConfig: Record<string, { color: string; label: string; icon: string }> = {
    pick: { color: '#4CAF50', label: 'Pick', icon: '✓' },
    squash: { color: '#FF9800', label: 'Squash', icon: '⊞' },
    fixup: { color: '#FF5722', label: 'Fixup', icon: '⊟' },
    reword: { color: '#2196F3', label: 'Reword', icon: '✎' },
    edit: { color: '#9C27B0', label: 'Edit', icon: '✏' },
    drop: { color: '#999', label: 'Drop', icon: '✕' },
  };

  const selectedCount = selectedIds.size;

  if (!visible) return null;

  return (
    <div className="rebase-overlay">
      <div className="rebase-dialog">
        <div className="rebase-header">
          <h3>交互式 Rebase</h3>
          <span className="rebase-upstream">目标: {upstream}</span>
          <label className="rebase-option">
            <input type="checkbox" checked={updateRefs} onChange={e => setUpdateRefs(e.target.checked)} />
            --update-refs
          </label>
          <button className="rebase-close" onClick={onClose}>✕</button>
        </div>

        {/* 冲突预判提示 */}
        {conflictWarning && (
          <div className="rebase-conflict-warning">{conflictWarning}</div>
        )}

        <div className="rebase-toolbar">
          <span className="toolbar-hint">拖拽排序 · 点击操作类型切换 · 双击消息编辑 · P/S/F/R/E/D 快捷键</span>
          <div className="toolbar-actions">
            <button onClick={() => { setCommits(prev => prev.map(c => ({ ...c, action: 'pick' as const }))); }}>全部 Pick</button>
            <button onClick={() => { setCommits(prev => prev.map((c, i) => i === 0 ? c : ({ ...c, action: 'squash' as const }))); }}>全部 Squash</button>
            {selectedCount > 0 && (
              <>
                <span className="toolbar-separator">|</span>
                <span className="toolbar-selected-count">已选 {selectedCount} 项</span>
                <button onClick={() => batchSetAction('squash')} title="批量 Squash (S)">Squash</button>
                <button onClick={() => batchSetAction('fixup')} title="批量 Fixup (F)">Fixup</button>
                <button onClick={() => batchSetAction('reword')} title="批量 Reword (R)">Reword</button>
                <button onClick={amendSelected} title="批量 Amend → Edit (E)">Amend</button>
                <button onClick={() => batchSetAction('drop')} title="批量 Drop (D)">Drop</button>
                <button onClick={selectNone}>取消选择</button>
              </>
            )}
          </div>
        </div>

        <div className="rebase-list" ref={listRef}>
          {loading ? (
            <div className="rebase-loading">加载提交列表...</div>
          ) : commits.length === 0 ? (
            <div className="rebase-empty">没有待 Rebase 的提交</div>
          ) : (
            commits.map((commit, index) => {
              const config = actionConfig[commit.action];
              const isSelected = selectedIds.has(commit.oid);
              return (
                <div
                  key={commit.oid}
                  className={`rebase-item ${commit.action === 'drop' ? 'dropped' : ''} ${dragIndex === index ? 'dragging' : ''} ${dropIndex === index ? 'drop-target' : ''} ${isSelected ? 'selected' : ''}`}
                  draggable={commit.action !== 'drop'}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={handleDrop}
                  onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                  onClick={(e) => handleSelect(index, e)}
                >
                  <div className="rebase-item-select">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        const newSelected = new Set(selectedIds);
                        if (isSelected) newSelected.delete(commit.oid);
                        else newSelected.add(commit.oid);
                        setSelectedIds(newSelected);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="rebase-item-grip" title="拖拽排序">⠿</div>

                  <div className="rebase-item-action" style={{ color: config.color }}>
                    <select value={commit.action} onChange={e => setAction(index, e.target.value as any)} onClick={(e) => e.stopPropagation()}>
                      {Object.entries(actionConfig).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="rebase-item-info">
                    <span className="rebase-item-sha">{commit.shortOid}</span>
                    {editingMessage === commit.oid ? (
                      <div className="rebase-edit-message" onClick={(e) => e.stopPropagation()}>
                        <input
                          value={newMessage}
                          onChange={e => setNewMessage(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveMessage()}
                          autoFocus
                        />
                        <button onClick={saveMessage}>✓</button>
                        <button onClick={() => setEditingMessage(null)}>✕</button>
                      </div>
                    ) : (
                      <span
                        className="rebase-item-message"
                        onDoubleClick={() => startEditMessage(index)}
                      >
                        {commit.message}
                      </span>
                    )}
                    <span className="rebase-item-author">{commit.author}</span>
                  </div>

                  <div className="rebase-item-actions" onClick={(e) => e.stopPropagation()}>
                    {commit.action !== 'drop' && (
                      <button
                        className="action-btn drop-btn"
                        onClick={() => setAction(index, 'drop')}
                        title="删除此提交 (D)"
                      >✕</button>
                    )}
                    {commit.action === 'drop' && (
                      <button
                        className="action-btn restore-btn"
                        onClick={() => setAction(index, 'pick')}
                        title="恢复"
                      >↩</button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {error && <div className="rebase-error">❌ {error}</div>}

        <div className="rebase-footer">
          <span className="rebase-summary">
            {commits.filter(c => c.action !== 'drop').length} 个提交将被保留
            {commits.filter(c => c.action === 'squash').length > 0 && ` · ${commits.filter(c => c.action === 'squash').length} 个将合并`}
            {commits.filter(c => c.action === 'fixup').length > 0 && ` · ${commits.filter(c => c.action === 'fixup').length} 个将修复合并`}
            {commits.filter(c => c.action === 'drop').length > 0 && ` · ${commits.filter(c => c.action === 'drop').length} 个将丢弃`}
          </span>
          <div className="rebase-actions">
            <button className="btn-cancel" onClick={onClose}>取消</button>
            <button
              className="btn-execute"
              onClick={executeRebase}
              disabled={executing || commits.filter(c => c.action !== 'drop').length === 0}
            >
              {executing ? '执行中...' : '开始 Rebase'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveRebaseDialog;
