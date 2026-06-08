import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRepoStore, type GitCommit, type GitBranch } from '../../stores/repoStore';
import { useContextMenu, type MenuItem } from '../contextmenu/ContextMenu';

// ============================================================
// 常量
// ============================================================
const BRANCH_COLORS = [
  '#e05673', // 红
  '#5b8def', // 蓝
  '#68c263', // 绿
  '#c9a73c', // 黄
  '#a06cd5', // 紫
  '#3eb4c6', // 青
  '#d4844e', // 橙
  '#e86580', // 粉
  '#7ec8e3', // 浅蓝
  '#b5e48c', // 浅绿
];

const ROW_HEIGHT = 32;
const LANE_WIDTH = 22;
const NODE_RADIUS = 3.5;
const GRAPH_MIN_WIDTH = 120;
const VISIBLE_BUFFER = 20; // 上下多渲染的行数

// ============================================================
// 类型
// ============================================================
interface GraphNode {
  commit: GitCommit;
  lane: number;          // 列号（j 坐标）
  color: string;
  row: number;           // 行号（i 坐标，拓扑排序后的索引）
  isMainBranch: boolean;
  branchNames: string[];
  branchChildren: string[];  // 第一父节点指向此提交的子提交 oid
  mergeChildren: string[];   // 非第一父节点指向此提交的子提交 oid
}

interface EdgeInfo {
  fromOid: string;
  toOid: string;
  fromLane: number;
  toLane: number;
  fromRow: number;
  toRow: number;
  color: string;
  isMergeEdge: boolean;  // 合并边（非第一父节点）需要特殊路径
}

// ============================================================
// 算法核心：基于 pvigier 直线分支算法
// 参考: https://pvigier.github.io/2019/05/06/commit-graph-drawing-algorithms.html
// ============================================================

/**
 * 时间拓扑排序：按 committer date 从新到旧排序，
 * 但保证拓扑序（父节点一定在子节点之后）。
 */
function temporalTopologicalSort(
  commits: GitCommit[],
  childMap: Map<string, string[]>
): GitCommit[] {
  const oidSet = new Set(commits.map(c => c.oid));

  // 按 committer date 从新到旧排序
  const sorted = [...commits].sort(
    (a, b) => b.committerTimestamp - a.committerTimestamp
  );

  const explored = new Set<string>();
  const result: GitCommit[] = [];
  const commitMap = new Map(sorted.map(c => [c.oid, c]));

  function dfs(oid: string) {
    if (explored.has(oid) || !oidSet.has(oid)) return;
    explored.add(oid);
    const children = childMap.get(oid);
    if (children) {
      for (const childOid of children) {
        dfs(childOid);
      }
    }
    const commit = commitMap.get(oid);
    if (commit) result.push(commit);
  }

  for (const c of sorted) {
    dfs(c.oid);
  }

  return result;
}

/**
 * 构建 childMap: oid → 其子提交 oid 列表
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
 * 直线分支车道分配算法
 * 核心思想：
 * - 维护活跃分支列表 B，nil 表示已结束可复用的位置
 * - 每个提交尝试继承某个 branchChild 的车道
 * - 计算禁列（forbidden lanes）避免合并线穿过其他节点
 * - 设为 nil 而非删除，保证其他分支不偏移（直线）
 */
function assignLanes(
  sortedCommits: GitCommit[],
  childMap: Map<string, string[]>,
  branches: GitBranch[]
): { nodes: GraphNode[]; edges: EdgeInfo[]; maxLane: number } {
  if (sortedCommits.length === 0) return { nodes: [], edges: [], maxLane: 0 };

  // 分支名 → 提交 oid 映射
  const branchMap = new Map<string, string[]>();
  for (const branch of branches) {
    if (branch.oid) {
      const list = branchMap.get(branch.oid) || [];
      list.push(branch.name);
      branchMap.set(branch.oid, list);
    }
  }

  // 主分支 oid
  const mainBranch = branches.find(
    b => b.name === 'main' || b.name === 'master' || b.current
  );
  const mainBranchOid = mainBranch?.oid;

  // oid → GraphNode 映射（按 row 索引）
  const nodeMap = new Map<string, GraphNode>();
  const activeBranches: (string | null)[] = []; // 活跃分支列表，存 oid 或 nil

  // 记录每列占用的行范围，用于计算禁列
  // laneOccupiedRows[lane] = Set of rows where that lane has content
  const laneOccupiedRows: Map<number, Set<number>> = new Map();

  // 先给所有节点分类 children
  const branchChildrenMap = new Map<string, string[]>();
  const mergeChildrenMap = new Map<string, string[]>();

  for (const commit of sortedCommits) {
    const children = childMap.get(commit.oid) || [];
    const branchKids: string[] = [];
    const mergeKids: string[] = [];

    for (const childOid of children) {
      const childCommit = sortedCommits.find(c => c.oid === childOid);
      if (childCommit) {
        // 如果此提交是 child 的第一父节点 → branch child
        if (childCommit.parentIds[0] === commit.oid) {
          branchKids.push(childOid);
        } else {
          mergeKids.push(childOid);
        }
      }
    }
    branchChildrenMap.set(commit.oid, branchKids);
    mergeChildrenMap.set(commit.oid, mergeKids);
  }

  // 逐行处理（从上到下，row 0 = 最新提交）
  for (let row = 0; row < sortedCommits.length; row++) {
    const commit = sortedCommits[row];
    const branchKids = branchChildrenMap.get(commit.oid) || [];
    const mergeKids = mergeChildrenMap.get(commit.oid) || [];

    // 计算禁列：合并子节点连接到此提交时不能穿过的列
    const forbiddenLanes = new Set<number>();

    for (const mergeChildOid of mergeKids) {
      const childNode = nodeMap.get(mergeChildOid);
      if (childNode) {
        // 从 childNode.row 到当前 row 之间，哪些列有内容
        const childRow = childNode.row;
        for (const [lane, rows] of laneOccupiedRows) {
          // 检查该列在 [childRow, row] 范围内是否有内容
          for (const r of rows) {
            if (r > childRow && r < row) {
              forbiddenLanes.add(lane);
              break;
            }
          }
        }
      }
    }

    let lane: number;
    let color: string;

    // 尝试继承某个 branchChild 的车道
    let inherited = false;
    for (const childOid of branchKids) {
      const childNode = nodeMap.get(childOid);
      if (childNode && !forbiddenLanes.has(childNode.lane)) {
        // 继承这个子节点的车道
        lane = childNode.lane;
        color = childNode.color;
        // 在活跃分支列表中替换子节点
        const idx = activeBranches.indexOf(childOid);
        if (idx !== -1) {
          activeBranches[idx] = commit.oid;
        } else {
          activeBranches.push(commit.oid);
        }
        inherited = true;
        break;
      }
    }

    if (!inherited) {
      // 找一个 nil 位置或追加
      let nilIdx = activeBranches.indexOf(null);
      if (nilIdx !== -1) {
        lane = nilIdx;
        activeBranches[nilIdx] = commit.oid;
      } else {
        lane = activeBranches.length;
        activeBranches.push(commit.oid);
      }
      color = BRANCH_COLORS[lane % BRANCH_COLORS.length];
    }

    // 其余 branchChildren 设为 nil（分支已结束在此）
    for (const childOid of branchKids) {
      const childNode = nodeMap.get(childOid);
      if (childNode) {
        // 只处理没被继承的那个
        if (childNode.lane !== lane!) {
          const idx = activeBranches.indexOf(childOid);
          if (idx !== -1) {
            activeBranches[idx] = null;
          }
        }
      }
    }

    // 主分支强制颜色
    const isMainBranch = mainBranchOid === commit.oid || lane! === 0;
    if (isMainBranch) {
      color = BRANCH_COLORS[0];
    }

    const node: GraphNode = {
      commit,
      lane: lane!,
      color: color!,
      row,
      isMainBranch,
      branchNames: branchMap.get(commit.oid) || [],
      branchChildren: branchKids,
      mergeChildren: mergeKids,
    };
    nodeMap.set(commit.oid, node);

    // 记录此列占用
    if (!laneOccupiedRows.has(lane!)) {
      laneOccupiedRows.set(lane!, new Set());
    }
    laneOccupiedRows.get(lane!)!.add(row);
  }

  // 收集节点和边
  const nodes = sortedCommits.map((c, row) => nodeMap.get(c.oid)!);
  const edges: EdgeInfo[] = [];

  for (const node of nodes) {
    for (let pIdx = 0; pIdx < node.commit.parentIds.length; pIdx++) {
      const parentOid = node.commit.parentIds[pIdx];
      const parentNode = nodeMap.get(parentOid);
      if (!parentNode) continue;

      const isMergeEdge = pIdx > 0;
      edges.push({
        fromOid: node.commit.oid,
        toOid: parentOid,
        fromLane: node.lane,
        toLane: parentNode.lane,
        fromRow: node.row,
        toRow: parentNode.row,
        color: node.color,
        isMergeEdge,
      });
    }
  }

  const maxLane = nodes.reduce((max, n) => Math.max(max, n.lane), 0);
  return { nodes, edges, maxLane };
}

// ============================================================
// 工具函数
// ============================================================

function formatRelativeTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function getAvatarColor(email: string): string {
  const colors = ['#5b8def', '#68c263', '#c9a73c', '#a06cd5', '#3eb4c6', '#e86580', '#d4844e', '#5b8def'];
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

  // ========== 图计算 ==========
  const { graphNodes, edges, graphWidth } = useMemo(() => {
    if (commits.length === 0) return { graphNodes: [] as GraphNode[], edges: [] as EdgeInfo[], graphWidth: GRAPH_MIN_WIDTH };

    const childMap = buildChildMap(commits);
    const sorted = temporalTopologicalSort(commits, childMap);
    const { nodes, edges, maxLane } = assignLanes(sorted, childMap, branches);
    const w = Math.max(GRAPH_MIN_WIDTH, (maxLane + 1) * LANE_WIDTH + 20);

    return { graphNodes: nodes, edges, graphWidth: w };
  }, [commits, branches]);

  const totalHeight = graphNodes.length * ROW_HEIGHT;

  // ========== 监听容器尺寸 ==========
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ========== Canvas 绘制（仅可见区域）==========
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const visibleTop = scrollTop;
    const visibleBottom = scrollTop + containerHeight;

    // 可见行范围
    const firstVisibleRow = Math.max(0, Math.floor(visibleTop / ROW_HEIGHT) - VISIBLE_BUFFER);
    const lastVisibleRow = Math.min(graphNodes.length - 1, Math.ceil(visibleBottom / ROW_HEIGHT) + VISIBLE_BUFFER);

    const canvasHeight = containerHeight;
    const canvasWidth = graphWidth;

    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 构建快速查找：oid → node
    const nodeMap = new Map(graphNodes.map(n => [n.commit.oid, n]));

    // 1. 绘制连线
    for (const edge of edges) {
      // 只绘制至少有一端在可见范围内的边
      if (edge.fromRow > lastVisibleRow && edge.toRow > lastVisibleRow) continue;
      if (edge.fromRow < firstVisibleRow && edge.toRow < firstVisibleRow) continue;

      const fromX = edge.fromLane * LANE_WIDTH + LANE_WIDTH / 2;
      const fromY = edge.fromRow * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop;
      const toX = edge.toLane * LANE_WIDTH + LANE_WIDTH / 2;
      const toY = edge.toRow * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop;

      // 不在画布内的跳过
      if (fromY < -100 && toY < -100) continue;
      if (fromY > canvasHeight + 100 && toY > canvasHeight + 100) continue;

      const isMainLine = !edge.isMergeEdge;
      const lineWidth = isMainLine ? 2 : 1.4;

      ctx.strokeStyle = edge.color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      if (edge.fromLane === edge.toLane) {
        // 同列直线
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
      } else {
        // Fork 风格贝塞尔曲线
        const dy = toY - fromY;
        const ctrlOffset = Math.min(Math.abs(dy) * 0.4, 16);

        if (edge.isMergeEdge) {
          // 合并线：从子节点出发，平滑弯入父节点列
          ctx.moveTo(fromX, fromY);
          ctx.bezierCurveTo(
            fromX, fromY + ctrlOffset,
            toX, toY - ctrlOffset,
            toX, toY
          );
        } else {
          // 分支线：从子节点出发，平滑分出
          ctx.moveTo(fromX, fromY);
          ctx.bezierCurveTo(
            fromX, fromY + ctrlOffset,
            toX, toY - ctrlOffset,
            toX, toY
          );
        }
      }
      ctx.stroke();
    }

    // 2. 绘制节点
    for (let row = firstVisibleRow; row <= lastVisibleRow; row++) {
      if (row < 0 || row >= graphNodes.length) continue;
      const node = graphNodes[row];
      const x = node.lane * LANE_WIDTH + LANE_WIDTH / 2;
      const y = row * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop;

      // 填充
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

      // HEAD 标记（当前分支的指向）
      if (node.branchNames.some(b => branches.find(br => br.current && br.name === b))) {
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS + 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, [graphNodes, edges, graphWidth, scrollTop, containerHeight]);

  // ========== 滚动处理 ==========
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // ========== 右键菜单 ==========
  const [contextMenuItems, setContextMenuItems] = useState<MenuItem[]>([]);
  const [contextMenuOid, setContextMenuOid] = useState<string | null>(null);

  const { showContextMenu, ContextMenuWrapper } = useContextMenu(() => {
    if (!contextMenuOid) return [];
    return contextMenuItems;
  });

  const handleContextMenu = (e: React.MouseEvent, oid: string) => {
    e.preventDefault();
    setContextMenuOid(oid);
    setContextMenuItems([
      { id: 'checkout', label: '检出此提交', onClick: () => onCheckout?.(oid) },
      { id: 'divider-1', label: '', divider: true },
      { id: 'create-branch', label: '从此创建分支...', onClick: () => onCreateBranch?.(oid) },
      { id: 'create-tag', label: '从此创建标签...', onClick: () => onCreateTag?.(oid) },
      { id: 'divider-2', label: '', divider: true },
      { id: 'reset', label: '重置到此处', onClick: () => onReset?.(oid) },
      { id: 'divider-3', label: '', divider: true },
      { id: 'cherry-pick', label: 'Cherry-pick', onClick: () => onCherryPick?.(oid) },
      { id: 'revert', label: 'Revert', onClick: () => onRevert?.(oid) },
      { id: 'divider-4', label: '', divider: true },
      { id: 'save-patch', label: '保存为 Patch...', onClick: () => onSavePatch?.(oid) },
    ]);
    showContextMenu(e);
  };

  // ========== 可见行计算 ==========
  const firstVisibleRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_BUFFER);
  const lastVisibleRow = Math.min(
    graphNodes.length - 1,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VISIBLE_BUFFER
  );

  return (
    <div className="h-full flex flex-col">
      {/* 表头 */}
      <div className="px-3 py-1.5 border-b border-panel-border bg-[#1e1e1e] flex items-center text-xs text-gray-400 flex-shrink-0">
        <span style={{ width: graphWidth }} className="flex-shrink-0"></span>
        <span className="flex-1">提交</span>
        <span className="w-24 flex-shrink-0 text-right">作者</span>
        <span className="w-20 flex-shrink-0 text-right">日期</span>
      </div>

      {/* 滚动区域 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-[#1e1e1e]"
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* 左侧分支图 Canvas */}
          <div
            className="sticky left-0 top-0 z-10"
            style={{
              width: graphWidth,
              height: totalHeight,
              backgroundColor: '#1e1e1e',
              borderRight: '1px solid #3c3c3c',
            }}
          >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
          </div>

          {/* 提交记录列表（虚拟滚动） */}
          {graphNodes.slice(firstVisibleRow, lastVisibleRow + 1).map((node) => {
            const isSelected = selectedCommit === node.commit.oid;

            return (
              <div
                key={node.commit.oid}
                onClick={() => onCommitSelect?.(node.commit.oid)}
                onContextMenu={(e) => handleContextMenu(e, node.commit.oid)}
                className={`absolute left-0 right-0 flex items-center px-3 cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#2d2d30]' : 'hover:bg-[#2a2d2e]'
                }`}
                style={{
                  top: node.row * ROW_HEIGHT,
                  height: ROW_HEIGHT,
                  paddingLeft: graphWidth + 12,
                  paddingRight: 12,
                }}
              >
                <span
                  className="font-mono text-xs text-[#61afef] flex-shrink-0 mr-3"
                  style={{ minWidth: 55 }}
                >
                  {node.commit.shortOid}
                </span>

                {/* 分支标签 */}
                {node.branchNames.length > 0 && (
                  <div className="flex flex-wrap gap-1 mr-2">
                    {node.branchNames.map((branchName) => {
                      const isCurrent = branches.find(br => br.current && br.name === branchName);
                      return (
                        <span
                          key={branchName}
                          className="text-xs px-1.5 py-0 rounded flex-shrink-0"
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

                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mr-2"
                  style={{
                    backgroundColor: getAvatarColor(node.commit.authorEmail),
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                  }}
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
