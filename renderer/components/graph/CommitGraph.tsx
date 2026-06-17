/**
 * 提交图组件（Fork 风格）
 *
 * Fork 风格特点：
 * 1. 提交记录紧跟分支节点，无间隙
 * 2. 无"全部/分支"切换按钮
 * 3. 无折叠/展开合并提交功能
 * 4. 分支标签直接显示在提交记录左侧
 * 5. 作者头像、名称、时间水平排列
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRepoStore, type GitCommit, type GitBranch } from '../../stores/repoStore';
import { useShallow } from 'zustand/react/shallow';
import type { GraphNode } from '../../../shared/types/git';
import { useContextMenu, type MenuItem } from '../contextmenu/ContextMenu';

// ============================================================
// 常量
// ============================================================
const BRANCH_COLORS = [
  '#e05673', '#5b8def', '#68c263', '#c9a73c', '#a06cd5',
  '#3eb4c6', '#d4844e', '#e86580', '#7ec8e3', '#b5e48c',
];

const ROW_HEIGHT = 32;
const LANE_WIDTH = 24;
const NODE_RADIUS = 3.5;
const VISIBLE_BUFFER = 20;

// ============================================================
// 类型
// ============================================================

/** 连续路径 — Fork 风格简化版 */
interface GraphPath {
  id: number;
  points: Array<{ x: number; y: number }>;
  color: number;
}

/** 路径间连接线（合并/分叉时的弧线） */
interface GraphLink {
  start: { x: number; y: number };
  end: { x: number; y: number };
  control: { x: number; y: number };
  color: number;
}

/** 节点类型 */
type DotType = 'default' | 'head' | 'merge';

/** 节点 */
interface GraphDot {
  center: { x: number; y: number };
  color: number;
  type: DotType;
}

/** 图数据（算法输出） */
interface GraphData {
  paths: GraphPath[];
  links: GraphLink[];
  dots: GraphDot[];
  /** 预计算的路径 Y 范围（性能优化） */
  pathBounds: Array<{ minY: number; maxY: number }>;
}

// ============================================================
// ColorPicker — 颜色回收池
// ============================================================
class ColorPicker {
  private queue: number[] = [];
  private count: number;

  constructor(count: number) {
    this.count = count;
  }

  next(): number {
    if (this.queue.length === 0) {
      for (let i = 0; i < this.count; i++) this.queue.push(i);
    }
    return this.queue.shift()!;
  }

  recycle(idx: number) {
    if (!this.queue.includes(idx)) this.queue.push(idx);
  }
}

// ============================================================
// PathHelper — 追踪一条连续分支路径
// ============================================================
class PathHelper {
  path: GraphPath;
  next: string;       // 下一个目标 commit SHA
  lastX: number;
  private lastY: number;
  private endY: number = 0;

  constructor(next: string, color: number, startX: number, startY: number) {
    this.next = next;
    this.lastX = startX;
    this.lastY = startY;
    this.path = { id: color, points: [{ x: startX, y: startY }], color };
  }

  /** 路径经过此行但无提交 — 水平偏移 + 垂直延伸 */
  pass(x: number, y: number, halfH: number) {
    if (x > this.lastX) {
      this.addPoint(this.lastX, this.lastY);
      this.addPoint(x, y - halfH);
    } else if (x < this.lastX) {
      this.addPoint(this.lastX, y - halfH);
      this.addPoint(x, y);
    }
    this.lastX = x;
    this.lastY = y;
  }

  /** 路径在此行有提交，继续向下 */
  goto(x: number, y: number, halfH: number) {
    if (x > this.lastX) {
      this.addPoint(this.lastX, this.lastY);
      this.addPoint(x, y - halfH);
    } else if (x < this.lastX) {
      const minY = y - halfH;
      this.addPoint(this.lastX, minY > this.lastY ? minY - halfH : minY);
      this.addPoint(x, y);
    }
    this.lastX = x;
    this.lastY = y;
  }

  /** 路径在此行结束 */
  end(x: number, y: number, halfH: number) {
    if (x > this.lastX) {
      this.addPoint(this.lastX, this.lastY);
      this.addPoint(x, y - halfH);
    } else if (x < this.lastX) {
      this.addPoint(this.lastX, y - halfH);
    }
    this.addPoint(x, y);
    this.lastX = x;
    this.lastY = y;
  }

  private addPoint(x: number, y: number) {
    if (this.endY < y) {
      this.path.points.push({ x, y });
      this.endY = y;
    }
  }
}

// ============================================================
// Fork 风格提交图生成算法
// ============================================================
function generateGraph(
  commits: GitCommit[],
  branches: GitBranch[]
): { graphData: GraphData; nodes: GraphNode[]; maxLane: number } {
  if (commits.length === 0) return { graphData: { paths: [], links: [], dots: [], pathBounds: [] }, nodes: [], maxLane: 0 };

  const UNIT_W = LANE_WIDTH;
  const HALF_W = UNIT_W / 2;
  const UNIT_H = 1;
  const HALF_H = 0.5;

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

  // 按时间降序（新→旧）
  const sorted = [...commits].sort((a, b) => b.committerTimestamp - a.committerTimestamp);

  // ========== 核心算法 ==========
  const graphResult: GraphData = { paths: [], links: [], dots: [] };
  const unsolved: PathHelper[] = [];
  const ended: PathHelper[] = [];
  let offsetY = -HALF_H;
  const colorPicker = new ColorPicker(BRANCH_COLORS.length);
  let peakLanes = 0;

  const nodes: GraphNode[] = [];

  for (let ci = 0; ci < sorted.length; ci++) {
    const commit = sorted[ci];
    offsetY += UNIT_H;

    let major: PathHelper | null = null;
    let offsetX = 4 - HALF_W;

    // 找到连接到此 commit 的第一条路径（major = 第一父节点路径）
    for (const l of unsolved) {
      if (l.next === commit.oid) {
        if (!major) {
          offsetX += UNIT_W;
          major = l;

          if (commit.parentIds.length > 0) {
            major.next = commit.parentIds[0];
            major.goto(offsetX, offsetY, HALF_H);
          } else {
            major.end(offsetX, offsetY, HALF_H);
            ended.push(l);
          }
        } else {
          // 其他路径合并到 major
          l.end(major.lastX, offsetY, HALF_H);
          ended.push(l);
        }
      } else {
        // 路径经过此行，无提交
        offsetX += UNIT_W;
        l.pass(offsetX, offsetY, HALF_H);
      }
    }

    // 清除已结束的路径
    for (const l of ended) {
      colorPicker.recycle(l.path.color);
      const idx = unsolved.indexOf(l);
      if (idx !== -1) unsolved.splice(idx, 1);
    }
    ended.length = 0;

    // 如果没有 major，新建路径（分支诞生点）
    if (!major) {
      offsetX += UNIT_W;
      if (commit.parentIds.length > 0) {
        major = new PathHelper(commit.parentIds[0], colorPicker.next(), offsetX, offsetY);
        unsolved.push(major);
        graphResult.paths.push(major.path);
      }
    }

    // 追踪峰值车道数
    if (unsolved.length > peakLanes) peakLanes = unsolved.length;

    // 节点位置
    const position = { x: major?.lastX ?? offsetX, y: offsetY };
    const dotColor = major?.path.color ?? 0;
    const isMerge = commit.parentIds.length > 1;
    const isHead = branches.some(b => b.current && b.oid === commit.oid);

    let dotType: DotType = 'default';
    if (isHead) dotType = 'head';
    else if (isMerge) dotType = 'merge';

    graphResult.dots.push({
      center: position,
      color: dotColor,
      type: dotType,
    });

    // 处理第二及之后的父节点（合并线）
    for (let j = 1; j < commit.parentIds.length; j++) {
      const parentHash = commit.parentIds[j];
      const parent = unsolved.find(x => x.next === parentHash);
      if (parent) {
        graphResult.links.push({
          start: position,
          end: { x: parent.lastX, y: offsetY + HALF_H },
          control: { x: parent.lastX, y: position.y },
          color: parent.path.color,
        });
      } else {
        // 新路径从此合并线诞生
        offsetX += UNIT_W;
        const l = new PathHelper(parentHash, colorPicker.next(), position.x, position.y);
        l.path.points.push({ x: offsetX, y: position.y + HALF_H });
        l.lastX = offsetX;
        l.lastY = position.y + HALF_H;
        unsolved.push(l);
        graphResult.paths.push(l.path);
      }
    }

    // 计算 lane（从 x 坐标推导）
    const lane = Math.round((position.x - 4 + HALF_W) / UNIT_W);

    // 构建 GraphNode（Fork 风格：无折叠相关字段）
    const branchNames = branchMap.get(commit.oid) || [];

    nodes.push({
      commit,
      lane,
      color: BRANCH_COLORS[dotColor % BRANCH_COLORS.length],
      row: ci,
      isMainBranch: branchNames.some(b => b === 'main' || b === 'master'),
      branchNames,
      isMergeCommit: isMerge,
      collapsedCommitCount: 0,
      isCollapsed: false,
      collapseParentOid: null,
    });
  }

  // 处理未结束的路径 — 沿当前 x 位置向下延伸
  const endY = (commits.length + 0.5) * UNIT_H;
  for (let i = 0; i < unsolved.length; i++) {
    const path = unsolved[i];
    path.end(path.lastX, endY, HALF_H);
  }

  const maxLane = peakLanes;

  // 预计算路径 Y 范围（避免每帧重复遍历）
  const pathBounds = graphResult.paths.map(path => {
    if (path.points.length === 0) return { minY: 0, maxY: 0 };
    let minY = Infinity, maxY = -Infinity;
    for (const pt of path.points) {
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    return { minY, maxY };
  });
  graphResult.pathBounds = pathBounds;

  return { graphData: graphResult, nodes, maxLane };
}

// ============================================================
// 工具函数
// ============================================================
function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = ((hash << 5) - hash + email.charCodeAt(i)) | 0;
  const colors = ['#5b8def', '#e05673', '#68c263', '#c9a73c', '#a06cd5', '#3eb4c6'];
  return colors[Math.abs(hash) % colors.length];
}

function formatRelativeTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  const isThisYear = date.getFullYear() === now.getFullYear();
  
  if (isToday) {
    // 今天：显示具体时间（时分秒）
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } else if (isThisYear) {
    // 今年：显示月日时分
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  } else {
    // 其他：显示完整日期时分
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
}

// ============================================================
// CommitGraph 组件
// ============================================================
interface CommitGraphProps {
  onCommitSelect?: (oid: string) => void;
  onCheckout?: (oid: string) => void;
  onCreateBranch?: (oid: string) => void;
  onCreateTag?: (oid: string) => void;
  onReset?: (oid: string) => void;
  onCherryPick?: (oid: string) => void;
  onRevert?: (oid: string) => void;
  onSavePatch?: (oid: string) => void;
  selectedCommit?: string | null;
}

function CommitGraph({
  onCommitSelect, onCheckout, onCreateBranch, onCreateTag,
  onReset, onCherryPick, onRevert, onSavePatch, selectedCommit: propSelectedCommit,
}: CommitGraphProps) {
  const { commits, branches } = useRepoStore(useShallow((state) => ({ commits: state.commits, branches: state.branches })));
  const selectedCommit = propSelectedCommit ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // RAF 节流滚动（避免每像素 setState 触发重渲染）
  const rafRef = useRef<number>(0);
  const [scrollTop, setScrollTopRaw] = useState(0);
  const setScrollTop = useCallback((value: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setScrollTopRaw(value));
  }, []);
  const [containerHeight, setContainerHeight] = useState(0);

  // 使用 useMemo 缓存图数据：只在 commits/branches 数据真正变化时重新计算
  const graphResult = useMemo(() => generateGraph(commits, branches), [commits, branches]);
  const { graphData, nodes: graphNodes, maxLane } = graphResult;

  const totalHeight = graphNodes.length * ROW_HEIGHT;
  const graphWidth = Math.max(72, (maxLane + 1) * LANE_WIDTH + 12);

  // 空状态处理
  const isEmptyState = !commits || commits.length === 0;

  // 容器尺寸
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Canvas 尺寸变化时重设画布（不随 scrollTop 变化）
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || totalHeight <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const w = graphWidth;
    const h = totalHeight;
    
    // 只在尺寸变化时重设 canvas
    if (canvasSizeRef.current.w !== w || canvasSizeRef.current.h !== h) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvasSizeRef.current = { w, h };
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // 计算可见区域（优化性能）
    const visibleTop = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_BUFFER);
    const visibleBottom = Math.min(graphNodes.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VISIBLE_BUFFER);

    // 1. 绘制路径曲线（只绘制可见区域，使用预计算的 pathBounds）
    const bounds = graphData.pathBounds;
    for (let pi = 0; pi < graphData.paths.length; pi++) {
      const path = graphData.paths[pi];
      if (path.points.length < 2) continue;

      // 使用预计算的 Y 范围跳过不可见路径
      const b = bounds[pi];
      if (b.maxY < visibleTop || b.minY > visibleBottom) continue;

      ctx.strokeStyle = BRANCH_COLORS[path.color % BRANCH_COLORS.length];
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      ctx.beginPath();
      let started = false;
      let prevPt: { x: number; y: number } | null = null;

      for (let i = 0; i < path.points.length; i++) {
        const pt = path.points[i];
        const sx = pt.x;
        const sy = pt.y * ROW_HEIGHT;

        if (!started) {
          ctx.moveTo(sx, sy);
          started = true;
        } else if (prevPt) {
          if (sx > prevPt.x) {
            ctx.quadraticCurveTo(sx, prevPt.y, sx, sy);
          } else if (sx < prevPt.x) {
            const midY = (prevPt.y + sy) / 2;
            ctx.bezierCurveTo(prevPt.x, midY + 4, sx, midY - 4, sx, sy);
          } else {
            ctx.lineTo(sx, sy);
          }
        }

        prevPt = { x: sx, y: sy };
      }
      ctx.stroke();
    }

    // 2. 绘制连接线（合并弧线）（只绘制可见区域）
    for (const link of graphData.links) {
      // 跳过不可见的连接线
      if (link.start.y > visibleBottom || link.end.y < visibleTop) continue;

      const sy1 = link.start.y * ROW_HEIGHT;
      const sy2 = link.end.y * ROW_HEIGHT;

      ctx.strokeStyle = BRANCH_COLORS[link.color % BRANCH_COLORS.length];
      ctx.lineWidth = 1.6;
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.moveTo(link.start.x, sy1);
      ctx.quadraticCurveTo(link.control.x, link.control.y * ROW_HEIGHT, link.end.x, sy2);
      ctx.stroke();
    }

    // 3. 绘制节点（只绘制可见区域）
    for (let row = visibleTop; row < visibleBottom; row++) {
      const dot = graphData.dots[row];
      if (!dot) continue;

      const x = dot.center.x;
      const y = dot.center.y * ROW_HEIGHT;
      const color = BRANCH_COLORS[dot.color % BRANCH_COLORS.length];

      switch (dot.type) {
        case 'head':
          // HEAD 双圈
          ctx.fillStyle = '#1a1d21';
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'merge':
          // 合并提交十字标记
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
          // 十字
          ctx.strokeStyle = '#1a1d21';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, y - 3);
          ctx.lineTo(x, y + 3);
          ctx.moveTo(x - 3, y);
          ctx.lineTo(x + 3, y);
          ctx.stroke();
          break;

        default:
          // 普通提交 — 实心圆
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
          ctx.fill();
          // 细边框
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 0.6;
          ctx.stroke();
          break;
      }

      // 选中高亮环
      if (selectedCommit === graphNodes[row]?.commit.oid) {
        ctx.strokeStyle = BRANCH_COLORS[dot.color % BRANCH_COLORS.length];
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(x, y, dot.type === 'head' ? 9 : dot.type === 'merge' ? 8 : 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }, [graphData, graphNodes, graphWidth, totalHeight, selectedCommit, maxLane, scrollTop, containerHeight]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const st = e.currentTarget.scrollTop;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setScrollTopRaw(st));
  }, []);

  // ========== 右键菜单（Fork 风格：无折叠选项） ==========
  const [contextMenuItems, setContextMenuItems] = useState<MenuItem[]>([]);
  const [contextMenuOid, setContextMenuOid] = useState<string | null>(null);
  const { showContextMenu, ContextMenuWrapper } = useContextMenu(() => contextMenuOid ? contextMenuItems : []);

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
  const lastVisibleRow = Math.min(graphNodes.length - 1, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VISIBLE_BUFFER);

  // 空状态渲染
  if (isEmptyState) {
    return (
      <div className="h-full flex flex-col bg-[#1a1d21]">
        <div className="px-3 py-1.5 border-b border-[#2d333b] flex items-center text-xs text-gray-400 flex-shrink-0" style={{ background: '#15181c' }}>
          <span>Commit</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">📭</div>
            <div>暂无提交记录</div>
            <div className="text-sm text-gray-600 mt-1">请打开一个 Git 仓库查看提交历史</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1a1d21]">
      {/* 表头 - Fork 风格：简洁无多余按钮 */}
      <div className="flex items-center text-xs text-gray-400 flex-shrink-0 border-b border-[#2d333b]" style={{ height: 26, background: '#15181c' }}>
        <div className="flex-1 flex items-center" style={{ paddingLeft: graphWidth + 12 }}>
          <span>Commit</span>
        </div>
        <span style={{ width: 100 }} className="flex-shrink-0 text-center">Author</span>
        <span style={{ width: 130 }} className="flex-shrink-0 text-right pr-2">Date</span>
        <span style={{ width: 70 }} className="flex-shrink-0 text-right pr-4">SHA</span>
      </div>

      {/* 滚动区域 - Fork 风格完全合并布局 */}
      <div ref={containerRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Canvas 分支图 */}
          <div style={{ position: 'absolute', left: 0, top: 0, width: graphWidth, height: totalHeight, pointerEvents: 'none', zIndex: 1 }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
          </div>

          {/* 提交记录列表 - Fork 风格：内容紧跟节点 */}
          {graphNodes.slice(firstVisibleRow, lastVisibleRow + 1).map((node) => {
            const isStash = node.commit.oid.startsWith('stash-') || node.commit.shortOid.startsWith('stash@');
            
            // Fork 风格：内容紧跟节点
            const contentStartX = (node.lane + 1) * LANE_WIDTH + 8;

            return (
              <div
                key={node.commit.oid}
                onClick={() => !isStash && onCommitSelect?.(node.commit.oid)}
                onContextMenu={(e) => !isStash && handleContextMenu(e, node.commit.oid)}
                className={`absolute left-0 right-0 flex items-center cursor-pointer ${
                  isStash ? 'bg-[#252525]' : ''
                } hover:bg-[#252b34] transition-colors`}
                style={{ top: node.row * ROW_HEIGHT, height: ROW_HEIGHT, zIndex: 2 }}
              >
                {/* Fork 风格：提交记录从节点右侧开始 */}
                <div className="flex-1 flex items-center min-w-0" style={{ paddingLeft: contentStartX, paddingRight: 8 }}>
                  {/* 分支标签（Fork 风格：紧挨着节点） */}
                  {!isStash && node.branchNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 flex-shrink-0">
                      {node.branchNames.slice(0, 2).map((branchName) => {
                        const isCurrent = branches.find(br => br.current && br.name === branchName);
                        const isRemote = branchName.startsWith('origin/');
                        const displayName = isRemote ? branchName.replace(/^origin\//, '') : branchName;
                        return (
                          <span key={branchName} 
                            className="text-[11px] px-1.5 py-0.5 rounded flex-shrink-0 max-w-[120px] truncate"
                            title={branchName}
                            style={{
                              backgroundColor: `${node.color}44`,
                              color: node.color,
                              fontWeight: isCurrent ? 600 : 400,
                            }}
                          >
                            {isCurrent ? '● ' : ''}{displayName}
                          </span>
                        );
                      })}
                      {node.branchNames.length > 2 && (
                        <span className="text-[11px] text-gray-400 flex-shrink-0 bg-gray-700/30 px-1.5 py-0.5 rounded">
                          +{node.branchNames.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  {isStash ? (
                    <span className="font-mono text-xs flex-shrink-0" style={{ color: '#e8c547' }}>
                      {node.commit.shortOid}
                    </span>
                  ) : (
                    <>
                      {/* 提交消息 - Fork 风格，紧跟分支标签 */}
                      <span className="flex-1 min-w-0 text-sm text-gray-200 truncate ml-2">
                        {node.commit.message}
                      </span>

                      {/* 作者 - Fork 风格 */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-4" style={{ width: '90px' }}>
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0"
                          style={{ backgroundColor: getAvatarColor(node.commit.authorEmail) }}>
                          {node.commit.authorName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-gray-300 truncate">{node.commit.authorName}</span>
                      </div>

                      {/* 日期 - Fork 风格：显示具体时间（时分秒） */}
                      <span className="text-xs text-gray-400 flex-shrink-0 text-right ml-4" style={{ width: '125px' }}>
                        {formatRelativeTime(node.commit.authorTimestamp)}
                      </span>

                      {/* HASH */}
                      <span className="text-xs font-mono text-gray-400 flex-shrink-0 text-right ml-2" style={{ width: '70px' }}>
                        {node.commit.shortOid}
                      </span>
                    </>
                  )}
                </div>
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