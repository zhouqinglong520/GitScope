/**
 * Git 拖拽交互上下文
 * 拖分支到分支 = merge/rebase 菜单
 * 拖 commit = cherry-pick
 * Fork 最被用户称赞的交互，码界差异化亮点
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import './DragDropContext.css';

interface DragData {
  type: 'branch' | 'commit' | 'tag';
  id: string;       // branch name / commit oid / tag name
  label: string;    // display label
  sourceRef?: string; // optional ref info
}

interface DropTarget {
  type: 'branch' | 'commit';
  id: string;
  label: string;
}

interface DropAction {
  action: 'merge' | 'rebase' | 'cherry-pick' | 'reset' | 'compare';
  source: DragData;
  target: DropTarget;
  description: string;
  command: string;
}

interface DragDropContextValue {
  dragData: DragData | null;
  isDragging: boolean;
  startDrag: (data: DragData) => void;
  endDrag: () => void;
  showDropMenu: DropAction[] | null;
  onDrop: (target: DropTarget) => void;
  cancelDropMenu: () => void;
  executeDropAction: (action: DropAction) => void;
  menuPosition: { x: number; y: number } | null;
}

const DragDropCtx = createContext<DragDropContextValue | null>(null);

export function useDragDrop() {
  const ctx = useContext(DragDropCtx);
  if (!ctx) throw new Error('useDragDrop must be used within DragDropProvider');
  return ctx;
}

interface Props {
  children: React.ReactNode;
  onMerge?: (source: string, target: string) => void;
  onRebase?: (source: string, onto: string) => void;
  onCherryPick?: (oid: string, targetBranch: string) => void;
  onCompare?: (source: string, target: string) => void;
  onReset?: (oid: string, targetBranch: string) => void;
}

export function DragDropProvider({ children, onMerge, onRebase, onCherryPick, onCompare, onReset }: Props) {
  const [dragData, setDragData] = useState<DragData | null>(null);
  const [showDropMenu, setShowDropMenu] = useState<DropAction[] | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const onExecuteRef = useRef<((action: DropAction) => void) | null>(null);

  const startDrag = useCallback((data: DragData) => {
    setDragData(data);
  }, []);

  const endDrag = useCallback(() => {
    setDragData(null);
  }, []);

  const onDrop = useCallback((target: DropTarget) => {
    if (!dragData) return;

    const actions: DropAction[] = [];

    // Branch → Branch
    if (dragData.type === 'branch' && target.type === 'branch') {
      if (dragData.id !== target.id) {
        actions.push({
          action: 'merge',
          source: dragData,
          target,
          description: `将 ${dragData.label} 合并到 ${target.label}`,
          command: `git checkout ${target.id} && git merge ${dragData.id}`,
        });
        actions.push({
          action: 'rebase',
          source: dragData,
          target,
          description: `将 ${dragData.label} 变基到 ${target.label}`,
          command: `git checkout ${dragData.id} && git rebase ${target.id}`,
        });
        actions.push({
          action: 'compare',
          source: dragData,
          target,
          description: `比较 ${dragData.label} 和 ${target.label}`,
          command: `git diff ${target.id}..${dragData.id}`,
        });
      }
    }

    // Commit → Branch
    if (dragData.type === 'commit' && target.type === 'branch') {
      actions.push({
        action: 'cherry-pick',
        source: dragData,
        target,
        description: `将提交 ${dragData.label} 摘取到 ${target.label}`,
        command: `git checkout ${target.id} && git cherry-pick ${dragData.id}`,
      });
      actions.push({
        action: 'reset',
        source: dragData,
        target,
        description: `将 ${target.label} 重置到 ${dragData.label}`,
        command: `git checkout ${target.id} && git reset --hard ${dragData.id}`,
      });
    }

    // Tag → Branch
    if (dragData.type === 'tag' && target.type === 'branch') {
      actions.push({
        action: 'reset',
        source: dragData,
        target,
        description: `将 ${target.label} 重置到标签 ${dragData.label}`,
        command: `git checkout ${target.id} && git reset --hard ${dragData.id}`,
      });
    }

    if (actions.length > 0) {
      setShowDropMenu(actions);
    }
  }, [dragData]);

  const cancelDropMenu = useCallback(() => {
    setShowDropMenu(null);
    setDragData(null);
  }, []);

  const executeDropAction = useCallback((action: DropAction) => {
    setShowDropMenu(null);
    setDragData(null);

    switch (action.action) {
      case 'merge':
        onMerge?.(action.source.id, action.target.id);
        break;
      case 'rebase':
        onRebase?.(action.source.id, action.target.id);
        break;
      case 'cherry-pick':
        onCherryPick?.(action.source.id, action.target.id);
        break;
      case 'compare':
        onCompare?.(action.source.id, action.target.id);
        break;
      case 'reset':
        onReset?.(action.source.id, action.target.id);
        break;
    }
  }, [onMerge, onRebase, onCherryPick, onCompare, onReset]);

  return (
    <DragDropCtx.Provider value={{
      dragData,
      isDragging: !!dragData,
      startDrag,
      endDrag,
      showDropMenu,
      onDrop,
      cancelDropMenu,
      executeDropAction,
      menuPosition,
    }}>
      {children}
      {/* Drop action menu */}
      {showDropMenu && (
        <div className="dd-drop-menu-overlay" onClick={cancelDropMenu}>
          <div className="dd-drop-menu" onClick={e => e.stopPropagation()}>
            <div className="dd-drop-menu-header">
              <span className="dd-drop-source">{showDropMenu[0].source.label}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              <span className="dd-drop-target">{showDropMenu[0].target.label}</span>
            </div>
            <div className="dd-drop-menu-actions">
              {showDropMenu.map((action, idx) => (
                <button
                  key={idx}
                  className={`dd-drop-action dd-drop-${action.action}`}
                  onClick={() => executeDropAction(action)}
                >
                  <span className="dd-drop-action-label">
                    {action.action === 'merge' && '🔀'}
                    {action.action === 'rebase' && '🔄'}
                    {action.action === 'cherry-pick' && '🍒'}
                    {action.action === 'compare' && '📊'}
                    {action.action === 'reset' && '⏪'}
                    {' '}{action.description}
                  </span>
                  <code className="dd-drop-cmd">{action.command}</code>
                </button>
              ))}
            </div>
            <div className="dd-drop-menu-footer">
              <button className="dd-drop-cancel" onClick={cancelDropMenu}>取消</button>
            </div>
          </div>
        </div>
      )}
    </DragDropCtx.Provider>
  );
}

/**
 * 可拖拽元素包装器
 */
export function Draggable({ data, children, className }: {
  data: DragData;
  children: React.ReactNode;
  className?: string;
}) {
  const { startDrag, endDrag } = useDragDrop();

  return (
    <div
      className={`dd-draggable ${className || ''}`}
      draggable
      onDragStart={() => startDrag(data)}
      onDragEnd={endDrag}
    >
      {children}
    </div>
  );
}

/**
 * 放置目标包装器
 */
export function DropTargetZone({ target, children, className }: {
  target: DropTarget;
  children: React.ReactNode;
  className?: string;
}) {
  const { isDragging, onDrop } = useDragDrop();
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      className={`dd-drop-zone ${isOver ? 'dd-drop-zone-active' : ''} ${isDragging ? 'dd-drop-zone-highlight' : ''} ${className || ''}`}
      onDragOver={e => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={e => { e.preventDefault(); setIsOver(false); onDrop(target); }}
    >
      {children}
      {isOver && <div className="dd-drop-indicator" />}
    </div>
  );
}

export default DragDropProvider;
