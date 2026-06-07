import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRepoStore, type GitCommit, type GitBranch } from '../../stores/repoStore';
import { useContextMenu, type MenuItem } from '../contextmenu/ContextMenu';

const BRANCH_COLORS = [
  '#e05673', // 红色 - 主分支
  '#5b8def', // 蓝色
  '#68c263', // 绿色
  '#c9a73c', // 黄色
  '#a06cd5', // 紫色
  '#3eb4c6', // 青色
  '#d4844e', // 橙色
  '#e86580', // 粉色
];

const ROW_HEIGHT = 36;
const COLUMN_WIDTH = 20; // 更窄的列宽
const NODE_RADIUS = 3.5; // 稍微减小节点
const GRAPH_WIDTH = 140; // 相应减小画布宽度

interface GraphNode {
  commit: GitCommit;
  column: number;
  color: string;
  row: number;
  isMainBranch: boolean;
  branchNames: string[]; // 添加分支名称
}

interface Slot {
  nextParentHash: string;
  color: string;
}

function buildGraphNodes(
  commits: GitCommit[],
  branches: GitBranch[]
): GraphNode[] {
  if (commits.length === 0) return [];

  const nodes: GraphNode[] = [];
  
  // 创建分支到提交的映射
  const branchMap = new Map<string, string[]>();
  for (const branch of branches) {
    if (branch.oid) {
      if (!branchMap.has(branch.oid)) {
        branchMap.set(branch.oid, []);
      }
      branchMap.get(branch.oid)!.push(branch.name);
    }
  }
  
  // 活跃插槽：每个插槽代表一个垂直列
  const activeSlots: Map<string, Slot> = new Map();
  
  // 找到主分支
  const mainBranch = branches.find(
    (b) => b.name === 'main' || b.name === 'master' || b.current
  );
  const mainBranchOid = mainBranch?.oid;

  // 从最新到最旧遍历（从上到下）
  for (let row = 0; row < commits.length; row++) {
    const commit = commits[row];
    let column: number;
    let color: string;

    // 1. 处理入度：检查是否有插槽正在寻找这个 commit
    let existingSlotKey: string | undefined;
    for (const [key, slot] of activeSlots) {
      if (slot.nextParentHash === commit.oid) {
        existingSlotKey = key;
        break;
      }
    }

    if (existingSlotKey) {
      // 有插槽指向它，使用该插槽
      const slotIndex = parseInt(existingSlotKey);
      column = slotIndex;
      color = activeSlots.get(existingSlotKey)!.color;
      activeSlots.delete(existingSlotKey);
    } else {
      // 没有插槽指向它，是一个新分支的顶端，找一个新的可用插槽
      let newColumn = 0;
      const usedColumns = new Set<number>();
      for (const key of activeSlots.keys()) {
        usedColumns.add(parseInt(key));
      }
      while (usedColumns.has(newColumn)) {
        newColumn++;
      }
      column = newColumn;
      color = BRANCH_COLORS[column % BRANCH_COLORS.length];
    }

    // 2. 处理出度：设置父节点的插槽
    for (let i = 0; i < commit.parentIds.length; i++) {
      const parentOid = commit.parentIds[i];
      
      if (i === 0) {
        // 第一个父节点继承当前插槽
        activeSlots.set(column.toString(), {
          nextParentHash: parentOid,
          color: color,
        });
      } else {
        // 合并提交的其他父节点，分配新的插槽
        let mergeColumn = 0;
        const usedColumns = new Set<number>();
        for (const key of activeSlots.keys()) {
          usedColumns.add(parseInt(key));
        }
        while (usedColumns.has(mergeColumn)) {
          mergeColumn++;
        }
        activeSlots.set(mergeColumn.toString(), {
          nextParentHash: parentOid,
          color: BRANCH_COLORS[mergeColumn % BRANCH_COLORS.length],
        });
      }
    }

    // 判断是否是主分支
    const isMainBranch = mainBranchOid === commit.oid || column === 0;
    
    // 如果是主分支，强制使用主颜色
    if (isMainBranch) {
      color = BRANCH_COLORS[0];
    }

    const node: GraphNode = {
      commit,
      column,
      color,
      row,
      isMainBranch,
      branchNames: branchMap.get(commit.oid) || [],
    };

    nodes.push(node);
  }

  return nodes;
}

function formatRelativeTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}

function getAvatarColor(email: string): string {
  const colors = [
    '#5b8def', '#68c263', '#c9a73c', '#a06cd5',
    '#3eb4c6', '#e86580', '#d4844e', '#5b8def',
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

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

  const graphNodes = useMemo(() => {
    return buildGraphNodes(commits, branches);
  }, [commits, branches]);

  const totalHeight = commits.length * ROW_HEIGHT;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = GRAPH_WIDTH;
    const height = totalHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);

    // 先绘制所有连线
    for (let i = 0; i < graphNodes.length; i++) {
      const node = graphNodes[i];
      const nodeX = node.column * COLUMN_WIDTH + COLUMN_WIDTH / 2;
      const nodeY = node.row * ROW_HEIGHT + ROW_HEIGHT / 2;

      for (let j = 0; j < node.commit.parentIds.length; j++) {
        const parentOid = node.commit.parentIds[j];
        const parentNode = graphNodes.find((n) => n.commit.oid === parentOid);
        if (!parentNode) continue;

        const parentX = parentNode.column * COLUMN_WIDTH + COLUMN_WIDTH / 2;
        const parentY = parentNode.row * ROW_HEIGHT + ROW_HEIGHT / 2;

        const isMainBranch = node.isMainBranch || parentNode.isMainBranch;
        const lineWidth = isMainBranch ? 2.2 : 1.4;

        // Fork风格：更细的线条
        ctx.strokeStyle = node.color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        drawConnectingLine(ctx, nodeX, nodeY, parentX, parentY);
        ctx.stroke();
      }
    }

    // 绘制所有节点
    for (let i = 0; i < graphNodes.length; i++) {
      const node = graphNodes[i];
      const nodeX = node.column * COLUMN_WIDTH + COLUMN_WIDTH / 2;
      const nodeY = node.row * ROW_HEIGHT + ROW_HEIGHT / 2;

      // Fork风格：更小更精致的节点
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(nodeX, nodeY, NODE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      
      // Fork风格：细白色边框
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(nodeX, nodeY, NODE_RADIUS - 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [graphNodes, totalHeight]);

  function drawConnectingLine(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) {
    if (Math.abs(x1 - x2) < 8) {
      // 同列：直线
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    } else {
      // Fork风格：平滑的曲线
      const dx = Math.abs(x2 - x1);
      const dy = y2 - y1;
      
      // Fork风格的平滑曲线 - 更自然的弯曲
      const startControlOffset = Math.min(Math.abs(dy) * 0.35, 14);
      const endControlOffset = Math.min(Math.abs(dy) * 0.35, 14);
      
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(
        x1, y1 + startControlOffset,
        x2, y2 - endControlOffset,
        x2, y2
      );
    }
  }

  function lightenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    const B = Math.min(255, (num & 0x0000ff) + amt);
    return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
  }

  function darkenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
    const B = Math.max(0, (num & 0x0000ff) - amt);
    return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
  }

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
      { id: 'create-branch', label: '从这里创建分支...', onClick: () => onCreateBranch?.(oid) },
      { id: 'create-tag', label: '从这里创建标签...', onClick: () => onCreateTag?.(oid) },
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

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 border-b border-panel-border bg-[#1e1e1e] flex items-center text-xs text-gray-400 flex-shrink-0">
        <span style={{ width: GRAPH_WIDTH }} className="flex-shrink-0"></span>
        <span className="flex-1">提交</span>
        <span className="w-24 flex-shrink-0 text-right">作者</span>
        <span className="w-20 flex-shrink-0 text-right">日期</span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-[#1e1e1e]"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
          {/* 左侧分支图 Canvas - sticky定位 */}
          <div
            className="sticky left-0 top-0 z-10"
            style={{
              width: GRAPH_WIDTH,
              height: totalHeight,
              backgroundColor: '#1e1e1e',
              borderRight: '1px solid #3c3c3c',
            }}
          >
            <canvas
              ref={canvasRef}
              style={{ display: 'block' }}
            />
          </div>

          {/* 提交记录列表 */}
          {graphNodes.map((node) => {
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
                  paddingLeft: GRAPH_WIDTH + 12,
                  paddingRight: 12,
                }}
              >
                <span
                  className="font-mono text-xs text-[#61afef] flex-shrink-0 mr-3"
                  style={{ minWidth: 55 }}
                >
                  {node.commit.shortOid}
                </span>

                {/* 分支名称标签 */}
                {node.branchNames.length > 0 && (
                  <div className="flex flex-wrap gap-1 mr-2">
                    {node.branchNames.map((branchName) => (
                      <span
                        key={branchName}
                        className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: `${node.color}33`,
                          color: node.color,
                          border: `1px solid ${node.color}66`,
                        }}
                      >
                        {branchName}
                      </span>
                    ))}
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
