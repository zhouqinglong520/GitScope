import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRepoStore, type GitCommit, type GitBranch } from '../../stores/repoStore';
import { useContextMenu, type MenuItem } from '../contextmenu/ContextMenu';

// ============================================================
// 常量
// ============================================================
const BRANCH_COLORS = [
  '#e05673', '#5b8def', '#68c263', '#c9a73c', '#a06cd5',
  '#3eb4c6', '#d4844e', '#e86580', '#7ec8e3', '#b5e48c',
];

const ROW_HEIGHT = 32;
const LANE_WIDTH = 22;
const NODE_RADIUS = 3.5;
const GRAPH_MIN_WIDTH = 120;
const VISIBLE_BUFFER = 20;

// ============================================================
// 类型
// ============================================================
interface GraphNode {
  commit: GitCommit;
  lane: number;
  color: string;
  row: number;
  isMainBranch: boolean;
  branchNames: string[];
  branchChildren: string[];
  mergeChildren: string[];
  isMergeCommit: boolean;
  collapsedCommitCount: number; // 折叠的被合并提交数（0=非折叠或无折叠）
  isCollapsed: boolean;        // 是否被折叠隐藏
  collapseParentOid: string | null; // 属于哪个 merge commit 的折叠组
}

interface EdgeInfo {
  fromOid: string;
  toOid: string;
  fromLane: number;
  toLane: number;
  fromRow: number;
  toRow: number;
  color: string;
  isMergeEdge: boolean;
  isCollapsed: boolean; // 是否是折叠虚线
}

// ============================================================
// 算法核心：pvigier 直线分支算法 + 可折叠合并提交
// ============================================================

function temporalTopologicalSort(
  commits: GitCommit[],
  childMap: Map<string, string[]>
): GitCommit[] {
  const oidSet = new Set(commits.map(c => c.oid));
  const sorted = [...commits].sort((a, b) => b.committerTimestamp - a.committerTimestamp);
  const explored = new Set<string>();
  const result: GitCommit[] = [];
  const commitMap = new Map(sorted.map(c => [c.oid, c]));

  function dfs(oid: string) {
    if (explored.has(oid) || !oidSet.has(oid)) return;
    explored.add(oid);
    const children = childMap.get(oid);
    if (children) { for (const childOid of children) dfs(childOid); }
    const commit = commitMap.get(oid);
    if (commit) result.push(commit);
  }

  for (const c of sorted) dfs(c.oid);
  return result;
}

function buildChildMap(commits: GitCommit[]): Map<string, string[]> {
  const childMap = new Map<string, string[]>();
  for (const c of commits) {
    for (const pOid of c.parentIds) {
      const children = childMap.get(pOid) || [];
      children.push(c.oid);
      childMap.set(pOid, children);
    }
  }
  return childMap;
}

/**
 * 计算被 merge commit 合入的提交（第二父节点的祖先链）
 * 返回 mergeOid → 被合并的 oid 列表
 */
function computeMergedCommits(
  sortedCommits: GitCommit[],
  childMap: Map<string, string[]>,
  oidToRow: Map<string, number>
): Map<string, string[]> {
  const mergeToMerged = new Map<string, string[]>();
  const commitMap = new Map(sortedCommits.map(c => [c.oid, c]));

  for (const commit of sortedCommits) {
    if (commit.parentIds.length < 2) continue;

    // 第二父节点（被合入的分支）
    const secondParentOid = commit.parentIds[1];
    const firstParentOid = commit.parentIds[0];

    // 沿着第二父节点向下追溯，直到遇到第一父节点的祖先
    const firstAncestors = new Set<string>();
    let current: string | undefined = firstParentOid;
    let safety = 0;
    while (current && safety < 1000) {
      firstAncestors.add(current);
      const c = commitMap.get(current);
      if (!c) break;
      current = c.parentIds[0];
      safety++;
    }

    // 收集第二父节点链上不在第一父节点祖先中的提交
    const merged: string[] = [];
    current = secondParentOid;
    safety = 0;
    while (current && !firstAncestors.has(current) && safety < 1000) {
      merged.push(current);
      const c = commitMap.get(current);
      if (!c) break;
      current = c.parentIds[0];
      safety++;
    }

    mergeToMerged.set(commit.oid, merged);
  }

  return mergeToMerged;
}

function assignLanes(
  sortedCommits: GitCommit[],
  childMap: Map<string, string[]>,
  branches: GitBranch[],
  collapsedMergeOids: Set<string>
): { nodes: GraphNode[]; edges: EdgeInfo[]; maxLane: number; totalVisibleRows: number } {
  if (sortedCommits.length === 0) return { nodes: [], edges: [], maxLane: 0, totalVisibleRows: 0 };

  const branchMap = new Map<string, string[]>();
  for (const branch of branches) {
    if (branch.oid) {
      const list = branchMap.get(branch.oid) || [];
      list.push(branch.name);
      branchMap.set(branch.oid, list);
    }
  }

  const mainBranch = branches.find(b => b.name === 'main' || b.name === 'master' || b.current);
  const mainBranchOid = mainBranch?.oid;
  const nodeMap = new Map<string, GraphNode>();
  const activeBranches: (string | null)[] = [];
  const laneOccupiedRows: Map<number, Set<number>> = new Map();

  const branchChildrenMap = new Map<string, string[]>();
  const mergeChildrenMap = new Map<string, string[]>();

  for (const commit of sortedCommits) {
    const children = childMap.get(commit.oid) || [];
    const branchKids: string[] = [];
    const mergeKids: string[] = [];
    for (const childOid of children) {
      const childCommit = sortedCommits.find(c => c.oid === childOid);
      if (childCommit) {
        if (childCommit.parentIds[0] === commit.oid) branchKids.push(childOid);
        else mergeKids.push(childOid);
      }
    }
    branchChildrenMap.set(commit.oid, branchKids);
    mergeChildrenMap.set(commit.oid, mergeKids);
  }

  // 计算被合并的提交
  const oidToRow = new Map<string, number>();
  const mergeToMerged = computeMergedCommits(sortedCommits, childMap, oidToRow);

  // 标记折叠：哪些 oid 被折叠隐藏
  const collapsedOids = new Set<string>();
  for (const mergeOid of collapsedMergeOids) {
    const merged = mergeToMerged.get(mergeOid) || [];
    for (const oid of merged) collapsedOids.add(oid);
  }

  // 过滤掉折叠的提交，重新分配 row
  let visibleRow = 0;
  const rowMapping = new Map<string, number>(); // oid → visible row

  for (const commit of sortedCommits) {
    if (collapsedOids.has(commit.oid)) continue;
    rowMapping.set(commit.oid, visibleRow);
    visibleRow++;
  }

  const totalVisibleRows = visibleRow;

  // 逐行处理可见提交
  for (const commit of sortedCommits) {
    if (collapsedOids.has(commit.oid)) continue;

    const row = rowMapping.get(commit.oid)!;
    const branchKids = branchChildrenMap.get(commit.oid) || [];
    const mergeKids = mergeChildrenMap.get(commit.oid) || [];

    const forbiddenLanes = new Set<number>();
    for (const mergeChildOid of mergeKids) {
      if (collapsedOids.has(mergeChildOid)) continue;
      const childNode = nodeMap.get(mergeChildOid);
      if (childNode) {
        for (const [lane, rows] of laneOccupiedRows) {
          for (const r of rows) {
            if (r > childNode.row && r < row) { forbiddenLanes.add(lane); break; }
          }
        }
      }
    }

    let lane: number;
    let color: string;
    let inherited = false;

    for (const childOid of branchKids) {
      if (collapsedOids.has(childOid)) continue;
      const childNode = nodeMap.get(childOid);
      if (childNode && !forbiddenLanes.has(childNode.lane)) {
        lane = childNode.lane;
        color = childNode.color;
        const idx = activeBranches.indexOf(childOid);
        if (idx !== -1) activeBranches[idx] = commit.oid;
        else activeBranches.push(commit.oid);
        inherited = true;
        break;
      }
    }

    if (!inherited) {
      let nilIdx = activeBranches.indexOf(null);
      if (nilIdx !== -1) { lane = nilIdx; activeBranches[nilIdx] = commit.oid; }
      else { lane = activeBranches.length; activeBranches.push(commit.oid); }
      color = BRANCH_COLORS[lane % BRANCH_COLORS.length];
    }

    for (const childOid of branchKids) {
      if (collapsedOids.has(childOid)) continue;
      const childNode = nodeMap.get(childOid);
      if (childNode && childNode.lane !== lane!) {
        const idx = activeBranches.indexOf(childOid);
        if (idx !== -1) activeBranches[idx] = null;
      }
    }

    const isMainBranch = mainBranchOid === commit.oid || lane! === 0;
    if (isMainBranch) color = BRANCH_COLORS[0];

    const isMergeCommit = commit.parentIds.length > 1;
    const mergedCount = isMergeCommit ? (mergeToMerged.get(commit.oid) || []).length : 0;
    // 只统计被折叠的提交数
    const collapsedCommitCount = isMergeCommit && collapsedMergeOids.has(commit.oid)
      ? (mergeToMerged.get(commit.oid) || []).filter(oid => collapsedOids.has(oid)).length
      : 0;

    const node: GraphNode = {
      commit,
      lane: lane!,
      color: color!,
      row,
      isMainBranch,
      branchNames: branchMap.get(commit.oid) || [],
      branchChildren: branchKids,
      mergeChildren: mergeKids,
      isMergeCommit,
      collapsedCommitCount,
      isCollapsed: false,
      collapseParentOid: null,
    };
    nodeMap.set(commit.oid, node);

    if (!laneOccupiedRows.has(lane!)) laneOccupiedRows.set(lane!, new Set());
    laneOccupiedRows.get(lane!)!.add(row);
  }

  const nodes = sortedCommits
    .filter(c => !collapsedOids.has(c.oid))
    .map(c => nodeMap.get(c.oid)!)
    .filter(Boolean);

  const edges: EdgeInfo[] = [];

  for (const node of nodes) {
    for (let pIdx = 0; pIdx < node.commit.parentIds.length; pIdx++) {
      const parentOid = node.commit.parentIds[pIdx];
      
      if (collapsedOids.has(parentOid)) {
        // 父节点被折叠 — 找到折叠的 merge commit，画虚线到它
        // 沿着折叠链向上找到可见的祖先
        let ancestorOid = parentOid;
        while (collapsedOids.has(ancestorOid)) {
          const ancestorCommit = sortedCommits.find(c => c.oid === ancestorOid);
          if (!ancestorCommit) break;
          ancestorOid = ancestorCommit.parentIds[0]; // 沿第一父节点向上
        }
        const ancestorNode = nodeMap.get(ancestorOid);
        if (ancestorNode) {
          edges.push({
            fromOid: node.commit.oid,
            toOid: ancestorOid,
            fromLane: node.lane,
            toLane: ancestorNode.lane,
            fromRow: node.row,
            toRow: ancestorNode.row,
            color: node.color,
            isMergeEdge: pIdx > 0,
            isCollapsed: true,
          });
        }
        continue;
      }
      
      const parentNode = nodeMap.get(parentOid);
      if (!parentNode) continue;

      edges.push({
        fromOid: node.commit.oid,
        toOid: parentOid,
        fromLane: node.lane,
        toLane: parentNode.lane,
        fromRow: node.row,
        toRow: parentNode.row,
        color: node.isMergeCommit && pIdx > 0 ? parentNode.color : node.color,
        isMergeEdge: pIdx > 0,
        isCollapsed: false,
      });
    }
  }

  const maxLane = nodes.length > 0 ? Math.max(...nodes.map(n => n.lane)) : 0;
  return { nodes, edges, maxLane, totalVisibleRows };
}

// ============================================================
// 工具函数
// ============================================================

function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}个月前`;
  return `${Math.floor(diff / 31536000)}年前`;
}

function getAvatarColor(email: string): string {
  const colors = ['#5799da', '#7dce82', '#e2a855', '#b47ccf', '#52c4e8', '#e85d75', '#72d6c9', '#f0c674'];
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ============================================================
// 主组件
// ============================================================

function CommitGraph({
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
  commits: externalCommits,
  branches: externalBranches,
  currentBranch: externalCurrentBranch,
}: {
  selectedCommit?: string | null;
  onCommitSelect?: (oid: string | null) => void;
  onCreateBranch?: (oid: string) => void;
  onCreateTag?: (oid: string) => void;
  onReset?: (oid: string) => void;
  onCheckout?: (oid: string) => void;
  onCherryPick?: (oid: string) => void;
  onRevert?: (oid: string) => void;
  onSavePatch?: (oid: string) => void;
  onInteractiveRebase?: (oid: string, action: 'squash' | 'fixup' | 'reword' | 'drop') => void;
  commits?: GitCommit[];
  branches?: GitBranch[];
  currentBranch?: string;
}) {
  const store = useRepoStore();
  const commits = externalCommits || store.commits;
  const branches = externalBranches || store.branches;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800);

  // ===== 可折叠合并提交状态 =====
  const [collapsedMergeOids, setCollapsedMergeOids] = useState<Set<string>>(new Set());
  // 默认折叠所有 merge commit
  const [autoCollapse, setAutoCollapse] = useState(true);

  // 初始化时自动折叠
  useEffect(() => {
    if (autoCollapse && commits.length > 0) {
      const mergeOids = new Set<string>();
      for (const c of commits) {
        if (c.parentIds.length > 1) mergeOids.add(c.oid);
      }
      setCollapsedMergeOids(mergeOids);
      setAutoCollapse(false);
    }
  }, [commits, autoCollapse]);

  const toggleCollapse = useCallback((mergeOid: string) => {
    setCollapsedMergeOids(prev => {
      const next = new Set(prev);
      if (next.has(mergeOid)) next.delete(mergeOid);
      else next.add(mergeOid);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsedMergeOids(new Set()), []);
  const collapseAll = useCallback(() => {
    const mergeOids = new Set<string>();
    for (const c of commits) { if (c.parentIds.length > 1) mergeOids.add(c.oid); }
    setCollapsedMergeOids(mergeOids);
  }, [commits]);

  // ========== 图计算 ==========
  const { graphNodes, edges, graphWidth, totalVisibleRows } = useMemo(() => {
    if (commits.length === 0) return { graphNodes: [] as GraphNode[], edges: [] as EdgeInfo[], graphWidth: GRAPH_MIN_WIDTH, totalVisibleRows: 0 };

    const childMap = buildChildMap(commits);
    const sorted = temporalTopologicalSort(commits, childMap);
    const result = assignLanes(sorted, childMap, branches, collapsedMergeOids);
    const w = Math.max(GRAPH_MIN_WIDTH, (result.maxLane + 1) * LANE_WIDTH + 20);
    return { graphNodes: result.nodes, edges: result.edges, graphWidth: w, totalVisibleRows: result.totalVisibleRows };
  }, [commits, branches, collapsedMergeOids]);

  const totalHeight = totalVisibleRows * ROW_HEIGHT;

  // ========== 监听容器尺寸 ==========
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) setContainerHeight(entry.contentRect.height);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ========== Canvas 绘制 ==========
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const firstVisibleRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_BUFFER);
    const lastVisibleRow = Math.min(graphNodes.length - 1, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VISIBLE_BUFFER);

    canvas.width = graphWidth * dpr;
    canvas.height = containerHeight * dpr;
    canvas.style.width = `${graphWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, graphWidth, containerHeight);

    const nodeMap = new Map(graphNodes.map(n => [n.commit.oid, n]));

    // 1. 绘制连线
    for (const edge of edges) {
      if (edge.fromRow > lastVisibleRow && edge.toRow > lastVisibleRow) continue;
      if (edge.fromRow < firstVisibleRow && edge.toRow < firstVisibleRow) continue;

      const fromX = edge.fromLane * LANE_WIDTH + LANE_WIDTH / 2;
      const fromY = edge.fromRow * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop;
      const toX = edge.toLane * LANE_WIDTH + LANE_WIDTH / 2;
      const toY = edge.toRow * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop;

      if (fromY < -100 && toY < -100) continue;
      if (fromY > containerHeight + 100 && toY > containerHeight + 100) continue;

      ctx.strokeStyle = edge.color;
      ctx.lineWidth = edge.isMergeEdge ? 1.4 : 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 折叠虚线
      if (edge.isCollapsed) {
        ctx.setLineDash([3, 3]);
        ctx.globalAlpha = 0.5;
      } else {
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      if (edge.fromLane === edge.toLane) {
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
      } else {
        const dy = toY - fromY;
        const ctrlOffset = Math.min(Math.abs(dy) * 0.4, 16);
        ctx.moveTo(fromX, fromY);
        ctx.bezierCurveTo(fromX, fromY + ctrlOffset, toX, toY - ctrlOffset, toX, toY);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // 2. 绘制节点
    for (let row = firstVisibleRow; row <= lastVisibleRow; row++) {
      if (row < 0 || row >= graphNodes.length) continue;
      const node = graphNodes[row];
      const x = node.lane * LANE_WIDTH + LANE_WIDTH / 2;
      const y = row * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop;

      // 合并提交用双圈
      if (node.isMergeCommit) {
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS + 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e1e1e';
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS - 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      // 白色细边框
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(x, y, node.isMergeCommit ? NODE_RADIUS + 1.5 : NODE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      // HEAD 标记
      if (node.branchNames.some(b => branches.find(br => br.current && br.name === b))) {
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, (node.isMergeCommit ? NODE_RADIUS + 1.5 : NODE_RADIUS) + 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, [graphNodes, edges, graphWidth, scrollTop, containerHeight, branches]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // ========== 右键菜单 ==========
  const [contextMenuItems, setContextMenuItems] = useState<MenuItem[]>([]);
  const [contextMenuOid, setContextMenuOid] = useState<string | null>(null);
  const { showContextMenu, ContextMenuWrapper } = useContextMenu(() => contextMenuOid ? contextMenuItems : []);

  const handleContextMenu = (e: React.MouseEvent, oid: string) => {
    e.preventDefault();
    setContextMenuOid(oid);
    const node = graphNodes.find(n => n.commit.oid === oid);
    const isMerge = node?.isMergeCommit;
    const isCollapsed = collapsedMergeOids.has(oid);

    setContextMenuItems([
      { id: 'checkout', label: '检出此提交', onClick: () => onCheckout?.(oid) },
      { id: 'divider-1', label: '', divider: true },
      { id: 'create-branch', label: '从此创建分支...', onClick: () => onCreateBranch?.(oid) },
      { id: 'create-tag', label: '从此创建标签...', onClick: () => onCreateTag?.(oid) },
      { id: 'divider-2', label: '', divider: true },
      ...(isMerge ? [{
        id: 'toggle-collapse',
        label: isCollapsed ? '展开合并提交' : '折叠合并提交',
        onClick: () => toggleCollapse(oid),
      }] : []),
      { id: 'divider-3', label: '', divider: true },
      { id: 'reset', label: '重置到此处', onClick: () => onReset?.(oid) },
      { id: 'divider-4', label: '', divider: true },
      { id: 'cherry-pick', label: 'Cherry-pick', onClick: () => onCherryPick?.(oid) },
      { id: 'revert', label: 'Revert', onClick: () => onRevert?.(oid) },
      { id: 'divider-5', label: '', divider: true },
      { id: 'save-patch', label: '保存为 Patch...', onClick: () => onSavePatch?.(oid) },
    ]);
    showContextMenu(e);
  };

  // ========== 可见行计算 ==========
  const firstVisibleRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_BUFFER);
  const lastVisibleRow = Math.min(graphNodes.length - 1, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VISIBLE_BUFFER);

  return (
    <div className="h-full flex flex-col">
      {/* 表头 */}
      <div className="px-3 py-1.5 border-b border-panel-border bg-[#1e1e1e] flex items-center text-xs text-gray-400 flex-shrink-0">
        <span style={{ width: graphWidth }} className="flex-shrink-0" />
        <span className="flex-1">提交</span>
        <span className="w-24 flex-shrink-0 text-right">作者</span>
        <span className="w-20 flex-shrink-0 text-right">日期</span>
        {/* 折叠控制 */}
        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-[#3c3c3c]">
          <button className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 hover:bg-[#3c3c3c] rounded" onClick={expandAll} title="展开所有">展开</button>
          <button className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 hover:bg-[#3c3c3c] rounded" onClick={collapseAll} title="折叠所有">折叠</button>
        </div>
      </div>

      {/* 滚动区域 */}
      <div ref={containerRef} className="flex-1 overflow-y-auto bg-[#1e1e1e]" onScroll={handleScroll}>
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* 左侧分支图 Canvas */}
          <div className="sticky left-0 top-0 z-10" style={{ width: graphWidth, height: totalHeight, backgroundColor: '#1e1e1e', borderRight: '1px solid #3c3c3c' }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
          </div>

          {/* 提交记录列表 */}
          {graphNodes.slice(firstVisibleRow, lastVisibleRow + 1).map((node) => {
            const isSelected = selectedCommit === node.commit.oid;
            const isCollapsed = collapsedMergeOids.has(node.commit.oid);

            return (
              <div
                key={node.commit.oid}
                onClick={() => onCommitSelect?.(node.commit.oid)}
                onContextMenu={(e) => handleContextMenu(e, node.commit.oid)}
                className={`absolute left-0 right-0 flex items-center px-3 cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#2d2d30]' : 'hover:bg-[#2a2d2e]'
                }`}
                style={{ top: node.row * ROW_HEIGHT, height: ROW_HEIGHT, paddingLeft: graphWidth + 12, paddingRight: 12 }}
              >
                <span className="font-mono text-xs text-[#61afef] flex-shrink-0 mr-3" style={{ minWidth: 55 }}>
                  {node.commit.shortOid}
                </span>

                {/* 折叠指示器 */}
                {node.isMergeCommit && (
                  <button
                    className={`flex-shrink-0 mr-1.5 w-4 h-4 flex items-center justify-center rounded text-[10px] ${
                      isCollapsed ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-700 text-gray-400'
                    } hover:bg-[#4f4f4f]`}
                    onClick={(e) => { e.stopPropagation(); toggleCollapse(node.commit.oid); }}
                    title={isCollapsed ? `展开 (${node.collapsedCommitCount} 个提交)` : '折叠'}
                  >
                    {isCollapsed ? `+${node.collapsedCommitCount}` : '−'}
                  </button>
                )}

                {/* 分支标签 */}
                {node.branchNames.length > 0 && (
                  <div className="flex flex-wrap gap-1 mr-2">
                    {node.branchNames.map((branchName) => {
                      const isCurrent = branches.find(br => br.current && br.name === branchName);
                      return (
                        <span key={branchName} className="text-xs px-1.5 py-0 rounded flex-shrink-0"
                          style={{
                            backgroundColor: isCurrent ? `${node.color}44` : `${node.color}22`,
                            color: node.color,
                            border: `1px solid ${isCurrent ? node.color : `${node.color}55`}`,
                            fontWeight: isCurrent ? 600 : 400,
                          }}
                        >
                          {isCurrent ? '● ' : ''}{branchName}
                        </span>
                      );
                    })}
                  </div>
                )}

                <span className="flex-1 text-sm text-gray-200 truncate mr-3">
                  {node.commit.message}
                </span>

                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mr-2"
                  style={{ backgroundColor: getAvatarColor(node.commit.authorEmail), boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}
                >
                  {node.commit.authorName.charAt(0).toUpperCase()}
                </div>

                <span className="text-xs text-gray-400 truncate flex-shrink-0 mr-3" style={{ maxWidth: 90 }}>
                  {node.commit.authorName}
                </span>

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

export default CommitGraph;
