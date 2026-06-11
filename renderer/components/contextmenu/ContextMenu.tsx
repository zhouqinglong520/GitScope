/**
 * 右键菜单组件
 * 通用右键菜单，支持子菜单、分割线、快捷键显示、图标
 */

import React, { useEffect, useRef, useState } from 'react';

export interface MenuItem {
  /** 菜单项 ID */
  id: string;
  /** 显示文本 */
  label: string;
  /** 图标（可选） */
  icon?: React.ReactNode;
  /** 快捷键（可选） */
  shortcut?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示分割线 */
  divider?: boolean;
  /** 子菜单（可选） */
  children?: MenuItem[];
  /** 点击回调 */
  onClick?: () => void;
}

interface ContextMenuProps {
  /** 菜单位置 */
  x: number;
  y: number;
  /** 菜单元数据 */
  items: MenuItem[];
  /** 关闭回调 */
  onClose: () => void;
}

function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [position, setPosition] = useState({ x, y });

  // 调整菜单位置，确保不超出屏幕
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = x;
      let newY = y;

      if (x + rect.width > viewportWidth) {
        newX = viewportWidth - rect.width - 8;
      }
      if (y + rect.height > viewportHeight) {
        newY = viewportHeight - rect.height - 8;
      }

      setPosition({ x: newX, y: newY });
    }
  }, [x, y]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // 使用 setTimeout 确保不会立即关闭，给菜单项点击一点时间
    const handleMouseDown = (e: MouseEvent) => {
      setTimeout(() => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          onClose();
        }
      }, 0);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // 渲染单个菜单项
  const renderMenuItem = (item: MenuItem, index: number) => {
    if (item.divider) {
      return (
        <div
          key={`divider-${index}`}
          className="h-px bg-[#3c3c3c] my-1"
        />
      );
    }

    const hasChildren = item.children && item.children.length > 0;
    const isActive = activeSubmenu === item.id;

    return (
      <div
        key={item.id}
        className="relative"
        onMouseEnter={() => hasChildren && setActiveSubmenu(item.id)}
        onMouseLeave={() => hasChildren && setActiveSubmenu(null)}
      >
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (!item.disabled && !hasChildren) {
              // 先执行 onClick，再关闭菜单
              if (item.onClick) {
                try {
                  item.onClick();
                } catch (err) {
                  console.error('[ContextMenu] 执行 onClick 出错:', err);
                }
              }
              // 延迟关闭，确保 onClick 有时间执行
              setTimeout(() => onClose(), 0);
            }
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          className={`
            flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none
            ${item.disabled 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:bg-[#094771]'
            }
          `}
        >
          {item.icon && (
            <span className="w-4 h-4 flex items-center justify-center text-gray-400">
              {item.icon}
            </span>
          )}
          <span className="flex-1 text-sm">{item.label}</span>
          {item.shortcut && (
            <span className="text-xs text-gray-500">{item.shortcut}</span>
          )}
          {hasChildren && (
            <span className="text-xs text-gray-500">▶</span>
          )}
        </div>

        {/* 子菜单 */}
        {hasChildren && isActive && (
          <div
            className="absolute left-full top-0 ml-1 bg-[#2d2d30] border border-[#3c3c3c] rounded shadow-lg min-w-[160px] py-1 z-50"
          >
            {item.children!.map((child, childIndex) => renderMenuItem(child, childIndex))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-[#2d2d30] border border-[#3c3c3c] rounded shadow-xl py-1 z-[1000] min-w-[180px]"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item, index) => renderMenuItem(item, index))}
    </div>
  );
}

/**
 * 使用右键菜单的 Hook
 */
export function useContextMenu(itemsGetter: () => MenuItem[]) {
  const [menuState, setMenuState] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);

  const showContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({
      x: e.clientX,
      y: e.clientY,
      items: itemsGetter(),
    });
  };

  const closeContextMenu = () => {
    setMenuState(null);
  };

  const ContextMenuWrapper = menuState ? (
    <ContextMenu
      x={menuState.x}
      y={menuState.y}
      items={menuState.items}
      onClose={closeContextMenu}
    />
  ) : null;

  return {
    showContextMenu,
    ContextMenuWrapper,
    closeContextMenu,
  };
}

export default ContextMenu;
