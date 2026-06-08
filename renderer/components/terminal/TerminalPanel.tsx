/**
 * Majie 码界 — 内置终端面板
 * 基于 xterm.js + node-pty，支持多 Tab、拖拽调整高度
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './TerminalPanel.css';

interface TerminalTab {
  id: string;
  title: string;
  cwd?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  cwd?: string;
}

let tabCounter = 0;

function TerminalPanel({ visible, onClose, cwd }: Props) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [height, setHeight] = useState(240);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRefs = useRef<Map<string, { term: any; fitAddon: any }>>(new Map());
  const isDraggingRef = useRef(false);
  const dataUnsubRef = useRef<(() => void) | null>(null);
  const exitUnsubRef = useRef<(() => void) | null>(null);
  const initRef = useRef(false);

  // 初始化全局事件监听（只执行一次）
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // 监听终端输出
    if (window.electronAPI?.terminal?.onData) {
      dataUnsubRef.current = window.electronAPI.terminal.onData(
        (id: string, data: string) => {
          const entry = termRefs.current.get(id);
          if (entry?.term) {
            entry.term.write(data);
          }
        }
      );
    }

    // 监听终端退出
    if (window.electronAPI?.terminal?.onExit) {
      exitUnsubRef.current = window.electronAPI.terminal.onExit(
        (id: string, exitCode: number) => {
          const entry = termRefs.current.get(id);
          if (entry?.term) {
            entry.term.write(`\r\n\x1b[90m[进程已退出，代码: ${exitCode}]\x1b[0m\r\n`);
          }
        }
      );
    }

    return () => {
      dataUnsubRef.current?.();
      exitUnsubRef.current?.();
    };
  }, []);

  // 动态加载 xterm.js
  const loadXterm = useCallback(async () => {
    const xterm = await import('xterm');
    const fitAddon = await import('xterm-addon-fit');
    const webLinksAddon = await import('xterm-addon-web-links');
    return { Terminal: xterm.Terminal, FitAddon: fitAddon.FitAddon, WebLinksAddon: webLinksAddon.WebLinksAddon };
  }, []);

  // 创建新终端 Tab
  const createNewTab = useCallback(async () => {
    const id = `term-${++tabCounter}`;
    const newTab: TerminalTab = {
      id,
      title: `终端 ${tabCounter}`,
      cwd,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(id);

    // 延迟一帧等待 DOM 渲染
    setTimeout(async () => {
      const container = document.getElementById(`term-container-${id}`);
      if (!container) return;

      try {
        const { Terminal, FitAddon, WebLinksAddon } = await loadXterm();

        const term = new Terminal({
          theme: {
            background: '#0a0e14',
            foreground: '#d4d4d4',
            cursor: '#00d4aa',
            cursorAccent: '#0a0e14',
            selectionBackground: 'rgba(0, 212, 170, 0.25)',
            black: '#0a0e14',
            red: '#f85149',
            green: '#3fb950',
            yellow: '#d29922',
            blue: '#58a6ff',
            magenta: '#bc8cff',
            cyan: '#00d4aa',
            white: '#e6e6e6',
            brightBlack: '#6b7280',
            brightRed: '#ff7b72',
            brightGreen: '#56d364',
            brightYellow: '#e3b341',
            brightBlue: '#79c0ff',
            brightMagenta: '#d2a8ff',
            brightCyan: '#39d7b8',
            brightWhite: '#ffffff',
          },
          fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Menlo, Monaco, monospace",
          fontSize: 13,
          lineHeight: 1.2,
          cursorBlink: true,
          cursorStyle: 'bar',
          scrollback: 10000,
          allowTransparency: true,
          rendererType: 'canvas',
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        term.loadAddon(fitAddon);
        term.loadAddon(webLinksAddon);
        term.open(container);
        fitAddon.fit();

        // 保存引用
        termRefs.current.set(id, { term, fitAddon });

        // 创建后端 PTY
        if (window.electronAPI?.terminal?.create) {
          const result = await window.electronAPI.terminal.create(id, cwd);
          if (result) {
            // 更新 tab 标题
            const shellName = (result.shell as string || '').split(/[/\\]/).pop() || '终端';
            setTabs(prev => prev.map(t => t.id === id ? { ...t, title: shellName } : t));
          }
        }

        // 监听用户输入 → 写入 PTY
        term.onData((data: string) => {
          if (window.electronAPI?.terminal?.write) {
            window.electronAPI.terminal.write(id, data);
          }
        });

        // 监听尺寸变化
        term.onResize(({ cols, rows }) => {
          if (window.electronAPI?.terminal?.resize) {
            window.electronAPI.terminal.resize(id, cols, rows);
          }
        });

        // 初始尺寸同步
        if (window.electronAPI?.terminal?.resize) {
          window.electronAPI.terminal.resize(id, term.cols, term.rows);
        }

      } catch (err) {
        console.error('[Terminal] xterm.js 加载失败:', err);
        container.innerHTML = `<div style="padding:12px;color:#f85149;font-size:13px;">终端加载失败: ${err}</div>`;
      }
    }, 50);
  }, [cwd, loadXterm]);

  // 关闭 Tab
  const closeTab = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();

    // 清理 xterm 实例
    const entry = termRefs.current.get(id);
    if (entry?.term) {
      entry.term.dispose();
      termRefs.current.delete(id);
    }

    // 杀掉后端 PTY
    if (window.electronAPI?.terminal?.kill) {
      window.electronAPI.terminal.kill(id);
    }

    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (activeTabId === id && next.length > 0) {
        setActiveTabId(next[next.length - 1].id);
      } else if (next.length === 0) {
        onClose();
      }
      return next;
    });
  }, [activeTabId, onClose]);

  // 面板可见时自动创建第一个 Tab
  useEffect(() => {
    if (visible && tabs.length === 0) {
      createNewTab();
    }
    // 面板隐藏时重置
    if (!visible && tabs.length > 0) {
      tabs.forEach(t => {
        const entry = termRefs.current.get(t.id);
        if (entry?.term) entry.term.dispose();
        termRefs.current.delete(t.id);
        if (window.electronAPI?.terminal?.kill) window.electronAPI.terminal.kill(t.id);
      });
      setTabs([]);
      setActiveTabId('');
    }
  }, [visible]);

  // 窗口大小变化时重新 fit
  useEffect(() => {
    if (!visible) return;
    const handleResize = () => {
      const entry = termRefs.current.get(activeTabId);
      if (entry?.fitAddon) {
        try { entry.fitAddon.fit(); } catch {}
      }
    };
    window.addEventListener('resize', handleResize);
    // 切换 tab 时也要 fit
    setTimeout(handleResize, 50);
    return () => window.removeEventListener('resize', handleResize);
  }, [visible, activeTabId, height]);

  // 拖拽调整高度
  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newHeight = Math.min(Math.max(window.innerHeight - e.clientY, 120), 500);
      setHeight(newHeight);
    };
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="terminal-panel" style={{ height }}>
      {/* 拖拽条 */}
      <div className="terminal-resize-handle" onMouseDown={handleDragStart} />

      {/* Tab 栏 */}
      <div className="terminal-tabs">
        <div className="terminal-tabs-list">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`terminal-tab ${tab.id === activeTabId ? 'active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <svg className="terminal-tab-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 3.75C2 2.784 2.784 2 3.75 2h8.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0112.25 14h-8.5A1.75 1.75 0 012 12.25v-8.5zm1.75-.25a.25.25 0 00-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25v-8.5a.25.25 0 00-.25-.25h-8.5zM5.5 6.5L8 8l-2.5 1.5v-3z"/>
              </svg>
              <span className="terminal-tab-title">{tab.title}</span>
              <button
                className="terminal-tab-close"
                onClick={(e) => closeTab(tab.id, e)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="terminal-tabs-actions">
          <button className="terminal-action-btn" onClick={createNewTab} title="新建终端 (Ctrl+Shift+`)">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z"/>
            </svg>
          </button>
          <button className="terminal-action-btn" onClick={onClose} title="关闭面板 (Ctrl+`)">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* 终端容器 */}
      <div className="terminal-content">
        {tabs.map(tab => (
          <div
            key={tab.id}
            id={`term-container-${tab.id}`}
            className={`terminal-instance ${tab.id === activeTabId ? 'visible' : 'hidden'}`}
          />
        ))}
      </div>
    </div>
  );
}

export default TerminalPanel;
