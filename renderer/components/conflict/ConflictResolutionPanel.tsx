/**
 * 冲突解决面板（增强版）
 * Fork/GitKraken 风格内联冲突解决
 * 
 * P0 功能：Inline Conflict Resolution
 * - 解析 <<<<<<< / ======= / >>>>>>> 冲突标记
 * - 每个冲突区域独立选择：Ours / Theirs / Both (Ours+Theirs) / Both (Theirs+Ours) / Manual
 * - 三路合并预览：Base + Ours + Theirs
 * - 实时预览合并结果
 * - 批量解决（全部 Ours / 全部 Theirs）
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18 } from '../../i18n';

// ========== 冲突标记解析 ==========

interface ConflictZone {
  /** 冲突区域索引 */
  index: number;
  /** 起始行（<<<<<<< 行） */
  startLine: number;
  /** 分隔行（======= 行） */
  separatorLine: number;
  /** 结束行（>>>>>>> 行） */
  endLine: number;
  /** Ours 部分（不含标记） */
  oursContent: string;
  /** Theirs 部分（不含标记） */
  theirsContent: string;
  /** 之前的内容（上下文） */
  beforeContent: string;
  /** 当前选择 */
  resolution: 'unresolved' | 'ours' | 'theirs' | 'both-ours-first' | 'both-theirs-first' | 'manual';
  /** 手动编辑内容 */
  manualContent: string;
}

interface ParsedConflictFile {
  filePath: string;
  zones: ConflictZone[];
  fullContent: string;
  /** 合并后的预览内容 */
  previewContent: string;
}

/**
 * 解析冲突文件内容
 */
function parseConflictContent(content: string): { zones: ConflictZone[]; lines: string[] } {
  const lines = content.split('\n');
  const zones: ConflictZone[] = [];
  let i = 0;
  let zoneIndex = 0;

  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      const startLine = i;
      const oursLines: string[] = [];
      i++;
      
      // 收集 Ours 部分
      while (i < lines.length && !lines[i].startsWith('=======')) {
        oursLines.push(lines[i]);
        i++;
      }
      
      if (i >= lines.length) break;
      const separatorLine = i;
      const theirsLines: string[] = [];
      i++;
      
      // 收集 Theirs 部分
      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        theirsLines.push(lines[i]);
        i++;
      }
      
      if (i >= lines.length) break;
      const endLine = i;
      
      zones.push({
        index: zoneIndex++,
        startLine,
        separatorLine,
        endLine,
        oursContent: oursLines.join('\n'),
        theirsContent: theirsLines.join('\n'),
        beforeContent: '',
        resolution: 'unresolved',
        manualContent: '',
      });
      
      i++;
    } else {
      i++;
    }
  }

  return { zones, lines };
}

/**
 * 根据选择生成合并结果
 */
function generateResolvedContent(originalContent: string, zones: ConflictZone[]): string {
  const lines = originalContent.split('\n');
  const resolvedLines: string[] = [];
  let skipUntil = -1;

  for (let i = 0; i < lines.length; i++) {
    if (i <= skipUntil) continue;
    
    const zone = zones.find(z => z.startLine === i);
    if (zone) {
      skipUntil = zone.endLine;
      
      switch (zone.resolution) {
        case 'ours':
          resolvedLines.push(...zone.oursContent.split('\n'));
          break;
        case 'theirs':
          resolvedLines.push(...zone.theirsContent.split('\n'));
          break;
        case 'both-ours-first':
          resolvedLines.push(...zone.oursContent.split('\n'));
          resolvedLines.push(...zone.theirsContent.split('\n'));
          break;
        case 'both-theirs-first':
          resolvedLines.push(...zone.theirsContent.split('\n'));
          resolvedLines.push(...zone.oursContent.split('\n'));
          break;
        case 'manual':
          resolvedLines.push(...zone.manualContent.split('\n'));
          break;
        case 'unresolved':
          // 保留冲突标记
          resolvedLines.push('<<<<<<< Ours');
          resolvedLines.push(...zone.oursContent.split('\n'));
          resolvedLines.push('=======');
          resolvedLines.push(...zone.theirsContent.split('\n'));
          resolvedLines.push('>>>>>>> Theirs');
          break;
      }
    } else if (!zones.some(z => z.startLine < i && z.endLine > i) && !lines[i].startsWith('<<<<<<<') && !lines[i].startsWith('=======') && !lines[i].startsWith('>>>>>>>')) {
      resolvedLines.push(lines[i]);
    }
  }

  return resolvedLines.join('\n');
}

// ========== 主组件 ==========

interface ConflictResolutionPanelProps {
  isOpen: boolean;
  operationType: 'merge' | 'rebase' | 'cherrypick';
  onClose: () => void;
  onRefresh: () => void;
}

function ConflictResolutionPanel({
  isOpen,
  operationType,
  onClose,
  onRefresh,
}: ConflictResolutionPanelProps) {
  const { t } = useI18();
  const [conflictedFiles, setConflictedFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [parsedFile, setParsedFile] = useState<ParsedConflictFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingZone, setEditingZone] = useState<number | null>(null);

  // 加载冲突文件列表
  const loadConflicts = useCallback(async () => {
    setIsLoading(true);
    try {
      const files = await window.electronAPI.git.getConflictedFiles();
      const paths = files.map((f: any) => typeof f === 'string' ? f : f.path);
      setConflictedFiles(paths);
      if (paths.length > 0 && !selectedFile) {
        setSelectedFile(paths[0]);
      }
    } catch (error) {
      console.error('加载冲突文件失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (isOpen) loadConflicts();
  }, [isOpen, loadConflicts]);

  // 加载选中文件的内容并解析冲突
  useEffect(() => {
    if (!selectedFile) { setParsedFile(null); return; }
    
    const loadFileContent = async () => {
      try {
        // 通过 fs:readFile 读取冲突文件
        const repoInfo = await window.electronAPI.git.getRepositoryInfo();
        if (!repoInfo) return;
        const fullPath = `${repoInfo.path}/${selectedFile}`;
        const content = await window.electronAPI.fs.readFile(fullPath);
        
        const { zones } = parseConflictContent(content);
        
        setParsedFile({
          filePath: selectedFile,
          zones,
          fullContent: content,
          previewContent: content,
        });
      } catch (error) {
        console.error('读取冲突文件失败:', error);
      }
    };
    
    loadFileContent();
  }, [selectedFile]);

  // 更新某个冲突区域的选择
  const handleZoneResolution = useCallback((zoneIndex: number, resolution: ConflictZone['resolution']) => {
    if (!parsedFile) return;
    
    const newZones = [...parsedFile.zones];
    const zone = { ...newZones[zoneIndex] };
    zone.resolution = resolution;
    
    if (resolution === 'manual' && !zone.manualContent) {
      zone.manualContent = zone.oursContent;
    }
    
    newZones[zoneIndex] = zone;
    const previewContent = generateResolvedContent(parsedFile.fullContent, newZones);
    
    setParsedFile({
      ...parsedFile,
      zones: newZones,
      previewContent,
    });
  }, [parsedFile]);

  // 手动编辑区域
  const handleManualEdit = useCallback((zoneIndex: number, content: string) => {
    if (!parsedFile) return;
    
    const newZones = [...parsedFile.zones];
    newZones[zoneIndex] = { ...newZones[zoneIndex], manualContent: content, resolution: 'manual' };
    const previewContent = generateResolvedContent(parsedFile.fullContent, newZones);
    
    setParsedFile({ ...parsedFile, zones: newZones, previewContent });
  }, [parsedFile]);

  // 批量解决
  const handleResolveAll = useCallback(async (strategy: 'ours' | 'theirs') => {
    if (!parsedFile) return;
    const newZones = parsedFile.zones.map(z => ({ ...z, resolution: strategy as ConflictZone['resolution'] }));
    const previewContent = generateResolvedContent(parsedFile.fullContent, newZones);
    setParsedFile({ ...parsedFile, zones: newZones, previewContent });
  }, [parsedFile]);

  // 保存解决结果
  const handleSave = useCallback(async () => {
    if (!parsedFile) return;
    
    // 检查是否所有冲突都已解决
    const unresolved = parsedFile.zones.filter(z => z.resolution === 'unresolved');
    if (unresolved.length > 0) {
      alert(`还有 ${unresolved.length} 个冲突未解决`);
      return;
    }
    
    setIsSaving(true);
    try {
      const repoInfo = await window.electronAPI.git.getRepositoryInfo();
      if (!repoInfo) return;
      const fullPath = `${repoInfo.path}/${parsedFile.filePath}`;
      
      // 写入合并结果
      await window.electronAPI.fs.writeFile(fullPath, parsedFile.previewContent);
      
      // git add 标记冲突已解决
      await window.electronAPI.git.add([parsedFile.filePath]);
      
      // 刷新状态
      await loadConflicts();
      onRefresh();
      
      // 如果所有文件都解决了，关闭面板
      if (conflictedFiles.length <= 1) {
        // 尝试继续操作
        try {
          if (operationType === 'merge') {
            await window.electronAPI.git.continueMerge();
          } else if (operationType === 'rebase') {
            await window.electronAPI.git.continueRebase();
          } else {
            await window.electronAPI.git.continueCherryPick();
          }
          onClose();
        } catch (error) {
          console.error('继续操作失败:', error);
        }
      } else {
        // 切换到下一个冲突文件
        const nextFile = conflictedFiles.find(f => f !== parsedFile.filePath);
        if (nextFile) setSelectedFile(nextFile);
      }
    } catch (error) {
      console.error('保存冲突解决结果失败:', error);
      alert('保存失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
    }
  }, [parsedFile, conflictedFiles, operationType, onClose, onRefresh, loadConflicts]);

  // 继续操作
  const handleContinue = useCallback(async () => {
    setIsLoading(true);
    try {
      if (operationType === 'merge') await window.electronAPI.git.continueMerge();
      else if (operationType === 'rebase') await window.electronAPI.git.continueRebase();
      else await window.electronAPI.git.continueCherryPick();
      onClose();
      onRefresh();
    } catch (error) {
      console.error('继续操作失败:', error);
      alert('操作失败，请确保所有冲突已解决');
    } finally {
      setIsLoading(false);
    }
  }, [operationType, onClose, onRefresh]);

  // 中止操作
  const handleAbort = useCallback(async () => {
    if (!window.confirm('确定中止操作？所有更改将被丢弃。')) return;
    setIsLoading(true);
    try {
      if (operationType === 'merge') await window.electronAPI.git.abortMerge();
      else if (operationType === 'rebase') await window.electronAPI.git.abortRebase();
      else await window.electronAPI.git.abortCherryPick();
      onClose();
      onRefresh();
    } catch (error) {
      console.error('中止操作失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [operationType, onClose, onRefresh]);

  if (!isOpen) return null;

  const allResolved = parsedFile ? parsedFile.zones.every(z => z.resolution !== 'unresolved') : false;
  const resolvedCount = parsedFile ? parsedFile.zones.filter(z => z.resolution !== 'unresolved').length : 0;
  const totalZones = parsedFile ? parsedFile.zones.length : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#1e1e1e] border-t-2 border-orange-500 z-50 max-h-[70vh] flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-orange-500/10 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="font-medium text-orange-400">冲突解决</span>
          {parsedFile && (
            <span className="text-xs text-orange-300 bg-orange-500/20 px-2 py-0.5 rounded">
              {resolvedCount}/{totalZones} 已解决
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 操作按钮栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#3c3c3c]">
        {/* 文件选择 */}
        {conflictedFiles.length > 1 && (
          <div className="flex items-center gap-1 mr-2">
            <span className="text-xs text-gray-400">文件:</span>
            <select
              value={selectedFile || ''}
              onChange={(e) => setSelectedFile(e.target.value)}
              className="text-xs bg-[#3c3c3c] text-gray-200 rounded px-2 py-1 border border-[#4c4c4c] max-w-[200px]"
            >
              {conflictedFiles.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        )}

        {parsedFile && totalZones > 0 && (
          <>
            <button
              onClick={() => handleResolveAll('ours')}
              disabled={isLoading}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >全部 Ours</button>
            <button
              onClick={() => handleResolveAll('theirs')}
              disabled={isLoading}
              className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >全部 Theirs</button>
            <div className="h-4 w-px bg-[#3c3c3c]" />
          </>
        )}
        
        <div className="flex-1" />
        
        <button
          onClick={handleAbort}
          disabled={isLoading}
          className="px-3 py-1 text-xs bg-red-600/80 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >中止</button>
        {allResolved && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {isSaving ? '保存中...' : '保存并继续'}
          </button>
        )}
      </div>

      {/* 冲突区域内容 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 text-sm">加载中...</div>
        ) : !parsedFile ? (
          <div className="p-4 text-center text-gray-500 text-sm">选择文件查看冲突</div>
        ) : totalZones === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">该文件没有冲突标记</div>
        ) : (
          <div className="divide-y divide-[#2a2a2a]">
            {parsedFile.zones.map((zone) => (
              <div key={zone.index} className={`p-3 ${zone.resolution !== 'unresolved' ? 'bg-green-900/10' : 'bg-orange-900/5'}`}>
                {/* 冲突区域标题 */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-400">
                    冲突 #{zone.index + 1}
                    <span className="ml-2 text-gray-500">
                      (Ours: {zone.oursContent.split('\n').length} 行, Theirs: {zone.theirsContent.split('\n').length} 行)
                    </span>
                  </span>
                  
                  {/* 选择按钮 */}
                  <div className="flex items-center gap-1">
                    <button
                      className={`px-2 py-0.5 text-[10px] rounded ${zone.resolution === 'ours' ? 'bg-blue-600 text-white' : 'bg-[#3c3c3c] text-gray-300 hover:bg-[#4f4f4f]'}`}
                      onClick={() => handleZoneResolution(zone.index, 'ours')}
                      title="使用我们的版本"
                    >Ours</button>
                    <button
                      className={`px-2 py-0.5 text-[10px] rounded ${zone.resolution === 'theirs' ? 'bg-purple-600 text-white' : 'bg-[#3c3c3c] text-gray-300 hover:bg-[#4f4f4f]'}`}
                      onClick={() => handleZoneResolution(zone.index, 'theirs')}
                      title="使用他们的版本"
                    >Theirs</button>
                    <button
                      className={`px-2 py-0.5 text-[10px] rounded ${zone.resolution === 'both-ours-first' ? 'bg-green-600 text-white' : 'bg-[#3c3c3c] text-gray-300 hover:bg-[#4f4f4f]'}`}
                      onClick={() => handleZoneResolution(zone.index, 'both-ours-first')}
                      title="两者都保留（Ours 在前）"
                    >Ours+Theirs</button>
                    <button
                      className={`px-2 py-0.5 text-[10px] rounded ${zone.resolution === 'both-theirs-first' ? 'bg-green-600 text-white' : 'bg-[#3c3c3c] text-gray-300 hover:bg-[#4f4f4f]'}`}
                      onClick={() => handleZoneResolution(zone.index, 'both-theirs-first')}
                      title="两者都保留（Theirs 在前）"
                    >Theirs+Ours</button>
                    <button
                      className={`px-2 py-0.5 text-[10px] rounded ${zone.resolution === 'manual' ? 'bg-yellow-600 text-white' : 'bg-[#3c3c3c] text-gray-300 hover:bg-[#4f4f4f]'}`}
                      onClick={() => { handleZoneResolution(zone.index, 'manual'); setEditingZone(zone.index); }}
                      title="手动编辑"
                    >✏ Manual</button>
                  </div>
                </div>

                {/* 双栏对比：Ours vs Theirs */}
                {zone.resolution === 'unresolved' && (
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    {/* Ours */}
                    <div className="bg-blue-900/10 border border-blue-900/30 rounded">
                      <div className="px-2 py-1 bg-blue-900/20 text-blue-400 font-sans font-medium text-[10px]">Ours</div>
                      <pre className="p-2 text-gray-300 whitespace-pre-wrap max-h-[120px] overflow-y-auto">{zone.oursContent}</pre>
                    </div>
                    {/* Theirs */}
                    <div className="bg-purple-900/10 border border-purple-900/30 rounded">
                      <div className="px-2 py-1 bg-purple-900/20 text-purple-400 font-sans font-medium text-[10px]">Theirs</div>
                      <pre className="p-2 text-gray-300 whitespace-pre-wrap max-h-[120px] overflow-y-auto">{zone.theirsContent}</pre>
                    </div>
                  </div>
                )}

                {/* 已解决的预览 */}
                {zone.resolution !== 'unresolved' && zone.resolution !== 'manual' && (
                  <div className="bg-green-900/10 border border-green-900/30 rounded text-xs font-mono">
                    <div className="px-2 py-1 bg-green-900/20 text-green-400 font-sans font-medium text-[10px]">
                      已解决（{zone.resolution === 'ours' ? 'Ours' : zone.resolution === 'theirs' ? 'Theirs' : zone.resolution === 'both-ours-first' ? 'Ours+Theirs' : 'Theirs+Ours'}）
                    </div>
                    <pre className="p-2 text-gray-300 whitespace-pre-wrap max-h-[80px] overflow-y-auto">
                      {zone.resolution === 'ours' ? zone.oursContent :
                       zone.resolution === 'theirs' ? zone.theirsContent :
                       zone.resolution === 'both-ours-first' ? zone.oursContent + '\n' + zone.theirsContent :
                       zone.theirsContent + '\n' + zone.oursContent}
                    </pre>
                  </div>
                )}

                {/* 手动编辑 */}
                {zone.resolution === 'manual' && editingZone === zone.index && (
                  <div className="bg-yellow-900/10 border border-yellow-900/30 rounded text-xs">
                    <div className="px-2 py-1 bg-yellow-900/20 text-yellow-400 font-sans font-medium text-[10px]">手动编辑</div>
                    <textarea
                      className="w-full p-2 bg-transparent text-gray-200 font-mono text-xs resize-y min-h-[60px] max-h-[200px] outline-none"
                      value={zone.manualContent}
                      onChange={(e) => handleManualEdit(zone.index, e.target.value)}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ConflictResolutionPanel;
