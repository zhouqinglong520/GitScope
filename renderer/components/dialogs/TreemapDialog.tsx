/**
 * P2-7: 仓库磁盘占用 Treemap 弹窗
 * 可视化展示仓库文件大小分布，帮助找出大文件
 */
import React, { useState, useEffect, useCallback } from 'react';

interface DiskEntry { path: string; size: number; type: 'file' | 'dir'; extension?: string; }

// 设计令牌
const C = {
  card: '#1e2229', border: '#2d333b', inputBg: '#0d1117', inputBorder: '#30363d',
  focus: '#00d4aa', text: '#e6edf3', muted: '#8b949e', faint: '#484f58',
  danger: '#f85149', accent: '#00d4aa', overlay: 'rgba(0,0,0,0.65)',
};

const EXT_COLORS: Record<string, string> = {
  ts: '#3178c6', tsx: '#3178c6', js: '#f1e05a', jsx: '#f1e05a',
  py: '#3572A5', java: '#b07219', go: '#00ADD8', rs: '#dea584',
  css: '#563d7c', scss: '#c6538c', html: '#e34c26', json: '#292929',
  md: '#083fa1', yaml: '#cb171e', yml: '#cb171e', sql: '#e38c00',
  png: '#a873e8', jpg: '#a873e8', svg: '#ff9900', gif: '#a873e8',
  sh: '#89e051', bat: '#c1f12e', xml: '#f26522', vue: '#41b883',
  rb: '#701516', php: '#4F5D95', swift: '#F05138', kt: '#A97BFF',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function getColorForEntry(entry: DiskEntry): string {
  if (entry.extension && EXT_COLORS[entry.extension]) return EXT_COLORS[entry.extension];
  const hash = entry.path.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const colors = Object.values(EXT_COLORS);
  return colors[hash % colors.length];
}

/** Treemap 布局算法 — 简化 Slice-and-Dice */
interface TreemapRect { x: number; y: number; w: number; h: number; entry: DiskEntry; color: string; }
function layoutTreemap(entries: DiskEntry[], width: number, height: number, minArea = 400): TreemapRect[] {
  if (entries.length === 0) return [];
  const total = entries.reduce((s, e) => s + e.size, 0);
  if (total === 0) return [];
  const rects: TreemapRect[] = [];
  let x = 0, y = 0, remaining = width * height;
  let isHorizontal = true;

  for (const entry of entries) {
    const fraction = entry.size / total;
    const area = fraction * remaining;
    if (area < minArea) continue;
    let w: number, h: number;
    if (isHorizontal) {
      w = width - x;
      h = area / w;
      rects.push({ x, y, w, h: Math.min(h, height - y), entry, color: getColorForEntry(entry) });
      y += h;
    } else {
      h = height - y;
      w = area / h;
      rects.push({ x, y, w: Math.min(w, width - x), h, entry, color: getColorForEntry(entry) });
      x += w;
    }
    if (y >= height - 2) { y = 0; x = width * 0.5; isHorizontal = false; }
    if (x >= width - 2) break;
  }
  return rects;
}

interface Props { onClose: () => void; }

export const TreemapDialog: React.FC<Props> = ({ onClose }) => {
  const [data, setData] = useState<{ totalSize: number; entries: DiskEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredEntry, setHoveredEntry] = useState<DiskEntry | null>(null);
  const [groupByExt, setGroupByExt] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { setData(await window.electronAPI.git.getRepoDiskUsage()); }
      catch { setData({ totalSize: 0, entries: [] }); }
      finally { setLoading(false); }
    })();
  }, []);

  const topEntries = data?.entries.slice(0, 60) || [];
  const treemapRects = layoutTreemap(topEntries, 640, 360);

  // 按扩展名分组统计
  const extGroups = React.useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { ext: string; size: number; count: number; color: string }>();
    for (const e of data.entries) {
      const ext = e.extension || '(other)';
      const g = map.get(ext) || { ext, size: 0, count: 0, color: EXT_COLORS[ext] || '#8b949e' };
      g.size += e.size; g.count++;
      map.set(ext, g);
    }
    return [...map.values()].sort((a, b) => b.size - a.size);
  }, [data]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, width: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ color: C.text, fontSize: 15, fontWeight: 600, margin: 0 }}>仓库磁盘占用</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setGroupByExt(!groupByExt)} style={{ fontSize: 11, padding: '4px 10px', background: groupByExt ? C.accent : C.inputBg, color: groupByExt ? '#000' : C.muted, border: `1px solid ${C.inputBorder}`, borderRadius: 6, cursor: 'pointer' }}>
              按扩展名
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
        </div>

        {/* 内容 */}
        <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: C.muted, padding: 40 }}>加载中...</div>
          ) : !groupByExt ? (
            <>
              {/* 总览 */}
              <div style={{ marginBottom: 16, color: C.muted, fontSize: 12 }}>
                总大小: <span style={{ color: C.accent, fontWeight: 600 }}>{formatSize(data?.totalSize || 0)}</span>
                {' · '}文件数: <span style={{ color: C.text }}>{data?.entries.length || 0}</span>
              </div>
              {/* Treemap 可视化 */}
              <div style={{ position: 'relative', width: 640, height: 360, background: C.inputBg, borderRadius: 8, border: `1px solid ${C.inputBorder}`, overflow: 'hidden' }}>
                <svg width={640} height={360}>
                  {treemapRects.map((r, i) => (
                    <g key={i} onMouseEnter={() => setHoveredEntry(r.entry)} onMouseLeave={() => setHoveredEntry(null)} style={{ cursor: 'pointer' }}>
                      <rect x={r.x + 1} y={r.y + 1} width={Math.max(r.w - 2, 2)} height={Math.max(r.h - 2, 2)} fill={r.color} opacity={0.7} rx={2} stroke={hoveredEntry === r.entry ? '#fff' : 'none'} strokeWidth={1} />
                      {r.w > 60 && r.h > 20 && (
                        <text x={r.x + 6} y={r.y + 14} fill="#fff" fontSize={9} fontWeight={500} style={{ pointerEvents: 'none' }}>{r.entry.path.split('/').pop()?.slice(0, 15)}</text>
                      )}
                      {r.w > 60 && r.h > 34 && (
                        <text x={r.x + 6} y={r.y + 26} fill="rgba(255,255,255,0.7)" fontSize={8} style={{ pointerEvents: 'none' }}>{formatSize(r.entry.size)}</text>
                      )}
                    </g>
                  ))}
                </svg>
              </div>
              {/* Hover 提示 */}
              {hoveredEntry && (
                <div style={{ marginTop: 8, padding: '6px 12px', background: C.inputBg, borderRadius: 6, fontSize: 12, color: C.text }}>
                  {hoveredEntry.path} — <span style={{ color: C.accent }}>{formatSize(hoveredEntry.size)}</span>
                </div>
              )}
              {/* Top 列表 */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, fontWeight: 600 }}>Top 20 大文件</div>
                {data?.entries.slice(0, 20).map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 4, fontSize: 11, color: C.text }}
                    onMouseEnter={() => setHoveredEntry(e)} onMouseLeave={() => setHoveredEntry(null)}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: getColorForEntry(e), flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.path}</span>
                    <span style={{ color: C.accent, fontWeight: 500, flexShrink: 0 }}>{formatSize(e.size)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 16, color: C.muted, fontSize: 12 }}>
                按扩展名分组 — <span style={{ color: C.accent }}>{extGroups.length}</span> 种类型
              </div>
              {extGroups.map((g, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, fontSize: 12, color: C.text }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: g.color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>.{g.ext}</span>
                  <span style={{ color: C.muted, fontSize: 11 }}>{g.count} 文件</span>
                  <span style={{ color: C.accent, fontWeight: 500 }}>{formatSize(g.size)}</span>
                  {/* 占比条 */}
                  <div style={{ width: 80, height: 4, background: C.inputBg, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${(g.size / (data?.totalSize || 1)) * 100}%`, height: '100%', background: g.color, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
