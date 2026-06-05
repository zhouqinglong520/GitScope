/**
 * 图片Diff组件
 * 支持三种模式：Side-by-Side / 滑块对比 / 洋葱皮叠加
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { zhCN } from '../../i18n/zh-CN';
import type { ImageDiffInfo, ImageDiffMode } from '@shared/types/git';

interface ImageDiffViewProps {
  diffInfo: ImageDiffInfo;
  onClose?: () => void;
}

export const ImageDiffView: React.FC<ImageDiffViewProps> = ({ diffInfo, onClose }) => {
  const [mode, setMode] = useState<ImageDiffMode>('side-by-side');
  const [sliderPos, setSliderPos] = useState(50);
  const [opacity, setOpacity] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const oldSrc = useMemo(() =>
    diffInfo.oldImage ? `data:image/png;base64,${diffInfo.oldImage}` : null,
    [diffInfo.oldImage]
  );

  const newSrc = useMemo(() =>
    diffInfo.newImage ? `data:image/png;base64,${diffInfo.newImage}` : null,
    [diffInfo.newImage]
  );

  const modes: { key: ImageDiffMode; label: string }[] = [
    { key: 'side-by-side', label: zhCN.imageDiff?.sideBySide || 'Side by Side' },
    { key: 'slider', label: zhCN.imageDiff?.slider || 'Slider' },
    { key: 'onion-skin', label: zhCN.imageDiff?.onionSkin || 'Onion Skin' },
  ];

  const handleSliderMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    e.preventDefault();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      setSliderPos(Math.max(0, Math.min(100, x)));
    };
    const handleMouseUp = () => {
      isDragging.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-200">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-1">
          {modes.map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                mode === m.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {mode === 'onion-skin' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Opacity</span>
              <input
                type="range" min={0} max={100}
                value={opacity * 100}
                onChange={e => setOpacity(Number(e.target.value) / 100)}
                className="w-24 h-1 bg-gray-600 rounded appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500 w-8">{Math.round(opacity * 100)}%</span>
            </div>
          )}
          {onClose && <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">✕</button>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {mode === 'side-by-side' && (
          <div className="flex gap-4 items-start justify-center">
            <div className="flex-1 max-w-[50%]">
              <div className="text-xs text-gray-500 mb-2 text-center">{diffInfo.oldPath || '(none)'}</div>
              <div className="border border-gray-700 rounded overflow-hidden bg-gray-800 flex items-center justify-center min-h-[200px]">
                {oldSrc ? <img src={oldSrc} alt="Old" className="max-w-full max-h-[500px] object-contain" /> : <div className="text-gray-600 text-sm py-20">New file</div>}
              </div>
            </div>
            <div className="flex-1 max-w-[50%]">
              <div className="text-xs text-gray-500 mb-2 text-center">{diffInfo.newPath || '(deleted)'}</div>
              <div className="border border-gray-700 rounded overflow-hidden bg-gray-800 flex items-center justify-center min-h-[200px]">
                {newSrc ? <img src={newSrc} alt="New" className="max-w-full max-h-[500px] object-contain" /> : <div className="text-gray-600 text-sm py-20">File deleted</div>}
              </div>
            </div>
          </div>
        )}

        {mode === 'slider' && (
          <div ref={containerRef} className="relative mx-auto max-w-[80%] overflow-hidden border border-gray-700 rounded cursor-ew-resize select-none">
            <div className="w-full">
              {oldSrc ? <img src={oldSrc} alt="Old" className="w-full max-h-[600px] object-contain" /> : <div className="py-40 text-center text-gray-600">No old version</div>}
            </div>
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
              {newSrc ? <img src={newSrc} alt="New" className="max-h-[600px] object-contain" /> : null}
            </div>
            <div className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10" style={{ left: `${sliderPos}%` }} onMouseDown={handleSliderMouseDown}>
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-xs">⟺</span>
              </div>
            </div>
            <div className="absolute top-2 left-2 bg-black/60 text-xs text-gray-300 px-2 py-0.5 rounded">Old</div>
            <div className="absolute top-2 right-2 bg-black/60 text-xs text-gray-300 px-2 py-0.5 rounded">New</div>
          </div>
        )}

        {mode === 'onion-skin' && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative border border-gray-700 rounded overflow-hidden">
              {oldSrc && <img src={oldSrc} alt="Old" className="max-w-full max-h-[500px] object-contain" />}
              {newSrc && <img src={newSrc} alt="New" className="absolute inset-0 max-w-full max-h-[500px] object-contain" style={{ opacity }} />}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="text-red-400">Old ({Math.round((1 - opacity) * 100)}%)</span>
              <span>↔</span>
              <span className="text-green-400">New ({Math.round(opacity * 100)}%)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageDiffView;
