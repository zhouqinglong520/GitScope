/**
 * 提交图组件 (Fork 风格)
 * 提交图和信息在同一行，左侧彩色分支线区域 + 右侧提交信息
 * 支持选中提交展开详情、右键菜单、refs 标签显示
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { GitCommit, GitBranch, GraphNode } from '@shared/types/git';
import { useContextMenu, type MenuItem } from '../contextmenu/ContextMenu';
import { useI18 } from '../../i18n';

interface CommitGraphProps {
  /** 提交列表 */
  commits: GitCommit[];
  /** 分支列表 */
  branches: GitBranch[];
  /** 当前分支名称 */
  currentBranch?: string;
  /** 选中的提交 */
  selectedCommit?: string | null;
  /** 选择提交回调 */
  onCommitSelect?: (oid: string | null) => void;
  /** 右键菜单回调 - 创建分支 */
  onCreateBranch?: (oid: string) => void;
  /** 右键菜单回调 - 创建标签 */
  onCreateTag?: (oid: string) => void;
  /** 右键菜单回调 - 重置 */
  onReset?: (oid: string) => void;
  /** 右键菜单回调 - 检出提交 */
  onCheckout?: (oid: string) => void;
  /** 右键菜单回调 - Cherry-pick */
  onCherryPick?: (oid: string) => void;
  /** 右键菜单回调 - Revert */
  onRevert?: (oid: string) => void;
  /** 右键菜单回调 - 保存为 Patch */
  onSavePatch?: (oid: string) => void;
  /** 右键菜单回调 - Interactive Rebase */
  onInteractiveRebase?: (oid: string, action: 'reword' | 'squash' | 'fixup' | 'drop') => void;
}

// 分支颜色配置
const BRANCH_COLORS = [
  '#5799da', // 蓝色
  '#7dce82', // 绿色
  '#e2a855', // 橙色
  '#b47ccf', // 紫色
  '#52c4e8', // 青色
  '#e85d75', // 红色
  '#72d6c9', // 青绿
  '#f0c674', // 金色
];

const ROW_HEIGHT = 36;
const COLUMN_WIDTH = 20;
const CIRCLE_RADIUS = 6;
const GRAPH_WIDTH = 120; // 左侧图区域宽度

interface RefInfo {
  name: string;
  type: 'branch' | 'tag';
  isHead?: boolean;
}

/**
 * 生成提交图节点
 */
function buildGraphNodes(
  commits: GitCommit[],
  branches: GitBranch[]
): GraphNode[] {
  if (commits.length === 0) return [];

  // 构建分支 SHA 到名称的映射
  const branchShaMap = new Map<string, string[]>();
  const tagShaMap = new Map<string, string[]>();
  
  branches.forEach((b) => {
    if (b.oid) {
      if (b.remote) {
        // 远程分支
        const list = tagShaMap.get(b.oid) || [];
        list.push(b.name);
        tagShaMap.set(b.oid, list);
      } else {
        // 本地分支
        const list = branchShaMap.get(b.oid) || [];
        list.push(b.name);
        branchShaMap.set(b.oid, list);
      }
    }
  });

  // 列分配算法
  // 主分支（main/master）固定在 column 0
  const columnMap = new Map<string, number>();
  const activeColumns: (string | null)[] = [null]; // column 0 预留给主分支
  let maxColumn = 0;
  
  // 找到主分支的 SHA
  const mainBranch = branches.find(
    (b) => b.name === 'main' || b.name === 'master' || b.current
  );
  const mainBranchOid = mainBranch?.oid || commits[0]?.oid;

  const nodes: GraphNode[] = [];

  // 从最新提交开始遍历
  for (let row = 0; row < commits.length; row++) {
    const commit = commits[row];
    let column: number;

    // 检查是否有分支/标签指向这个提交
    const branchNames = branchShaMap.get(commit.oid) || [];
    const tagNames = tagShaMap.get(commit.oid) || [];
    const refs: string[] = [...branchNames, ...tagNames];

    // 如果这个提交有分支指向，确定它的列
    if (branchNames.length > 0 || tagNames.length > 0) {
      // 优先使用主分支所在的列
      if (branchNames.includes('main') || branchNames.includes('master') || commit.oid === mainBranchOid) {
        column = 0;
      } else {
        // 找第一个可用列
        column = activeColumns.findIndex((v) => v === null);
        if (column === -1) {
          column = ++maxColumn;
        }
      }
      columnMap.set(commit.oid, column);
      activeColumns[column] = commit.oid;
    } else if (columnMap.has(commit.oid)) {
      // 已经分配过列
      column = columnMap.get(commit.oid)!;
    } else {
      // 新提交，找可用列
      column = activeColumns.findIndex((v) => v === null);
      if (column === -1) {
        column = ++maxColumn;
      }
      columnMap.set(commit.oid, column);
    }

    // 找到父节点列
    const parentColumns: number[] = [];
    commit.parentIds.forEach((parentOid) => {
      if (columnMap.has(parentOid)) {
        parentColumns.push(columnMap.get(parentOid)!);
      }
    });

    // 颜色基于列
    const colorIndex = column % BRANCH_COLORS.length;
    const color = BRANCH_COLORS[colorIndex];

    // 释放当前提交的列（如果不是主分支且没有子提交）
    const isLastInColumn = !commits.slice(row + 1).some(
      (c) => columnMap.get(c.oid) === column
    );
    
    // 只有当这是分支的最后一个提交时才释放列
    if (isLastInColumn && !branchNames.includes('main') && !branchNames.includes('master') && column > 0) {
      activeColumns[column] = null;
    }

    nodes.push({
      commit,
      column,
      color,
      row,
      parentColumns,
      branchName: branchNames[0] || tagNames[0],
      refs,
    });
  }

  return nodes;
}

/**
 * 获取 refs 标签的颜色
 */
function getRefColor(ref: string, branches: GitBranch[]): string {
  const branch = branches.find((b) => b.name === ref);
  if (branch) {
    const column = branch.oid ? Array.from(new Set(
      nodes.filter((n) => n.commit.oid === branch.oid).map((n) => n.column)
    ))[0] : 0;
    return BRANCH_COLORS[column % BRANCH_COLORS.length];
  }
  return '#888888';
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 7天内用相对时间
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;

  // 超过7天显示紧凑格式
  const year = date.getFullYear();
  const currentYear = now.getFullYear();
  
  if (year === currentYear) {
    // 今年内只显示月日 (Mar 11 或 3/11)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } else {
    // 跨年显示年月
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  }
}

let nodes: GraphNode[] = [];

function CommitGraph({
  commits,
  branches,
  currentBranch,
  selectedCommit,
  onCommitSelect,
  onCreateBranch,
  onCreateTag,
  onReset,
  onCheckout,
  onCherryPick,
  onRevert,
  onSavePatch,
  onInteractiveRebase,
}: CommitGraphProps) {
  const { t } = useI18();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);

  // 构建图数据
  useEffect(() => {
    nodes = buildGraphNodes(commits, branches);
    setGraphNodes(nodes);
  }, [commits, branches]);

  // 虚拟滚动计算
  const virtualData = useMemo(() => {
    const startRow = Math.floor(scrollTop / ROW_HEIGHT);
    const endRow = Math.min(
      startRow + Math.ceil(containerHeight / ROW_HEIGHT) + 2,
      graphNodes.length
    );

    return {
      startRow,
      endRow,
      visibleNodes: graphNodes.slice(startRow, endRow),
      totalHeight: graphNodes.length * ROW_HEIGHT,
    };
  }, [graphNodes, scrollTop, containerHeight]);

  // 监听容器大小变化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Canvas 渲染分支线
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = GRAPH_WIDTH;
    const height = Math.max(virtualData.totalHeight, containerHeight);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const startY = scrollTop;
    const endY = scrollTop + containerHeight;

    ctx.lineWidth = 2.5;

    // 绘制连接线（带发光效果）
    virtualData.visibleNodes.forEach((node, index) => {
      const actualIndex = virtualData.startRow + index;
      const nodeY = actualIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      
      if (nodeY < startY - ROW_HEIGHT || nodeY > endY + ROW_HEIGHT) return;

      const nodeX = node.column * COLUMN_WIDTH + COLUMN_WIDTH;

      // 绘制到父节点的连线
      node.parentColumns.forEach((parentCol) => {
        const parentNode = graphNodes.find(
          (n) => n.commit.oid === node.commit.parentIds[0] && n.column === parentCol
        );
        if (!parentNode) return;

        const parentIndex = graphNodes.indexOf(parentNode);
        const parentY = parentIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        const parentX = parentCol * COLUMN_WIDTH + COLUMN_WIDTH;

        ctx.strokeStyle = node.color;

        if (parentX === nodeX) {
          // 直线
          ctx.beginPath();
          ctx.moveTo(nodeX, nodeY + CIRCLE_RADIUS);
          ctx.lineTo(parentX, parentY - CIRCLE_RADIUS);
          ctx.stroke();
        } else {
          // Bezier 曲线连接
          ctx.beginPath();
          ctx.moveTo(nodeX, nodeY + CIRCLE_RADIUS);
          
          const midY = (nodeY + parentY) / 2;
          ctx.bezierCurveTo(
            nodeX, midY,
            parentX, midY,
            parentX, parentY - CIRCLE_RADIUS
          );
          ctx.stroke();
        }
      });

      // 如果是合并提交（多个父节点），从其他父节点画线
      node.commit.parentIds.slice(1).forEach((parentOid) => {
        const parentNode = graphNodes.find((n) => n.commit.oid === parentOid);
        if (!parentNode) return;

        const parentIndex = graphNodes.indexOf(parentNode);
        const parentY = parentIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        const parentX = parentNode.column * COLUMN_WIDTH + COLUMN_WIDTH;

        ctx.strokeStyle = parentNode.color;
        ctx.beginPath();
        ctx.moveTo(parentX, parentY + CIRCLE_RADIUS);
        
        const midY = (nodeY + parentY) / 2;
        ctx.bezierCurveTo(
          parentX, midY,
          nodeX, midY,
          nodeX, nodeY - CIRCLE_RADIUS
        );
        ctx.stroke();
      });
    });

    // 绘制节点圆点
    virtualData.visibleNodes.forEach((node, index) => {
      const actualIndex = virtualData.startRow + index;
      const nodeY = actualIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      
      if (nodeY < startY - ROW_HEIGHT || nodeY > endY + ROW_HEIGHT) return;

      const nodeX = node.column * COLUMN_WIDTH + COLUMN_WIDTH;
      const isSelected = selectedCommit === node.commit.oid;

      // 检测是否为 HEAD 提交（当前分支的最新提交）
      const isHead = node.commit.oid === graphNodes[0]?.commit.oid;
      
      // 检测是否为合并提交（多个父节点）
      const isMergeCommit = node.commit.parentIds.length > 1;

      // 绘制发光效果
      ctx.shadowBlur = isHead ? 12 : 6;
      ctx.shadowColor = node.color;

      if (isHead) {
        // HEAD 提交：空心圆 + 白色描边
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, CIRCLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        // 白色描边
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 内圈白色填充
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, CIRCLE_RADIUS - 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (isMergeCommit) {
        // 合并提交：双圆环效果
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, CIRCLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        // 外圈描边
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // 内圈（白色）
        ctx.shadowBlur = 0;
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, CIRCLE_RADIUS - 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 普通提交：实心圆
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, isSelected ? CIRCLE_RADIUS + 2 : CIRCLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        // 选中高亮
        if (isSelected) {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      
      // 重置阴影
      ctx.shadowBlur = 0;
    });
  }, [virtualData, selectedCommit, scrollTop, containerHeight, graphNodes]);

  // 处理滚动
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop);
  }, []);

  // 右键菜单
  const { showContextMenu, ContextMenuWrapper } = useContextMenu(() => {
    const items: MenuItem[] = [
      {
        id: 'create-branch',
        label: t('contextMenu.createBranch') + ' (Ctrl+Shift+B)',
        onClick: () => selectedCommit && onCreateBranch?.(selectedCommit),
      },
      {
        id: 'create-tag',
        label: t('contextMenu.createTag') + ' (Ctrl+Shift+T)',
        onClick: () => selectedCommit && onCreateTag?.(selectedCommit),
      },
      { id: 'divider1', label: '', divider: true },
      {
        id: 'interactive-rebase',
        label: 'Interactive Rebase',
        children: [
          {
            id: 'reword',
            label: 'Reword',
            onClick: () => selectedCommit && onInteractiveRebase?.(selectedCommit, 'reword'),
          },
          {
            id: 'squash',
            label: 'Squash',
            onClick: () => selectedCommit && onInteractiveRebase?.(selectedCommit, 'squash'),
          },
          {
            id: 'fixup',
            label: 'Fixup',
            onClick: () => selectedCommit && onInteractiveRebase?.(selectedCommit, 'fixup'),
          },
          { id: 'divider-rebase', label: '', divider: true },
          {
            id: 'drop',
            label: 'Drop',
            onClick: () => selectedCommit && onInteractiveRebase?.(selectedCommit, 'drop'),
          },
        ],
      },
      {
        id: 'reset',
        label: t('contextMenu.resetToHere'),
        onClick: () => selectedCommit && onReset?.(selectedCommit),
      },
      { id: 'divider2', label: '', divider: true },
      {
        id: 'checkout',
        label: t('contextMenu.checkoutCommit'),
        onClick: () => selectedCommit && onCheckout?.(selectedCommit),
      },
      {
        id: 'cherry-pick',
        label: t('contextMenu.cherrypick'),
        onClick: () => selectedCommit && onCherryPick?.(selectedCommit),
      },
      {
        id: 'revert',
        label: t('contextMenu.revert'),
        onClick: () => selectedCommit && onRevert?.(selectedCommit),
      },
      { id: 'divider3', label: '', divider: true },
      {
        id: 'save-patch',
        label: t('contextMenu.saveAsPatch'),
        onClick: () => selectedCommit && onSavePatch?.(selectedCommit),
      },
      {
        id: 'copy-sha',
        label: t('contextMenu.copyCommitSHA') + ' (Ctrl+C)',
        onClick: () => {
          if (selectedCommit) {
            navigator.clipboard.writeText(selectedCommit);
          }
        },
      },
      {
        id: 'copy-info',
        label: t('contextMenu.copyCommitInfo'),
        onClick: () => {
          if (selectedCommit) {
            const commit = commits.find((c) => c.oid === selectedCommit);
            if (commit) {
              navigator.clipboard.writeText(
                `${commit.oid}\n${commit.message}\n${commit.authorName} <${commit.authorEmail}>`
              );
            }
          }
        },
      },
    ];
    return items;
  });

  if (commits.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <p className="text-sm">{t('commitGraph.noCommits')}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* 左侧图区域 */}
      <div
        className="relative flex-shrink-0 bg-[#1e1e1e] border-r border-[#3c3c3c] overflow-hidden"
        style={{ width: GRAPH_WIDTH }}
      >
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-hidden"
          onScroll={handleScroll}
        >
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0"
          />
        </div>
      </div>

      {/* 右侧提交信息区域 */}
      <div
        className="flex-1 overflow-y-auto relative"
        onScroll={handleScroll}
      >
        <div
          className="relative"
          style={{ height: virtualData.totalHeight }}
        >
          {virtualData.visibleNodes.map((node, index) => {
            const actualIndex = virtualData.startRow + index;
            const isSelected = selectedCommit === node.commit.oid;
            const nodeX = node.column * COLUMN_WIDTH + COLUMN_WIDTH;

            return (
              <div
                key={node.commit.oid}
                data-index={actualIndex}
                onClick={() => onCommitSelect?.(node.commit.oid)}
                onContextMenu={showContextMenu}
                className={`
                  absolute left-0 right-0 flex items-center cursor-pointer
                  transition-colors border-b border-[#2a2a2a]
                  ${isSelected ? 'bg-[#094771]' : 'hover:bg-[#2a2d2e]'}
                `}
                style={{
                  top: actualIndex * ROW_HEIGHT,
                  height: ROW_HEIGHT,
                  paddingLeft: GRAPH_WIDTH + 12,
                  paddingRight: 12,
                }}
              >
                {/* SHA */}
                <span 
                  className="font-mono text-xs text-[#5799da] flex-shrink-0 mr-3"
                  style={{ minWidth: 60 }}
                >
                  {node.commit.shortOid}
                </span>

                {/* 提交消息 */}
                <span className="flex-1 text-sm text-gray-200 truncate mr-3">
                  {node.commit.message}
                </span>

                {/* Refs 标签 */}
                {node.refs.length > 0 && (
                  <div className="flex items-center gap-1 mr-3 flex-shrink-0">
                    {node.refs.map((ref) => {
                      const isBranch = branches.some((b) => b.name === ref);
                      const isCurrent = ref === currentBranch;
                      const colorIndex = node.column % BRANCH_COLORS.length;
                      const color = BRANCH_COLORS[colorIndex];
                      
                      return (
                        <span
                          key={ref}
                          className={`
                            px-1.5 py-0.5 rounded text-xs font-medium
                            ${isCurrent ? 'font-bold' : ''}
                          `}
                          style={{
                            backgroundColor: isCurrent ? color : `${color}33`,
                            color: isCurrent ? '#fff' : color,
                          }}
                        >
                          {ref}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* 作者头像 */}
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mr-2"
                  style={{
                    backgroundColor: getAvatarColor(node.commit.authorEmail),
                  }}
                >
                  {node.commit.authorName.charAt(0).toUpperCase()}
                </div>

                {/* 作者名 */}
                <span className="text-xs text-gray-400 truncate flex-shrink-0 mr-3" style={{ maxWidth: 100 }}>
                  {node.commit.authorName}
                </span>

                {/* 时间 */}
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {formatRelativeTime(node.commit.authorTimestamp)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {ContextMenuWrapper}
    </div>
  );
}

/**
 * 获取头像背景色
 */
function getAvatarColor(email: string): string {
  const colors = [
    '#5799da', '#7dce82', '#e2a855', '#b47ccf',
    '#52c4e8', '#e85d75', '#72d6c9', '#f0c674',
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default CommitGraph;
