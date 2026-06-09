import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRepoStore, type GitCommit, type GitBranch } from '../../stores/repoStore';
import type { GraphNode } from '../../../shared/types/git';
import { useContextMenu, type MenuItem } from '../contextmenu/ContextMenu';

// ============================================================
// 常量
// ============================================================
const BRANCH_COLORS = [
  '#5b8def', '#e05673', '#68c263', '#c9a73c', '#a06cd5',
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
// 核心思路：正向扫描（新→旧），每个分支从诞生到消亡固定一条 lane，
// 主干始终 lane 0，分支按出现顺序右移，中间段纯直线。
// ============================================================

/**
 * 构建子节点映射
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

    // 收集第一父节点链上的所有祖先
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

/**
 * Fork 风格直线分支分配算法
 *
 * 核心思路：
 * 1. 按 committerTimestamp 降序排列（新→旧）
 * 2. 从最新提交开始，正向分配 lane
 * 3. 每个分支从诞生到消亡固定一条 lane（直线效果）
 * 4. 主干始终 lane 0
 * 5. 分支按出现顺序右移
 * 6. 中间段纯直线，分叉/合并处贝塞尔曲线
 */
function assignLanesForkStyle(
  commits: GitCommit[],
  branches: GitBranch[],
  collapsedMergeOids: Set<string>
): { nodes: GraphNode[]; edges: EdgeInfo[]; maxLane: number; totalVisibleRows: number } {
  if (commits.length === 0) return { nodes: [], edges: [], maxLane: 0, totalVisibleRows: 0 };

  // 构建 commit 映射
  const commitMap = new Map(commits.map(c => [c.oid, c]));

  // 分支映射：oid → 分支名列表
  const branchMap = new Map<string, string[]>();
  for (const branch of branches) {
    if (branch.oid) {
      const list = branchMap.get(branch.oid) || [];
      list.push(branch.name);
      branchMap.set(branch.oid, list);
    }
  }

  // 主分支检测
  const mainBranch = branches.find(b => b.name === 'main' || b.name === 'master' || b.current);
  const mainBranchOid = mainBranch?.oid;

  // 计算被合并提交
  const mergeToMerged = computeMergedCommits(commits, commitMap);

  // 标记折叠
  const collapsedOids = new Set<string>();
  for (const mergeOid of collapsedMergeOids) {
    const merged = mergeToMerged.get(mergeOid) || [];
    for (const oid of merged) collapsedOids.add(oid);
  }

  // ========== 第一步：构建提交图结构 ==========
  // 按 committerTimestamp 降序排列（新→旧）
  const sorted = [...commits].sort((a, b) => b.committerTimestamp - a.committerTimestamp);

  // 过滤折叠提交，建立可见行号
  let visibleRow = 0;
  const rowMapping = new Map<string, number>();
  const visibleCommits: GitCommit[] = [];
  for (const commit of sorted) {
    if (collapsedOids.has(commit.oid)) continue;
    rowMapping.set(commit.oid, visibleRow);
    visibleCommits.push(commit);
    visibleRow++;
  }
  const totalVisibleRows = visibleRow;

  // ========== 第二步：Fork 风格 lane 分配 ==========
  // 关键数据结构：
  // - oidToLane: 每个 commit 分配到的 lane
  // - oidToColor: 每个 commit 的颜色
  // - laneOwner: lane 当前被哪个 commit 占用（活跃分支追踪）
  //   用分支头 commit oid 标识，当该分支合并/消亡时释放 lane

  const oidToLane = new Map<string, number>();
  const oidToColor = new Map<string, string>();

  // 活跃 lane 池：lane → 占用该 lane 的分支头 oid
  // 分支头 = 该 lane 上最新（最靠前/时间最新）的可见 commit
  const activeLanes: (string | null)[] = [];

  // 已经处理过的 commit oid
  const processed = new Set<string>();

  /**
   * 为一个 commit 分配 lane
   * 规则：
   * 1. 如果 commit 有第一父节点且第一父节点已有 lane → 继承第一父节点的 lane（连续主线）
   * 2. 否则，找一个空闲 lane → 分支诞生
   * 3. 如果是 merge commit，第二父节点需要一条新 lane → 分支合入
   */
  function allocateLane(commit: GitCommit, isMainLine: boolean): void {
    if (processed.has(commit.oid)) return;

    let lane: number;
    let color: string;

    if (isMainLine) {
      // 主线：尝试继承第一父节点的 lane
      const firstParentOid = commit.parentIds[0];
      if (firstParentOid && oidToLane.has(firstParentOid)) {
        // 继承父节点 lane
        lane = oidToLane.get(firstParentOid)!;
        color = oidToColor.get(firstParentOid)!;
        // 更新 lane 占用
        activeLanes[lane] = commit.oid;
      } else {
        // 主线分支诞生：找空闲 lane 或新 lane
        const nilIdx = activeLanes.indexOf(null);
        if (nilIdx !== -1) {
          lane = nilIdx;
          activeLanes[lane] = commit.oid;
        } else {
          lane = activeLanes.length;
          activeLanes.push(commit.oid);
        }
        color = BRANCH_COLORS[lane % BRANCH_COLORS.length];
      }
    } else {
      // 非主线（分支侧）：分配新 lane
      const nilIdx = activeLanes.indexOf(null);
      if (nilIdx !== -1) {
        lane = nilIdx;
        activeLanes[lane] = commit.oid;
      } else {
        lane = activeLanes.length;
        activeLanes.push(commit.oid);
      }
      color = BRANCH_COLORS[lane % BRANCH_COLORS.length];
    }

    oidToLane.set(commit.oid, lane);
    oidToColor.set(commit.oid, color);
    processed.add(commit.oid);
  }

  // ========== 第三步：正向遍历分配 lane ==========
  // 从最新到最旧遍历可见提交
  for (const commit of visibleCommits) {
    const isMergeCommit = commit.parentIds.length > 1;

    if (!processed.has(commit.oid)) {
      // 确定这个 commit 是否在主线上
      // 主线 = 有分支头指向它，或者是某个主线 commit 的第一父节点
      const branchNames = branchMap.get(commit.oid) || [];
      const isOnMainBranch = branchNames.some(b => b === 'main' || b === 'master') ||
        mainBranchOid === commit.oid;

      allocateLane(commit, isOnMainBranch);
    }

    // 处理 merge commit 的第二父节点
    if (isMergeCommit) {
      const secondParentOid = commit.parentIds[1];
      // 第二父节点的祖先链需要独立 lane
      // 但这些可能已被折叠，所以只处理可见的
      if (secondParentOid && !collapsedOids.has(secondParentOid) && !processed.has(secondParentOid)) {
        allocateLane(commitMap.get(secondParentOid)!, false);
      }
    }

    // 处理第一父节点（如果可见且未处理）
    const firstParentOid = commit.parentIds[0];
    if (firstParentOid && !collapsedOids.has(firstParentOid) && !processed.has(firstParentOid)) {
      // 第一父节点继承当前 commit 的 lane（主线连续性）
      const currentLane = oidToLane.get(commit.oid)!;
      const currentColor = oidToColor.get(commit.oid)!;
      oidToLane.set(firstParentOid, currentLane);
      oidToColor.set(firstParentOid, currentColor);
      activeLanes[currentLane] = firstParentOid;
      processed.add(firstParentOid);
    }

    // 释放不再需要的 lane
    // 如果一个 commit 没有可见子节点，它的 lane 可以被释放
    // 但在正向遍历中我们无法立即判断，所以采用延迟释放策略
  }

  // ========== 第四步：对未处理的可见提交补充分配 ==========
  // 有些提交可能因为分支拓扑的复杂性未被第一步覆盖
  for (const commit of visibleCommits) {
    if (processed.has(commit.oid)) continue;

    // 检查是否有已处理的第一父节点可以继承
    const firstParentOid = commit.parentIds[0];
    if (firstParentOid && oidToLane.has(firstParentOid)) {
      const parentLane = oidToLane.get(firstParentOid)!;
      const parentColor = oidToColor.get(firstParentOid)!;
      oidToLane.set(commit.oid, parentLane);
      oidToColor.set(commit.oid, parentColor);
      activeLanes[parentLane] = commit.oid;
    } else {
      // 分配新 lane
      const nilIdx = activeLanes.indexOf(null);
      const lane = nilIdx !== -1 ? nilIdx : activeLanes.length;
      if (nilIdx !== -1) {
        activeLanes[lane] = commit.oid;
      } else {
        activeLanes.push(commit.oid);
      }
      oidToLane.set(commit.oid, lane);
      oidToColor.set(commit.oid, BRANCH_COLORS[lane % BRANCH_COLORS.length]);
    }
    processed.add(commit.oid);
  }

  // ========== 第五步：确保主干始终 lane 0 ==========
  // 找到主干 commits 并将它们换到 lane 0
  const mainBranchCommits = new Set<string>();
  let headOid = mainBranchOid;
  while (headOid) {
    mainBranchCommits.add(headOid);
    const c = commitMap.get(headOid);
    if (!c || c.parentIds.length === 0) break;
    headOid = c.parentIds[0]; // 沿第一父节点链
  }

  if (mainBranchCommits.size > 0) {
    // 找主干当前占用的 lane
    const mainLane = oidToLane.get(mainBranchOid || '');
    if (mainLane !== undefined && mainLane !== 0) {
      // 交换 lane 0 和 mainLane 的所有 commits
      for (const [oid, lane] of oidToLane) {
        if (lane === 0) oidToLane.set(oid, mainLane);
        else if (lane === mainLane) oidToLane.set(oid, 0);
      }
    }
  }

  // ========== 第六步：构建 GraphNode 列表 ==========
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
      branchNames: branchMap.get(commit.oid) || [],
      isMergeCommit,
      collapsedCommitCount,
      isCollapsed: false,
      collapseParentOid: null,
    };
  });

  // ========== 第七步：构建 Edge 列表 ==========
  const edges: EdgeInfo[] = [];
  const nodeMap = new Map(nodes.map(n => [n.commit.oid, n]));

  for (const node of nodes) {
    for (let pIdx = 0; pIdx < node.commit.parentIds.length; pIdx++) {
      const parentOid = node.commit.parentIds[pIdx];

      // 父节点被折叠 — 沿折叠链找到可见祖先
      if (collapsedOids.has(parentOid)) {
        let ancestorOid = parentOid;
        while (collapsedOids.has(ancestorOid)) {
          const ancestorCommit = commitMap.get(ancestorOid);
          if (!ancestorCommit) break;
          ancestorOid = ancestorCommit.parentIds[0];
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

      // Fork 风格连线颜色规则：
      // - 主线（第一父节点）连线：使用子节点颜色（分支延续）
      // - 合并线（第二父节点）连线：使用父节点颜色（被合入的分支色）
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
  if (diff < 86400) return `${Math.floor(diff / 86400)}天前`;
  if (diff < 2592000) return `${Math.floor(diff / 2592000)}个月前`;
  if (diff < 31536000) return `${Math.floor(diff / 31536000)}年前`;
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
  const stashes = store.stashes; // Stash 列表 — Fork 风格在提交图中渲染
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800);

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
        // 同 lane：纯直线（Fork 核心视觉效果）
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
      } else {
        // 跨 lane：Fork 风格分两段
        // 上半段：从 from 垂直下行一小段
        // 下半段：贝塞尔曲线平滑过渡到目标 lane
        const dy = toY - fromY;
        const ROW_HALF = ROW_HEIGHT / 2;
        
        // 直线段：从 fromY 到分叉点
        const forkY = edge.isMergeEdge
          ? fromY + ROW_HALF   // 合并线：从子节点往下半行开始弯
          : toY - ROW_HALF;    // 分叉线：到父节点上半行结束弯
        
        if (edge.isMergeEdge) {
          // 合并线：先直线向下，再贝塞尔弯入目标 lane
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(fromX, forkY);
          const ctrlOffset = Math.min(Math.abs(toX - fromX) * 0.5, 12);
          ctx.bezierCurveTo(
            fromX, forkY + ctrlOffset,
            toX, toY - ROW_HALF - ctrlOffset,
            toX, toY - ROW_HALF
          );
          ctx.lineTo(toX, toY);
        } else {
          // 分叉线：从 from 贝塞尔弯出，再直线到 to
          ctx.moveTo(fromX, fromY);
          ctx.bezierCurveTo(
            fromX, fromY + ROW_HALF * 0.5,
            toX, forkY - ROW_HALF * 0.5,
            toX, forkY
          );
          ctx.lineTo(toX, toY);
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
            const isStash = node.commit.oid.startsWith('stash-') || node.commit.shortOid.startsWith('stash@');

            return (
              <div
                key={node.commit.oid}
                onClick={() => !isStash && onCommitSelect?.(node.commit.oid)}
                onContextMenu={(e) => !isStash && handleContextMenu(e, node.commit.oid)}
                className={`absolute left-0 right-0 flex items-center px-3 cursor-pointer transition-colors ${
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
