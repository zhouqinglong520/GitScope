import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRepoStore, type GitCommit, type GitBranch } from '../../stores/repoStore';
import { BRANCH_COLORS, getBranchColorByName, type GraphNode } from '../../../shared/types/git';
import { useContextMenu, type MenuItem } from '../contextmenu/ContextMenu';

// ============================================================
// 常量
// ============================================================
const ROW_HEIGHT = 32;
const LANE_WIDTH = 26;
const NODE_RADIUS = 3.5;
const GRAPH_MIN_WIDTH = 120;
const VISIBLE_BUFFER = 20;

// ============================================================
// 分支高亮模式
// ============================================================
type HighlightMode = 'all' | 'branch';

// ============================================================
// 类型
// ============================================================
// GraphNode imported from shared/types/git

interface EdgeInfo {
  fromOid: string;
  toOid: string;
  fromLane: number;
  toLane: number;
  fromRow: number;
  toRow: number;
  color: string;
  isMergeEdge: boolean;
  isCollapsed: boolean;
}

// ============================================================
// Fork 风格直线分支算法
// 核心思路：反向扫描（旧→新），从根提交开始，每个分支分配独立 lane，
// 主干始终 lane 0，分支分叉时分配新 lane，合并时释放 lane
// ============================================================

/**
 * 构建 oid → 子节点列表的映射
 */
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
 * 使用 BFS 遍历替代递归，提高性能
 */
function computeMergedCommits(
  commits: GitCommit[],
  commitMap: Map<string, GitCommit>
): Map<string, string[]> {
  const mergeToMerged = new Map<string, string[]>();

  for (const commit of commits) {
    if (commit.parentIds.length < 2) continue;

    const secondParentOid = commit.parentIds[1];
    const firstParentOid = commit.parentIds[0];

    // BFS 收集第一父节点的祖先
    const firstAncestors = new Set<string>();
    const queue: string[] = [firstParentOid];
    let safety = 0;
    while (queue.length > 0 && safety < 1000) {
      const current = queue.shift()!;
      if (firstAncestors.has(current)) continue;
      firstAncestors.add(current);
      const c = commitMap.get(current);
      if (c) {
        for (const p of c.parentIds) queue.push(p);
      }
      safety++;
    }

    // BFS 收集第二父节点链中不在第一祖先集合的提交
    const merged: string[] = [];
    const visited = new Set<string>();
    let current: string | undefined = secondParentOid;
    safety = 0;
    while (current && !firstAncestors.has(current) && !visited.has(current) && safety < 1000) {
      visited.add(current);
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

/**
 * SourceGit 风格 Path-Based 直线分支分配算法
 * 
 * 核心思路（参考 SourceGit 的 Lane 跟踪算法）：
 * 1. 按提交时间从新到旧遍历（渲染顺序）
 * 2. 每条活跃路径占一个 lane，路径结束后释放 lane
 * 3. 分叉：子节点分出新路径，占新 lane
 * 4. 合并：第二父节点汇入目标路径，释放自己的 lane
 * 5. 颜色按分支名分配，同一分支始终同色
 * 
 * 相比原算法的改进：
 * - Lane 复用：路径结束后立即释放，减少宽度
 * - 无递归：使用迭代遍历，避免栈溢出
 * - 更准确的分支归属：每个提交标记所属分支名
 */
function assignLanesForkStyle(
  commits: GitCommit[],
  branches: GitBranch[],
  collapsedMergeOids: Set<string>
): { nodes: GraphNode[]; edges: EdgeInfo[]; maxLane: number; totalVisibleRows: number } {
  if (commits.length === 0) return { nodes: [], edges: [], maxLane: 0, totalVisibleRows: 0 };

  const commitMap = new Map(commits.map(c => [c.oid, c]));

  // 分支映射：oid → 分支名列表（合并 branches 数据和 commit.refs 装饰信息）
  const branchMap = new Map<string, string[]>();
  for (const branch of branches) {
    if (branch.oid) {
      const list = branchMap.get(branch.oid) || [];
      list.push(branch.name);
      branchMap.set(branch.oid, list);
    }
  }
  // 补充 commit.refs 装饰信息（标签、远程分支等 branches 可能遗漏的引用）
  for (const commit of commits) {
    if (commit.refs && commit.refs.length > 0) {
      const existing = branchMap.get(commit.oid) || [];
      const existingSet = new Set(existing);
      for (const ref of commit.refs) {
        if (!existingSet.has(ref)) {
          existing.push(ref);
          existingSet.add(ref);
        }
      }
      branchMap.set(commit.oid, existing);
    }
  }

  const currentBranch = branches.find(b => b.current);
  const mainBranch = branches.find(b => b.name === 'main' || b.name === 'master') || currentBranch;
  const mainBranchOid = mainBranch?.oid;

  const mergeToMerged = computeMergedCommits(commits, commitMap);

  const collapsedOids = new Set<string>();
  for (const mergeOid of collapsedMergeOids) {
    const merged = mergeToMerged.get(mergeOid) || [];
    for (const oid of merged) collapsedOids.add(oid);
  }

  // 按时间降序（新→旧）排列 — 即渲染顺序
  const sorted = [...commits].sort((a, b) => b.committerTimestamp - a.committerTimestamp);

  // 过滤折叠提交
  const visibleCommits = sorted.filter(c => !collapsedOids.has(c.oid));

  const rowMapping = new Map<string, number>();
  visibleCommits.forEach((commit, idx) => {
    rowMapping.set(commit.oid, idx);
  });
  const totalVisibleRows = visibleCommits.length;

  // ========== SourceGit 风格 Path-Based Lane 分配 ==========
  //
  // activePaths: 维护当前正在使用的 lane 列表
  // 每个 path = { lane, color, targetOid }
  // targetOid 是这条路径下一个要经过的提交
  //
  interface PathInfo {
    lane: number;
    color: string;
    targetOid: string | null; // null = 已到达末尾
  }

  const oidToLane = new Map<string, number>();
  const oidToColor = new Map<string, string>();
  const oidToBranchNames = new Map<string, string[]>();

  // 颜色池（复用 ColorPool 逻辑）
  const usedLaneColors = new Map<number, string>(); // lane → color
  const freeLanes: number[] = []; // 可复用的 lane 编号
  let nextLane = 0;

  function allocateLane(color: string): number {
    if (freeLanes.length > 0) {
      const lane = freeLanes.pop()!;
      usedLaneColors.set(lane, color);
      return lane;
    }
    const lane = nextLane++;
    usedLaneColors.set(lane, color);
    return lane;
  }

  function releaseLane(lane: number): void {
    usedLaneColors.delete(lane);
    if (!freeLanes.includes(lane)) {
      freeLanes.push(lane);
    }
  }

  // 为每个提交的分支名分配颜色
  const branchColorMap = new Map<string, string>();
  function getBranchColor(branchName: string): string {
    if (branchColorMap.has(branchName)) return branchColorMap.get(branchName)!;
    const color = getBranchColorByName(branchName);
    branchColorMap.set(branchName, color);
    return color;
  }

  // 初始化：从 HEAD 分支开始
  // 找到 HEAD 指向的提交，把它作为 lane 0 的起点
  let activePaths: PathInfo[] = [];
  const processedOids = new Set<string>();

  // 首先处理有分支头的提交（分支顶端）
  // 按分支优先级排序：当前分支 > 主干 > 远程 > 其他
  const branchHeadEntries: Array<{ oid: string; branchName: string; priority: number }> = [];
  for (const branch of branches) {
    if (!branch.oid || !commitMap.has(branch.oid)) continue;
    let priority = 5;
    if (branch.current) priority = 0;
    else if (branch.name === 'main' || branch.name === 'master') priority = 1;
    else if (branch.name === 'develop' || branch.name === 'dev') priority = 2;
    else if (branch.remote) priority = 4;
    else priority = 3;
    branchHeadEntries.push({ oid: branch.oid, branchName: branch.name, priority });
  }
  branchHeadEntries.sort((a, b) => a.priority - b.priority);

  // 遍历可见提交（从新到旧），分配 lane
  for (const commit of visibleCommits) {
    if (processedOids.has(commit.oid)) continue;

    // 检查是否有活跃路径指向此提交
    const arrivingPaths = activePaths.filter(p => p.targetOid === commit.oid);
    const otherPaths = activePaths.filter(p => p.targetOid !== commit.oid);

    // 确定此提交的 lane 和颜色
    let commitLane: number;
    let commitColor: string;

    const branchNames = branchMap.get(commit.oid) || [];
    oidToBranchNames.set(commit.oid, branchNames);

    if (arrivingPaths.length > 0) {
      // 有路径到达此提交 — 选取优先级最高的路径的 lane
      // 优先选择 lane 最小的（视觉上靠左 = 主干）
      arrivingPaths.sort((a, b) => a.lane - b.lane);
      const primaryPath = arrivingPaths[0];
      commitLane = primaryPath.lane;
      commitColor = primaryPath.color;

      // 释放其他到达此提交的路径的 lane
      for (let i = 1; i < arrivingPaths.length; i++) {
        releaseLane(arrivingPaths[i].lane);
      }
    } else {
      // 没有路径到达 — 这是新的分支起点
      // 从分支头信息获取颜色
      const topBranch = branchNames.length > 0
        ? branchNames.find(bn => branches.some(br => br.current && br.name === bn)) || branchNames[0]
        : '';
      commitColor = topBranch ? getBranchColor(topBranch) : BRANCH_COLORS[0];
      commitLane = allocateLane(commitColor);
    }

    // 如果此提交有分支标签，优先使用分支颜色
    if (branchNames.length > 0) {
      const topBranch = branchNames.find(bn => branches.some(br => br.current && br.name === bn)) || branchNames[0];
      commitColor = getBranchColor(topBranch);
      usedLaneColors.set(commitLane, commitColor);
    }

    oidToLane.set(commit.oid, commitLane);
    oidToColor.set(commit.oid, commitColor);
    processedOids.add(commit.oid);

    // 处理此提交的父节点
    const visibleParents = commit.parentIds
      .map((pid, idx) => ({ oid: pid, idx }))
      .filter(p => commitMap.has(p.oid) && !collapsedOids.has(p.oid));

    if (visibleParents.length === 0) {
      // 无可见父节点 — 此路径结束
      releaseLane(commitLane);
    } else if (visibleParents.length === 1) {
      // 只有一个父节点 — 路径延续
      otherPaths.push({
        lane: commitLane,
        color: commitColor,
        targetOid: visibleParents[0].oid,
      });
    } else {
      // 多个父节点（merge commit）
      // 第一父节点（主线）延续当前 lane
      otherPaths.push({
        lane: commitLane,
        color: commitColor,
        targetOid: visibleParents[0].oid,
      });

      // 第二及后续父节点 — 分配新 lane
      for (let i = 1; i < visibleParents.length; i++) {
        const parentCommit = commitMap.get(visibleParents[i].oid);
        const parentBranchNames = parentCommit ? (branchMap.get(visibleParents[i].oid) || []) : [];
        const mergeColor = parentBranchNames.length > 0
          ? getBranchColor(parentBranchNames[0])
          : BRANCH_COLORS[commitLane % BRANCH_COLORS.length];
        const newLane = allocateLane(mergeColor);
        otherPaths.push({
          lane: newLane,
          color: mergeColor,
          targetOid: visibleParents[i].oid,
        });
      }
    }

    activePaths = otherPaths;
  }

  // 处理未被路径覆盖的提交（兜底）
  for (const commit of visibleCommits) {
    if (!oidToLane.has(commit.oid)) {
      const branchNames = branchMap.get(commit.oid) || [];
      const topBranch = branchNames.length > 0 ? branchNames[0] : '';
      const color = topBranch ? getBranchColor(topBranch) : BRANCH_COLORS[0];
      const lane = allocateLane(color);
      oidToLane.set(commit.oid, lane);
      oidToColor.set(commit.oid, color);
    }
  }

  // 标记主干提交
  const mainBranchCommits = new Set<string>();
  if (mainBranchOid && commitMap.has(mainBranchOid)) {
    let currentOid: string | undefined = mainBranchOid;
    let safety = 0;
    while (currentOid && commitMap.has(currentOid) && safety < 5000) {
      mainBranchCommits.add(currentOid);
      const c = commitMap.get(currentOid)!;
      currentOid = c.parentIds[0];
      safety++;
    }
  }

  // ========== 构建 GraphNode 列表 ==========
  const nodes: GraphNode[] = visibleCommits.map(commit => {
    const lane = oidToLane.get(commit.oid) ?? 0;
    const color = oidToColor.get(commit.oid) ?? BRANCH_COLORS[0];
    const isMergeCommit = commit.parentIds.length > 1;
    const collapsedCommitCount = isMergeCommit && collapsedMergeOids.has(commit.oid)
      ? (mergeToMerged.get(commit.oid) || []).filter(oid => collapsedOids.has(oid)).length
      : 0;

    return {
      commit,
      lane,
      color: mainBranchCommits.has(commit.oid) ? BRANCH_COLORS[0] : color,
      row: rowMapping.get(commit.oid)!,
      isMainBranch: lane === 0 || mainBranchCommits.has(commit.oid),
      branchNames: oidToBranchNames.get(commit.oid) || branchMap.get(commit.oid) || [],
      isMergeCommit,
      collapsedCommitCount,
      isCollapsed: false,
      collapseParentOid: null,
    };
  });

  // ========== 构建 Edge 列表 ==========
  const edges: EdgeInfo[] = [];
  const nodeMap = new Map(nodes.map(n => [n.commit.oid, n]));

  for (const node of nodes) {
    for (let pIdx = 0; pIdx < node.commit.parentIds.length; pIdx++) {
      const parentOid = node.commit.parentIds[pIdx];

      // 父节点被折叠 — 沿折叠链找到可见祖先
      if (collapsedOids.has(parentOid)) {
        let ancestorOid = parentOid;
        let safety = 0;
        while (collapsedOids.has(ancestorOid) && safety < 1000) {
          const ancestorCommit = commitMap.get(ancestorOid);
          if (!ancestorCommit) break;
          ancestorOid = ancestorCommit.parentIds[0];
          safety++;
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

      const edgeColor = pIdx > 0 ? parentNode.color : node.color;

      edges.push({
        fromOid: node.commit.oid,
        toOid: parentOid,
        fromLane: node.lane,
        toLane: parentNode.lane,
        fromRow: node.row,
        toRow: parentNode.row,
        color: edgeColor,
        isMergeEdge: pIdx > 0,
        isCollapsed: false,
      });
    }
  }

  const maxLane = nextLane > 0 ? nextLane - 1 : 0;
  return { nodes, edges, maxLane, totalVisibleRows };
}

// ============================================================
// 工具函数
// ============================================================

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
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
  const stashes = store.stashes; // Stash 列表 — Fork 风格在提交图中渲染
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800);
  
  // ===== 分支高亮模式状态 =====
  const [highlightMode, setHighlightMode] = useState<HighlightMode>('all');
  
  // 当前分支名称（用于高亮判断）
  const currentBranchName = externalCurrentBranch || store.currentBranch?.name;

  // ===== 可折叠合并提交状态 =====
  const [collapsedMergeOids, setCollapsedMergeOids] = useState<Set<string>>(new Set());
  const [autoCollapse, setAutoCollapse] = useState(true);

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

  // ========== 图计算（使用 Fork 风格算法）==========
  const { graphNodes, edges, graphWidth, totalVisibleRows } = useMemo(() => {
    if (commits.length === 0) return { graphNodes: [] as GraphNode[], edges: [] as EdgeInfo[], graphWidth: GRAPH_MIN_WIDTH, totalVisibleRows: 0 };

    const result = assignLanesForkStyle(commits, branches, collapsedMergeOids);
    const w = Math.max(GRAPH_MIN_WIDTH, (result.maxLane + 1) * LANE_WIDTH + 20);

    // Fork 风格：在提交图顶部插入 Stash 节点
    const stashNodes: GraphNode[] = (stashes || []).map((stash, i) => ({
      commit: {
        oid: stash.id || `stash-${i}`,
        shortOid: `stash@{${i}}`,
        message: stash.message || `Stash #${i}`,
        author: { name: '', email: '', timestamp: 0 },
        parentIds: [],
        date: stash.date || '',
      } as any,
      lane: 0,
      color: '#e8c547', // 金色 — Stash 专属
      row: i,
      isMainBranch: false,
      branchNames: [`stash@{${i}}`],
      isMergeCommit: false,
      collapsedCommitCount: 0,
      isCollapsed: false,
      collapseParentOid: null,
    }));

    // 合并：Stash 在上 → commits 在下，commit rows 下移
    const shiftedCommitNodes = result.nodes.map(n => ({ ...n, row: n.row + stashNodes.length }));
    const shiftedEdges = result.edges.map(e => ({ ...e, fromRow: e.fromRow + stashNodes.length, toRow: e.toRow + stashNodes.length }));

    const allNodes = [...stashNodes, ...shiftedCommitNodes];

    return { graphNodes: allNodes, edges: shiftedEdges, graphWidth: w, totalVisibleRows: result.totalVisibleRows + stashNodes.length };
  }, [commits, branches, collapsedMergeOids, stashes]);

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

  // ========== Canvas 绘制（Fork 风格：直线+分叉贝塞尔）==========
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
      ctx.lineWidth = edge.isMergeEdge ? 1.6 : 2;
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
        // 同 lane：纯直线（Fork 核心视觉效果）
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
      } else {
        // Fork 风格：圆角折线（直角转圆弧）
        // 原理：先垂直走半行高，圆角转弯，再水平+垂直到目标
        const RADIUS = Math.min(LANE_WIDTH * 0.4, 6); // 圆角半径
        const dx = toX - fromX;
        const dir = dx > 0 ? 1 : -1; // 水平方向
        
        if (edge.isMergeEdge) {
          // 合并线：从 from 向下走，圆角转弯汇入目标 lane
          ctx.moveTo(fromX, fromY);
          const midY = toY - ROW_HEIGHT / 2;
          
          if (Math.abs(toY - fromY) > ROW_HEIGHT * 1.5) {
            // 距离足够：先直线下行到转弯高度
            ctx.lineTo(fromX, midY - RADIUS);
            // 圆角转弯
            ctx.arcTo(fromX, midY, fromX + dir * RADIUS, midY, RADIUS);
            // 水平线到目标 lane
            ctx.lineTo(toX - dir * RADIUS, midY);
            // 圆角转弯向下
            ctx.arcTo(toX, midY, toX, midY + RADIUS, RADIUS);
            // 直线到目标
            ctx.lineTo(toX, toY);
          } else {
            // 距离近：使用贝塞尔曲线平滑连接
            ctx.moveTo(fromX, fromY);
            const bendY = fromY + (toY - fromY) * 0.3;
            ctx.bezierCurveTo(
              fromX, bendY,
              toX, toY - (toY - fromY) * 0.3,
              toX, toY
            );
          }
        } else {
          // 分叉线：从 from 圆角转弯分出到目标 lane
          const midY = fromY + ROW_HEIGHT / 2;
          
          if (Math.abs(toY - fromY) > ROW_HEIGHT * 1.5) {
            // 距离足够：先直线下行到转弯高度
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(fromX, midY - RADIUS);
            // 圆角转弯
            ctx.arcTo(fromX, midY, fromX + dir * RADIUS, midY, RADIUS);
            // 水平线到目标 lane
            ctx.lineTo(toX - dir * RADIUS, midY);
            // 圆角转弯向下
            ctx.arcTo(toX, midY, toX, midY + RADIUS, RADIUS);
            // 直线到目标
            ctx.lineTo(toX, toY);
          } else {
            // 距离近：使用贝塞尔曲线
            ctx.moveTo(fromX, fromY);
            ctx.bezierCurveTo(
              fromX, fromY + (toY - fromY) * 0.3,
              toX, toY - (toY - fromY) * 0.3,
              toX, toY
            );
          }
        }
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
      
      // 判断是否为当前分支上的提交
      const isOnCurrentBranch = node.branchNames.some(
        name => name === currentBranchName || name === `origin/${currentBranchName}`
      );
      const isHighlighted = highlightMode === 'all' || isOnCurrentBranch;
      
      // SourceGit 风格：选中提交高亮环
      const isSelected = selectedCommit === node.commit.oid;
      if (isSelected) {
        ctx.strokeStyle = '#4a7fce';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // SourceGit 风格：HEAD 双圈
      const isHead = node.branchNames.some(b => branches.find(br => br.current && br.name === b));
      if (isHead) {
        // 外圈（浅色）
        ctx.strokeStyle = node.color + '60';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // SourceGit 风格：合并提交十字标记（比实心双圈辨识度更高）
      if (node.isMergeCommit) {
        // 填充圆形背景
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS + 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 十字标记（白色 X）
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        const crossSize = NODE_RADIUS - 0.5;
        ctx.beginPath();
        ctx.moveTo(x - crossSize, y - crossSize);
        ctx.lineTo(x + crossSize, y + crossSize);
        ctx.moveTo(x + crossSize, y - crossSize);
        ctx.lineTo(x - crossSize, y + crossSize);
        ctx.stroke();
        
        // 白色边框
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS + 1.5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // 普通提交节点
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        // 白色细边框
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // 分支高亮模式：非当前分支灰化（降低节点亮度）
      if (!isHighlighted) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS + 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [graphNodes, edges, graphWidth, scrollTop, containerHeight, branches, highlightMode, currentBranchName, selectedCommit]);

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
        <span className="flex-1 min-w-0">提交</span>
        <span className="w-[120px] flex-shrink-0 text-right">作者</span>
        <span className="w-[130px] flex-shrink-0 text-right">日期</span>
        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-[#3c3c3c]">
          {/* 分支高亮模式切换 */}
          <div className="flex items-center gap-0.5 mr-2 px-1.5 py-0.5 bg-[#2d2d30] rounded text-[10px]">
            <button
              className={`px-1 py-0.5 rounded transition-colors ${
                highlightMode === 'all'
                  ? 'bg-[#4a7fce] text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => setHighlightMode('all')}
              title="显示所有分支"
            >
              全部
            </button>
            <button
              className={`px-1 py-0.5 rounded transition-colors ${
                highlightMode === 'branch'
                  ? 'bg-[#4a7fce] text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => setHighlightMode('branch')}
              title="仅高亮当前分支"
            >
              分支
            </button>
          </div>
          <button className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 hover:bg-[#3c3c3c] rounded" onClick={expandAll} title="展开所有">展开</button>
          <button className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 hover:bg-[#3c3c3c] rounded" onClick={collapseAll} title="折叠所有">折叠</button>
        </div>
      </div>

      {/* 滚动区域 */}
      <div ref={containerRef} className="flex-1 overflow-y-auto bg-[#1e1e1e]" onScroll={handleScroll}>
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* 左侧分支图 Canvas — absolute 定位，始终固定在可视区域顶部 */}
          <div className="absolute left-0 top-0 z-10" style={{ width: graphWidth, height: containerHeight, backgroundColor: '#1e1e1e', borderRight: '1px solid #3c3c3c', pointerEvents: 'none' }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
          </div>

          {/* 提交记录列表 */}
          {graphNodes.slice(firstVisibleRow, lastVisibleRow + 1).map((node) => {
            const isSelected = selectedCommit === node.commit.oid;
            const isCollapsed = collapsedMergeOids.has(node.commit.oid);
            const isStash = node.commit.oid.startsWith('stash-') || node.commit.shortOid.startsWith('stash@');
            
            // 判断是否为当前分支上的提交
            const isOnCurrentBranch = node.branchNames.some(
              name => name === currentBranchName || name === `origin/${currentBranchName}`
            );
            
            // 分支高亮模式：非当前分支灰化
            const isHighlighted = highlightMode === 'all' || isOnCurrentBranch;
            const dimmedClass = !isHighlighted ? 'opacity-40' : '';
            
            // SourceGit 风格：选中提交高亮
            const selectedClass = isSelected ? 'ring-2 ring-[#4a7fce] ring-offset-1 ring-offset-[#1e1e1e]' : '';

            return (
              <div
                key={node.commit.oid}
                onClick={() => !isStash && onCommitSelect?.(node.commit.oid)}
                onContextMenu={(e) => !isStash && handleContextMenu(e, node.commit.oid)}
                className={`absolute left-0 right-0 flex items-center px-3 cursor-pointer transition-colors ${dimmedClass} ${selectedClass} ${
                  isSelected ? 'bg-[#2d2d30]' : isStash ? 'bg-[#2a2518]' : 'hover:bg-[#2a2d2e]'
                }`}
                style={{ top: node.row * ROW_HEIGHT, height: ROW_HEIGHT, paddingLeft: graphWidth + 12, paddingRight: 12 }}
              >
                {isStash ? (
                  /* ===== Stash 行 — Fork 风格金色 ===== */
                  <>
                    <span className="font-mono text-xs flex-shrink-0 mr-3" style={{ minWidth: 55, color: '#e8c547' }}>
                      {node.commit.shortOid}
                    </span>
                    <svg className="w-4 h-4 flex-shrink-0 mr-1.5" fill="none" stroke="#e8c547" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                    <span className="text-sm truncate" style={{ color: '#e8c547' }}>
                      {node.commit.message}
                    </span>
                  </>
                ) : (
                  <>
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

                {/* 分支标签 - 紧凑展示 */}
                {node.branchNames.length > 0 && (
                  <div className="relative group/menu mr-2 flex-shrink-0">
                    {(() => {
                      // 分支类型识别（参考 SourceGit）
                      const getBranchStyle = (name: string) => {
                        const isCurrent = branches.find(br => br.current && br.name === name);
                        // 类型前缀颜色映射
                        const prefixes: [RegExp, string, string][] = [
                          [/^(main|master)$/, '#4CAF50', '主分支'],
                          [/^(develop|dev)$/, '#2196F3', '开发分支'],
                          [/^(origin\/HEAD)$/, '#9E9E9E', '远程HEAD'],
                          [/^origin\//, '#00BCD4', '远程分支'],
                          [/^(feature|feat)\//, '#9C27B0', '功能分支'],
                          [/^(fix|bugfix)\//, '#FF5722', '修复分支'],
                          [/^hotfix\//, '#F44336', '热修复'],
                          [/^(release|rel)\//, '#FF9800', '发布分支'],
                          [/^tag:/, '#795548', '标签'],
                          [/^HEAD$/, '#607D8B', 'HEAD指针'],
                        ];
                        
                        for (const [regex, color, desc] of prefixes) {
                          if (regex.test(name)) {
                            return { color, desc, isCurrent };
                          }
                        }
                        return { color: node.color, desc: '分支', isCurrent };
                      };
                      
                      // 排序：当前分支优先，远程分支次之，本地分支最后
                      const sortBranches = (names: string[]) => {
                        return [...names].sort((a, b) => {
                          const aStyle = getBranchStyle(a);
                          const bStyle = getBranchStyle(b);
                          // 当前分支优先
                          if (aStyle.isCurrent && !bStyle.isCurrent) return -1;
                          if (!aStyle.isCurrent && bStyle.isCurrent) return 1;
                          // 按类型排序
                          const typeOrder = ['主分支', '开发分支', '功能分支', '修复分支', '热修复', '发布分支', '远程HEAD', '远程分支', '标签', 'HEAD指针', '分支'];
                          const aIdx = typeOrder.indexOf(aStyle.desc);
                          const bIdx = typeOrder.indexOf(bStyle.desc);
                          return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
                        });
                      };
                      
                      const sortedBranches = sortBranches(node.branchNames);
                      const displayBranches = sortedBranches.slice(0, 1);
                      const remaining = sortedBranches.length - displayBranches.length;
                      
                      return (
                        <div className="flex items-center gap-0.5">
                          {/* 显示前3个分支标签 */}
                          {displayBranches.map((name) => {
                            const style = getBranchStyle(name);
                            return (
                              <span key={name}
                                className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium max-w-[80px] cursor-default flex-shrink-0"
                                style={{
                                  backgroundColor: style.isCurrent ? style.color + '33' : style.color + '1A',
                                  color: style.isCurrent ? '#fff' : style.color,
                                  border: `1px solid ${style.color}${style.isCurrent ? 'CC' : '66'}`,
                                  textShadow: style.isCurrent ? `0 0 2px ${style.color}` : 'none',
                                }}
                                title={name + (style.isCurrent ? ' (当前)' : '')}
                              >
                                {style.isCurrent && (
                                  <svg className="w-2.5 h-2.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                                  </svg>
                                )}
                                <span className="truncate">{name.replace(/^origin\//, '')}</span>
                              </span>
                            );
                          })}
                          
                          {/* 剩余分支数量指示器 */}
                          {remaining > 0 && (
                            <div className="relative">
                              <span 
                                className="inline-flex items-center justify-center px-1 py-0.5 rounded text-[10px] font-bold bg-gray-700 text-gray-300 cursor-pointer hover:bg-gray-600"
                                title={`还有 ${remaining} 个分支:\n${sortedBranches.slice(3).join('\n')}`}
                              >
                                +{remaining}
                              </span>
                              {/* 悬停显示所有分支 */}
                              <div className="hidden group-hover/menu:block absolute left-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2 min-w-[150px] max-w-[300px]">
                                <div className="text-[10px] text-gray-400 mb-1 px-1">所有分支 ({sortedBranches.length})</div>
                                {sortedBranches.map((name) => {
                                  const style = getBranchStyle(name);
                                  return (
                                    <div key={name}
                                      className="flex items-center gap-1 px-1 py-0.5 rounded text-[11px] hover:bg-gray-800"
                                      title={name}
                                    >
                                      <span 
                                        className="w-2 h-2 rounded-sm flex-shrink-0"
                                        style={{ backgroundColor: style.color }}
                                      />
                                      <span className={style.isCurrent ? 'text-white font-semibold' : 'text-gray-300'}>
                                        {style.isCurrent && <span className="mr-1">✓</span>}
                                        {name}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <span className="flex-1 text-sm text-gray-200 truncate mr-3 min-w-0">
                  {node.commit.message}
                </span>

                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mr-2"
                  style={{ backgroundColor: getAvatarColor(node.commit.authorEmail), boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}
                >
                  {node.commit.authorName.charAt(0).toUpperCase()}
                </div>

                <span className="text-xs text-gray-400 truncate flex-shrink-0 mr-3" style={{ maxWidth: 80 }}>
                  {node.commit.authorName}
                </span>

                <span className="text-xs text-gray-500 flex-shrink-0" style={{ width: 130 }}>
                  {formatDateTime(node.commit.authorTimestamp)}
                </span>
                  </>
                )}
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
