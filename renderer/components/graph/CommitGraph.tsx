/**
 * 提交图组件（SourceGit 风格路径算法重写）
 *
 * 核心改进（基于 SourceGit 开源参考）：
 * 1. Path-based 连续路径追踪 — 每个分支是一条连续 Path，不是独立 edge
 * 2. ColorPicker 颜色回收 — 路径结束时回收颜色，避免颜色浪费
 * 3. Quadratic Bezier 平滑曲线 — 统一曲线风格，告别直线+贝塞尔混搭
 * 4. 分支高亮模式 — 当前分支高亮，其余灰化
 * 5. 合并十字标记 + HEAD 双圈 — 视觉区分度更高
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRepoStore, type GitCommit, type GitBranch } from '../../stores/repoStore';
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
const GRAPH_MIN_WIDTH = 160;
const VISIBLE_BUFFER = 20;

// ============================================================
// 类型
// ============================================================

/** 连续路径 — SourceGit 核心数据结构 */
interface GraphPath {
  id: number;
  points: Array<{ x: number; y: number }>;
  color: number;
  isHighlighted: boolean;
}

/** 路径间连接线（合并/分叉时的弧线） */
interface GraphLink {
  start: { x: number; y: number };
  end: { x: number; y: number };
  control: { x: number; y: number };
  color: number;
  isHighlighted: boolean;
}

/** 节点类型 */
type DotType = 'default' | 'head' | 'merge';

/** 节点 */
interface GraphDot {
  center: { x: number; y: number };
  color: number;
  type: DotType;
  isHighlighted: boolean;
}

/** 图数据（算法输出） */
interface GraphData {
  paths: GraphPath[];
  links: GraphLink[];
  dots: GraphDot[];
}

// ============================================================
// ColorPicker — 颜色回收池（SourceGit 方式）
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
// PathHelper — 追踪一条连续分支路径（SourceGit 核心算法移植）
// ============================================================
class PathHelper {
  path: GraphPath;
  next: string;       // 下一个目标 commit SHA
  lastX: number;
  private lastY: number;
  private endY: number = 0;

  constructor(next: string, isHighlighted: boolean, color: number, startX: number, startY: number) {
    this.next = next;
    this.lastX = startX;
    this.lastY = startY;
    this.path = { id: color, points: [{ x: startX, y: startY }], color, isHighlighted };
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

  /** 路径高亮切换 — 断开旧路径，新建高亮路径 */
  highlight() {
    const color = this.path.color;
    this.addPoint(this.lastX, this.lastY);
    this.path = { id: color, points: [{ x: this.lastX, y: this.lastY }], color, isHighlighted: true };
    this.endY = 0;
  }

  private addPoint(x: number, y: number) {
    if (this.endY < y) {
      this.path.points.push({ x, y });
      this.endY = y;
    }
  }
}

// ============================================================
// SourceGit 风格提交图生成算法
// ============================================================
function generateGraph(
  commits: GitCommit[],
  branches: GitBranch[],
  collapsedMergeOids: Set<string>,
  highlightMode: 'all' | 'current-branch'
): { graphData: GraphData; nodes: GraphNode[]; maxLane: number } {
  if (commits.length === 0) return { graphData: { paths: [], links: [], dots: [] }, nodes: [], maxLane: 0 };

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

  // 主分支
  const mainBranch = branches.find(b => b.name === 'main' || b.name === 'master' || b.current);
  const currentBranchName = branches.find(b => b.current)?.name;

  // 按时间降序（新→旧）
  const sorted = [...commits].sort((a, b) => b.committerTimestamp - a.committerTimestamp);

  // 判断是否在当前分支上（简化版：递归追踪第一父节点）
  const currentBranchOids = new Set<string>();
  if (currentBranchName) {
    const headBranch = branches.find(b => b.current);
    if (headBranch?.oid) {
      let cur: string | undefined = headBranch.oid;
      const visited = new Set<string>();
      while (cur && !visited.has(cur)) {
        visited.add(cur);
        currentBranchOids.add(cur);
        const c = commitMap.get(cur);
        cur = c?.parentIds[0];
      }
    }
  }

  // 计算折叠
  const mergeToMerged = new Map<string, string[]>();
  for (const commit of sorted) {
    if (commit.parentIds.length < 2) continue;
    const secondParentOid = commit.parentIds[1];
    const firstParentOid = commit.parentIds[0];
    const firstAncestors = new Set<string>();
    let current: string | undefined = firstParentOid;
    let safety = 0;
    while (current && safety < 500) {
      firstAncestors.add(current);
      const c = commitMap.get(current);
      if (!c) break;
      current = c.parentIds[0];
      safety++;
    }
    const merged: string[] = [];
    current = secondParentOid;
    safety = 0;
    while (current && !firstAncestors.has(current) && safety < 500) {
      merged.push(current);
      const c = commitMap.get(current);
      if (!c) break;
      current = c.parentIds[0];
      safety++;
    }
    mergeToMerged.set(commit.oid, merged);
  }

  const collapsedOids = new Set<string>();
  for (const mergeOid of collapsedMergeOids) {
    const merged = mergeToMerged.get(mergeOid) || [];
    for (const oid of merged) collapsedOids.add(oid);
  }

  // 过滤可见提交
  const visibleCommits = sorted.filter(c => !collapsedOids.has(c.oid));

  // ========== 核心算法 ==========
  const graphResult: GraphData = { paths: [], links: [], dots: [] };
  const unsolved: PathHelper[] = [];
  const ended: PathHelper[] = [];
  let offsetY = -HALF_H;
  const colorPicker = new ColorPicker(BRANCH_COLORS.length);
  let peakLanes = 0;

  const nodes: GraphNode[] = [];

  for (let ci = 0; ci < visibleCommits.length; ci++) {
    const commit = visibleCommits[ci];
    offsetY += UNIT_H;

    let major: PathHelper | null = null;
    let offsetX = 4 - HALF_W;
    const maxOffsetOld = unsolved.length > 0 ? unsolved[unsolved.length - 1].lastX : offsetX + UNIT_W;

    // 找到连接到此 commit 的第一条路径（major = 第一父节点路径）
    let isHighlighted = false;

    for (const l of unsolved) {
      if (l.next === commit.oid) {
        if (!major) {
          offsetX += UNIT_W;
          major = l;
          isHighlighted = major.path.isHighlighted;

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
          if (!isHighlighted && l.path.isHighlighted) isHighlighted = true;
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

    // 高亮判断
    if (!isHighlighted) {
      if (highlightMode === 'all') {
        isHighlighted = true;
      } else if (highlightMode === 'current-branch') {
        isHighlighted = currentBranchOids.has(commit.oid);
      }
    }

    // 如果没有 major，新建路径（分支诞生点）
    if (!major) {
      offsetX += UNIT_W;
      if (commit.parentIds.length > 0) {
        major = new PathHelper(commit.parentIds[0], isHighlighted, colorPicker.next(), offsetX, offsetY);
        unsolved.push(major);
        graphResult.paths.push(major.path);
      }
    } else if (isHighlighted && !major.path.isHighlighted && commit.parentIds.length > 0) {
      major.highlight();
      graphResult.paths.push(major.path);
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
      isHighlighted,
    });

    // 处理第二及之后的父节点（合并线）
    for (let j = 1; j < commit.parentIds.length; j++) {
      const parentHash = commit.parentIds[j];
      const parent = unsolved.find(x => x.next === parentHash);
      if (parent) {
        if (isHighlighted && !parent.path.isHighlighted) {
          parent.goto(parent.lastX, offsetY + HALF_H, HALF_H);
          parent.highlight();
          graphResult.paths.push(parent.path);
        }
        graphResult.links.push({
          start: position,
          end: { x: parent.lastX, y: offsetY + HALF_H },
          control: { x: parent.lastX, y: position.y },
          color: parent.path.color,
          isHighlighted,
        });
      } else {
        // 新路径从此合并线诞生
        offsetX += UNIT_W;
        const l = new PathHelper(parentHash, isHighlighted, colorPicker.next(), position.x, position.y);
        l.path.points.push({ x: offsetX, y: position.y + HALF_H });
        l.lastX = offsetX;
        l.lastY = position.y + HALF_H;
        unsolved.push(l);
        graphResult.paths.push(l.path);
      }
    }

    // 计算 lane（从 x 坐标推导）
    const lane = Math.round((position.x - 4 + HALF_W) / UNIT_W);

    // 构建 GraphNode
    const branchNames = branchMap.get(commit.oid) || [];
    const collapsedCommitCount = isMerge && collapsedMergeOids.has(commit.oid)
      ? (mergeToMerged.get(commit.oid) || []).filter(oid => collapsedOids.has(oid)).length
      : 0;

    nodes.push({
      commit,
      lane,
      color: BRANCH_COLORS[dotColor % BRANCH_COLORS.length],
      row: ci,
      isMainBranch: branchNames.some(b => b === 'main' || b === 'master'),
      branchNames,
      isMergeCommit: isMerge,
      collapsedCommitCount,
      isCollapsed: collapsedMergeOids.has(commit.oid),
      collapseParentOid: null,
    });
  }

  // 处理未结束的路径 — 沿当前 x 位置向下延伸
  const endY = (visibleCommits.length + 0.5) * UNIT_H;
  for (let i = 0; i < unsolved.length; i++) {
    const path = unsolved[i];
    path.end(path.lastX, endY, HALF_H);
  }

  const maxLane = peakLanes;
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

// 计算对比度颜色，确保文字在背景色上可读
function getContrastColor(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1e1e1e' : '#ffffff';
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
  const { commits, branches } = useRepoStore();
  const selectedCommit = propSelectedCommit ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [collapsedMergeOids, setCollapsedMergeOids] = useState<Set<string>>(new Set());
  const [highlightMode, setHighlightMode] = useState<'all' | 'current-branch'>('all');

  const toggleCollapse = useCallback((oid: string) => {
    setCollapsedMergeOids(prev => {
      const next = new Set(prev);
      if (next.has(oid)) next.delete(oid); else next.add(oid);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsedMergeOids(new Set()), []);
  const collapseAll = useCallback(() => {
    const allMerges = new Set<string>();
    commits.forEach(c => { if (c.parentIds.length > 1) allMerges.add(c.oid); });
    setCollapsedMergeOids(allMerges);
  }, [commits]);

  // 生成图数据
  const { graphData, nodes: graphNodes, maxLane } = useMemo(
    () => generateGraph(commits, branches, collapsedMergeOids, highlightMode),
    [commits, branches, collapsedMergeOids, highlightMode]
  );

  const totalHeight = graphNodes.length * ROW_HEIGHT;
  const graphWidth = Math.max(72, (maxLane + 1) * LANE_WIDTH + 12);

  // 空状态处理 — 注意：必须在所有 Hooks 之后，否则违反 Rules of Hooks
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

  // Canvas 绘制
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || totalHeight <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = graphWidth * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${graphWidth}px`;
    canvas.style.height = `${totalHeight}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, graphWidth, totalHeight);

    const grayedPen = 'rgba(128, 128, 128, 0.4)';

    // 1. 绘制路径曲线
    for (const path of graphData.paths) {
      if (path.points.length < 2) continue;

      ctx.strokeStyle = path.isHighlighted ? BRANCH_COLORS[path.color % BRANCH_COLORS.length] : grayedPen;
      ctx.lineWidth = path.isHighlighted ? 2 : 1.4;
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

    // 2. 绘制连接线（合并弧线）
    for (const link of graphData.links) {
      const sy1 = link.start.y * ROW_HEIGHT;
      const sy2 = link.end.y * ROW_HEIGHT;

      ctx.strokeStyle = link.isHighlighted ? BRANCH_COLORS[link.color % BRANCH_COLORS.length] : grayedPen;
      ctx.lineWidth = link.isHighlighted ? 1.6 : 1.2;
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.moveTo(link.start.x, sy1);
      ctx.quadraticCurveTo(link.control.x, link.control.y * ROW_HEIGHT, link.end.x, sy2);
      ctx.stroke();
    }

    // 3. 绘制节点
    for (let row = 0; row < graphNodes.length; row++) {
      const dot = graphData.dots[row];
      if (!dot) continue;

      const x = dot.center.x;
      const y = dot.center.y * ROW_HEIGHT;
      const color = dot.isHighlighted ? BRANCH_COLORS[dot.color % BRANCH_COLORS.length] : grayedPen;
      const fillColor = dot.isHighlighted ? color : grayedPen;

      switch (dot.type) {
        case 'head':
          // HEAD 双圈
          ctx.fillStyle = '#1e1e1e';
          ctx.strokeStyle = fillColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'merge':
          // 合并提交十字标记（SourceGit 风格）
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
          // 十字
          ctx.strokeStyle = '#1e1e1e';
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
          ctx.fillStyle = fillColor;
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
  }, [graphData, graphNodes, graphWidth, totalHeight, selectedCommit, maxLane]);

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

  // 空状态渲染（所有 Hooks 已执行完毕）
  if (isEmptyState) {
    return (
      <div className="h-full flex flex-col bg-[#1e1e1e]">
        <div className="px-3 py-1.5 border-b border-panel-border flex items-center text-xs text-gray-400 flex-shrink-0">
          <span>提交</span>
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
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* 表头 */}
      <div className="flex items-center text-xs text-gray-400 flex-shrink-0 border-b border-[#3c3c3c]" style={{ height: 26 }}>
        <div className="flex-1 flex items-center" style={{ paddingLeft: graphWidth + 12 }}>
          <span>提交</span>
        </div>
        <span style={{ width: 120 }} className="flex-shrink-0 text-center">作者</span>
        <span style={{ width: 90 }} className="flex-shrink-0 text-right pr-2">日期</span>
        <span style={{ width: 75 }} className="flex-shrink-0 text-right pr-4">HASH</span>
        <div className="flex items-center gap-1 px-3 border-l border-[#3c3c3c] flex-shrink-0">
          <button
            className={`px-1.5 py-0.5 text-[10px] rounded ${highlightMode === 'all' ? 'text-[#00d4aa] bg-[#00d4aa22]' : 'text-gray-500 hover:text-gray-300 hover:bg-[#3c3c3c]'}`}
            onClick={() => setHighlightMode('all')} title="全部高亮"
          >全部</button>
          <button
            className={`px-1.5 py-0.5 text-[10px] rounded ${highlightMode === 'current-branch' ? 'text-[#00d4aa] bg-[#00d4aa22]' : 'text-gray-500 hover:text-gray-300 hover:bg-[#3c3c3c]'}`}
            onClick={() => setHighlightMode('current-branch')} title="仅当前分支"
          >分支</button>
          <span className="w-px h-3 bg-[#3c3c3c]" />
          <button className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 hover:bg-[#3c3c3c] rounded" onClick={expandAll} title="展开所有">展开</button>
          <button className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 hover:bg-[#3c3c3c] rounded" onClick={collapseAll} title="折叠所有">折叠</button>
        </div>
      </div>

      {/* 滚动区域 - Fork 风格完全合并布局 */}
      <div ref={containerRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Canvas 分支图 - 左侧固定宽度 */}
          <div style={{ position: 'absolute', left: 0, top: 0, width: graphWidth, height: totalHeight, pointerEvents: 'none', zIndex: 1 }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
          </div>

          {/* 提交记录列表 - Fork 风格，每行根据实际分支宽度展示 */}
          {graphNodes.slice(firstVisibleRow, lastVisibleRow + 1).map((node) => {
            const isCollapsed = collapsedMergeOids.has(node.commit.oid);
            const isStash = node.commit.oid.startsWith('stash-') || node.commit.shortOid.startsWith('stash@');
            
            // 计算该行实际使用的最大 lane 宽度，但确保不超过分支图总宽度
            // 找到同一行的所有节点，计算最大 lane
            const nodesInSameRow = graphNodes.filter(n => n.row === node.row);
            const maxLaneInRow = Math.max(...nodesInSameRow.map(n => n.lane));
            // 使用最小宽度：当前行最大 lane 宽度 和 分支图宽度 中的较小值，确保内容可见不被遮挡
            const contentStartX = Math.min((maxLaneInRow + 1) * LANE_WIDTH + 8, graphWidth + 8);

            return (
              <div
                key={node.commit.oid}
                onClick={() => !isStash && onCommitSelect?.(node.commit.oid)}
                onContextMenu={(e) => !isStash && handleContextMenu(e, node.commit.oid)}
                className={`absolute left-0 right-0 flex items-center cursor-pointer ${
                  isStash ? 'bg-[#252525]' : ''
                }`}
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
                            className="text-[11px] px-1.5 py-0.5 rounded-lg flex-shrink-0 max-w-[160px] truncate"
                            title={branchName}
                            style={{
                              backgroundColor: `${node.color}33`,
                              color: getContrastColor(node.color),
                              border: `1px solid ${node.color}66`,
                              fontWeight: isCurrent ? 600 : 400,
                            }}
                          >
                            {isCurrent ? '●' : isRemote ? '○' : ''}{displayName}
                          </span>
                        );
                      })}
                      {node.branchNames.length > 2 && (
                        <span className="text-[11px] text-gray-400 flex-shrink-0 bg-gray-700/40 px-1.5 py-0.5 rounded-lg">
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

                      {/* 折叠指示器 - Fork 风格 */}
                      {node.isMergeCommit && (
                        <button
                          className={`flex-shrink-0 w-4 h-4 flex items-center justify-center rounded text-[10px] ml-2 ${
                            isCollapsed ? 'bg-orange-500/30 text-orange-400' : 'bg-gray-700/50 text-gray-400'
                          } hover:bg-[#4a4a4a]`}
                          onClick={(e) => { e.stopPropagation(); toggleCollapse(node.commit.oid); }}
                          title={isCollapsed ? `展开 (${node.collapsedCommitCount} 个提交)` : '折叠'}
                        >
                          {isCollapsed ? `+${node.collapsedCommitCount}` : '−'}
                        </button>
                      )}

                      {/* 作者 */}
                      <div className="flex items-center gap-1 flex-shrink-0 ml-3" style={{ width: '100px' }}>
                        <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-medium flex-shrink-0"
                          style={{ backgroundColor: getAvatarColor(node.commit.authorEmail) }}>
                          {node.commit.authorName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-gray-300 truncate">{node.commit.authorName}</span>
                      </div>

                      {/* 日期 */}
                      <span className="text-xs text-gray-400 flex-shrink-0 text-right ml-2" style={{ width: '80px' }}>
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
