/**
 * 提交图组件 (Fork 风格)
 * 提交图和信息在同一行，左侧彩色分支线区域 + 右侧提交信息
 * 支持选中提交展开详情、右键菜单、refs 标签显示
 * 支持可折叠合并提交功能
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
  /** 折叠状态变更回调 - 用于同步 CommitList */
  onCollapseChange?: (collapsedOids: Set<string>, visibleCommits: GitCommit[]) => void;
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
const COLLAPSED_NODE_SIZE = 8; // 折叠节点的尺寸
const GRAPH_WIDTH = 120; // 左侧图区域宽度

interface RefInfo {
  name: string;
  type: 'branch' | 'tag';
  isHead?: boolean;
}

/**
 * 计算折叠分支中被跳过的提交数量
 */
function countCollapsedCommits(
  mergeOid: string,
  allCommits: GitCommit[],
  collapsedOids: Set<string>
): number {
  const mergeCommit = allCommits.find(c => c.oid === mergeOid);
  if (!mergeCommit || mergeCommit.parentIds.length <= 1) return 0;

  // 第一个父提交是主线，其他是合并的分支
  const mainParentOid = mergeCommit.parentIds[0];
  const branchParentOids = mergeCommit.parentIds.slice(1);

  let count = 0;
  const visited = new Set<string>();

  // 遍历每个被合并的分支上的提交
  for (const parentOid of branchParentOids) {
    const stack = [parentOid];
    while (stack.length > 0) {
      const oid = stack.pop()!;
      if (visited.has(oid) || oid === mainParentOid) continue;
      visited.add(oid);

      // 检查这个提交是否会被折叠（如果父提交也是合并且已折叠）
      const commit = allCommits.find(c => c.oid === oid);
      if (commit) {
        // 如果这个提交本身是一个折叠的合并提交的子提交，说明它已经被计入了
        if (!collapsedOids.has(oid)) {
          // 检查是否有其他父提交不在被折叠的分支中
          const hasVisibleParent = commit.parentIds.some(pid => 
            !visited.has(pid) && pid !== oid
          );
          if (!hasVisibleParent && commit.parentIds.length > 0) {
            // 所有父提交都在折叠链中
            count++;
            // 将这个提交的父提交加入栈
            commit.parentIds.forEach(pid => {
              if (!visited.has(pid)) {
                stack.push(pid);
              }
            });
          } else if (hasVisibleParent) {
            // 这个提交有可见的父提交，不计数
          }
        }
      }
    }
  }

  return count;
}

/**
 * 获取折叠分支上所有被隐藏的提交 OID
 */
function getCollapsedCommitOids(
  mergeOid: string,
  allCommits: GitCommit[]
): Set<string> {
  const mergeCommit = allCommits.find(c => c.oid === mergeOid);
  if (!mergeCommit || mergeCommit.parentIds.length <= 1) return new Set();

  const collapsedOids = new Set<string>();
  const mainParentOid = mergeCommit.parentIds[0];
  const branchParentOids = mergeCommit.parentIds.slice(1);

  const visited = new Set<string>();

  // 遍历每个被合并的分支上的提交
  for (const parentOid of branchParentOids) {
    const stack = [parentOid];
    while (stack.length > 0) {
      const oid = stack.pop()!;
      if (visited.has(oid) || oid === mainParentOid) continue;
      visited.add(oid);

      const commit = allCommits.find(c => c.oid === oid);
      if (commit) {
        // 检查是否所有父提交都已被访问（说明这是分支上的叶子节点）
        const allParentsVisited = commit.parentIds.every(
          pid => pid === oid || visited.has(pid) || pid === mainParentOid
        );
        
        if (allParentsVisited && commit.parentIds.length > 0) {
          collapsedOids.add(oid);
          // 将这个提交的父提交加入栈（如果还不是主线的）
          commit.parentIds.forEach(pid => {
            if (!visited.has(pid) && pid !== mainParentOid) {
              stack.push(pid);
            }
          });
        }
      }
    }
  }

  return collapsedOids;
}

/**
 * 生成提交图节点（支持折叠状态）
 */
function buildGraphNodes(
  commits: GitCommit[],
  branches: GitBranch[],
  collapsedOids: Set<string>
): { nodes: GraphNode[]; visibleCommitOids: Set<string> } {
  if (commits.length === 0) return { nodes: [], visibleCommitOids: new Set() };

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

  // 计算所有可见的提交 OID
  const visibleCommitOids = new Set<string>();
  const collapsedBranchOids = new Set<string>(); // 被折叠的合并提交的分支提交

  // 首先处理所有折叠的合并提交
  collapsedOids.forEach(mergeOid => {
    const childCollapsed = getCollapsedCommitOids(mergeOid, commits);
    childCollapsed.forEach(oid => collapsedBranchOids.add(oid));
  });

  // 所有提交都是可见的，但渲染时会跳过折叠分支的提交
  commits.forEach(c => visibleCommitOids.add(c.oid));

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
    
    // 如果这个提交属于折叠的分支，记录其映射关系但仍然分配列
    const isInCollapsedBranch = collapsedBranchOids.has(commit.oid);
    
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
      isCollapsed: isInCollapsedBranch,
    });
  }

  return { nodes, visibleCommitOids };
}

/**
 * 获取 refs 标签的颜色
 */
function getRefColor(ref: string, branches: GitBranch[]): string {
  const branch = branches.find((b) => b.name === ref);
  if (branch) {
    return BRANCH_COLORS[0]; // 默认颜色
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
  onCollapseChange,
}: CommitGraphProps) {
  const { t } = useI18();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  
  // 折叠状态管理
  const [collapsedMergeOids, setCollapsedMergeOids] = useState<Set<string>>(new Set());
  
  // 右键菜单选中的合并提交
  const [contextMenuMergeCommit, setContextMenuMergeCommit] = useState<GitCommit | null>(null);

  // 构建图数据
  useEffect(() => {
    const { nodes } = buildGraphNodes(commits, branches, collapsedMergeOids);
    setGraphNodes(nodes);
    
    // 计算可见提交列表
    const collapsedBranchOids = new Set<string>();
    collapsedMergeOids.forEach(mergeOid => {
      const childCollapsed = getCollapsedCommitOids(mergeOid, commits);
      childCollapsed.forEach(oid => collapsedBranchOids.add(oid));
    });
    
    const visibleCommits = commits.filter(c => !collapsedBranchOids.has(c.oid));
    onCollapseChange?.(collapsedMergeOids, visibleCommits);
  }, [commits, branches, collapsedMergeOids]);

  // 折叠/展开合并提交
  const toggleCollapse = useCallback((mergeOid: string) => {
    setCollapsedMergeOids(prev => {
      const next = new Set(prev);
      if (next.has(mergeOid)) {
        next.delete(mergeOid);
      } else {
        next.add(mergeOid);
      }
      return next;
    });
  }, []);

  // 折叠所有合并提交
  const collapseAllMerges = useCallback(() => {
    const mergeCommits = commits.filter(c => c.parentIds.length > 1);
    const allMergeOids = new Set(mergeCommits.map(c => c.oid));
    setCollapsedMergeOids(allMergeOids);
  }, [commits]);

  // 展开所有合并提交
  const expandAllMerges = useCallback(() => {
    setCollapsedMergeOids(new Set());
  }, []);

  // 获取折叠提示文本
  const getCollapseTooltip = (mergeOid: string): string => {
    const collapsedCount = countCollapsedCommits(mergeOid, commits, collapsedMergeOids);
    if (collapsedCount > 0) {
      return `${collapsedCount} ${t('collapse.commitsCollapsed')}`;
    }
    return '';
  };

  // 虚拟滚动计算
  const virtualData = useMemo(() => {
    // 过滤掉折叠分支的提交
    const collapsedBranchOids = new Set<string>();
    collapsedMergeOids.forEach(mergeOid => {
      const childCollapsed = getCollapsedCommitOids(mergeOid, commits);
      childCollapsed.forEach(oid => collapsedBranchOids.add(oid));
    });
    
    const filteredNodes = graphNodes.filter(n => !n.isCollapsed);
    
    const startRow = Math.floor(scrollTop / ROW_HEIGHT);
    const endRow = Math.min(
      startRow + Math.ceil(containerHeight / ROW_HEIGHT) + 2,
      filteredNodes.length
    );

    return {
      startRow,
      endRow,
      visibleNodes: filteredNodes.slice(startRow, endRow),
      totalHeight: filteredNodes.length * ROW_HEIGHT,
      collapsedBranchOids,
    };
  }, [graphNodes, scrollTop, containerHeight, collapsedMergeOids, commits]);

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
      
      if (nodeY < startY - ROW_HEIGHT * 2 || nodeY > endY + ROW_HEIGHT * 2) return;

      const nodeX = node.column * COLUMN_WIDTH + COLUMN_WIDTH;
      const isCollapsedMerge = collapsedMergeOids.has(node.commit.oid);

      // 绘制到主父节点的连接线
      if (((node.commit.parentIds?.length) ?? 0) > 0) {
        const mainParentOid = node.commit.parentIds[0];
        const parentNode = graphNodes.find(
          (n) => n.commit.oid === mainParentOid && n.column === node.column
        );

        if (parentNode && !parentNode.isCollapsed) {
          const parentIndex = graphNodes.indexOf(parentNode);
          // 计算过滤后的行号
          const filteredParentIndex = graphNodes.slice(0, parentIndex).filter(n => !n.isCollapsed).length;
          const parentY = filteredParentIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
          const parentX = parentNode.column * COLUMN_WIDTH + COLUMN_WIDTH;

          ctx.strokeStyle = node.color;
          ctx.shadowBlur = 4;
          ctx.shadowColor = node.color;

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
        } else if (isCollapsedMerge) {
          // 折叠合并提交 - 画到主线
          ctx.strokeStyle = node.color;
          ctx.shadowBlur = 4;
          ctx.shadowColor = node.color;
          
          ctx.beginPath();
          ctx.moveTo(nodeX, nodeY + COLLAPSED_NODE_SIZE);
          ctx.lineTo(nodeX, nodeY + ROW_HEIGHT);
          ctx.stroke();
        }
      }

      // 如果是合并提交且未折叠，绘制到其他父节点的连接线
      if (((node.commit.parentIds?.length) ?? 0) > 1 && !isCollapsedMerge) {
        node.commit.parentIds.slice(1).forEach((parentOid) => {
          const parentNode = graphNodes.find((n) => n.commit.oid === parentOid && !n.isCollapsed);
          if (!parentNode) return;

          const parentIndex = graphNodes.indexOf(parentNode);
          const filteredParentIndex = graphNodes.slice(0, parentIndex).filter(n => !n.isCollapsed).length;
          const parentY = filteredParentIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
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
      }

      ctx.shadowBlur = 0;
    });

    // 绘制节点圆点
    virtualData.visibleNodes.forEach((node, index) => {
      const actualIndex = virtualData.startRow + index;
      const nodeY = actualIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      
      if (nodeY < startY - ROW_HEIGHT * 2 || nodeY > endY + ROW_HEIGHT * 2) return;

      const nodeX = node.column * COLUMN_WIDTH + COLUMN_WIDTH;
      const isSelected = selectedCommit === node.commit.oid;
      const isCollapsedMerge = collapsedMergeOids.has(node.commit.oid);

      // 检测是否为 HEAD 提交（当前分支的最新提交）
      const isHead = node.commit.oid === graphNodes.find(n => !n.isCollapsed)?.commit.oid;
      
      // 检测是否为合并提交（多个父节点）
      const isMergeCommit = ((node.commit.parentIds?.length) ?? 0) > 1;

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
      } else if (isCollapsedMerge) {
        // 折叠的合并提交：菱形
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.moveTo(nodeX, nodeY - COLLAPSED_NODE_SIZE);
        ctx.lineTo(nodeX + COLLAPSED_NODE_SIZE, nodeY);
        ctx.lineTo(nodeX, nodeY + COLLAPSED_NODE_SIZE);
        ctx.lineTo(nodeX - COLLAPSED_NODE_SIZE, nodeY);
        ctx.closePath();
        ctx.fill();
        
        // 白色描边
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // + 号表示可展开
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(nodeX - 4, nodeY);
        ctx.lineTo(nodeX + 4, nodeY);
        ctx.moveTo(nodeX, nodeY - 4);
        ctx.lineTo(nodeX, nodeY + 4);
        ctx.stroke();
      } else if (isMergeCommit) {
        // 合并提交（未折叠）：双圆环效果
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, CIRCLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        // 外圈描边
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // 内圈（带 - 号表示可折叠）
        ctx.shadowBlur = 0;
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, CIRCLE_RADIUS - 3, 0, Math.PI * 2);
        ctx.fill();
        
        // - 号表示可折叠
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(nodeX - 3, nodeY);
        ctx.lineTo(nodeX + 3, nodeY);
        ctx.stroke();
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
  }, [virtualData, selectedCommit, scrollTop, containerHeight, graphNodes, collapsedMergeOids]);

  // 处理滚动
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop);
  }, []);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCommit) return;
      
      const selectedNode = graphNodes.find(n => n.commit.oid === selectedCommit);
      if (!selectedNode) return;
      
      const isMergeCommit = (selectedNode?.commit.parentIds?.length ?? 0) > 1;
      const isCollapsed = collapsedMergeOids.has(selectedCommit);
      
      if (e.key === 'ArrowLeft' && isMergeCommit && !isCollapsed) {
        // 按左方向键折叠
        e.preventDefault();
        toggleCollapse(selectedCommit);
      } else if (e.key === 'ArrowRight' && isCollapsed) {
        // 按右方向键展开
        e.preventDefault();
        toggleCollapse(selectedCommit);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCommit, graphNodes, collapsedMergeOids, toggleCollapse]);

  // 右键菜单
  const { showContextMenu, ContextMenuWrapper } = useContextMenu(() => {
    const selectedNode = selectedCommit ? graphNodes.find(n => n.commit.oid === selectedCommit) : null;
    const selectedCommitData = selectedNode?.commit;
    const isMergeCommit = selectedCommitData ? selectedCommitData.parentIds.length > 1 : false;
    const isCollapsed = selectedCommit ? collapsedMergeOids.has(selectedCommit) : false;
    
    const items: MenuItem[] = [];

    // 添加折叠/展开选项（如果是合并提交）
    if (isMergeCommit) {
      if (isCollapsed) {
        items.push({
          id: 'expand-branch',
          label: t('collapse.expandBranch'),
          onClick: () => selectedCommit && toggleCollapse(selectedCommit),
        });
      } else {
        items.push({
          id: 'collapse-branch',
          label: t('collapse.collapseBranch'),
          onClick: () => selectedCommit && toggleCollapse(selectedCommit),
        });
      }
      items.push({ id: 'divider-collapse', label: '', divider: true });
    }

    // 添加折叠/展开所有选项
    const hasMerges = commits.some(c => c.parentIds.length > 1);
    if (hasMerges) {
      items.push({
        id: 'collapse-all',
        label: t('collapse.collapseAll'),
        onClick: collapseAllMerges,
      });
      items.push({
        id: 'expand-all',
        label: t('collapse.expandAll'),
        onClick: expandAllMerges,
      });
      items.push({ id: 'divider-collapse-all', label: '', divider: true });
    }

    // 其他菜单项
    items.push(
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
      }
    );
    return items;
  });

  // 处理节点点击（折叠/展开）
  const handleNodeClick = useCallback((node: GraphNode, e: React.MouseEvent) => {
    const isMergeCommit = ((node.commit.parentIds?.length) ?? 0) > 1;
    const isCollapsed = collapsedMergeOids.has(node.commit.oid);
    
    if (isMergeCommit) {
      // 双击或 Ctrl+单击切换折叠状态
      if (e.detail === 2 || e.ctrlKey) {
        toggleCollapse(node.commit.oid);
        return;
      }
    }
    
    onCommitSelect?.(node.commit.oid);
  }, [collapsedMergeOids, toggleCollapse, onCommitSelect]);

  // 鼠标悬停提示
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + scrollTop;

    // 检查是否悬停在折叠的合并节点上
    for (const node of virtualData.visibleNodes) {
      if (!collapsedMergeOids.has(node.commit.oid)) continue;
      
      const nodeX = node.column * COLUMN_WIDTH + COLUMN_WIDTH;
      const nodeY = (virtualData.startRow + virtualData.visibleNodes.indexOf(node)) * ROW_HEIGHT + ROW_HEIGHT / 2;
      
      const dist = Math.sqrt((x - nodeX) ** 2 + (y - nodeY) ** 2);
      if (dist < COLLAPSED_NODE_SIZE + 5) {
        const tooltipText = getCollapseTooltip(node.commit.oid);
        if (tooltipText) {
          setTooltip({ x: e.clientX, y: e.clientY, text: tooltipText });
          return;
        }
      }
    }
    
    setTooltip(null);
  }, [virtualData, collapsedMergeOids, scrollTop]);

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
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
          />
        </div>
        
        {/* 折叠提示 Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 bg-[#3c3c3c] text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none"
            style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}
          >
            {tooltip.text}
          </div>
        )}
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
            const isCollapsed = collapsedMergeOids.has(node.commit.oid);
            const isMergeCommit = ((node.commit.parentIds?.length) ?? 0) > 1;
            const collapsedCount = isCollapsed ? countCollapsedCommits(node.commit.oid, commits, collapsedMergeOids) : 0;

            return (
              <div
                key={node.commit.oid}
                data-index={actualIndex}
                onClick={(e) => handleNodeClick(node, e)}
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
                {/* 折叠指示器 */}
                {isCollapsed && (
                  <span className="absolute left-2 flex items-center gap-1 text-xs text-gray-400">
                    <span className="text-yellow-400">◆</span>
                    <span className="text-yellow-500">({collapsedCount})</span>
                  </span>
                )}

                {/* SHA */}
                <span 
                  className={`font-mono text-xs flex-shrink-0 mr-3 ${
                    isCollapsed ? 'text-yellow-500' : 'text-[#5799da]'
                  }`}
                  style={{ minWidth: 60 }}
                >
                  {node.commit.shortOid}
                </span>

                {/* 提交消息 */}
                <span className={`flex-1 text-sm truncate mr-3 ${
                  isCollapsed ? 'text-gray-400' : 'text-gray-200'
                }`}>
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

                {/* 合并提交标记 */}
                {isMergeCommit && !isCollapsed && (
                  <span className="text-xs text-gray-500 mr-2 flex-shrink-0">
                    ↙{((node.commit.parentIds?.length) ?? 0) - 1}
                  </span>
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
