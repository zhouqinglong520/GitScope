/**
 * Majie 码界 — 终端服务
 * 基于 node-pty 的伪终端管理，支持多实例
 */
export {};

const pty = require('node-pty');
const os = require('os');
const path = require('path');

interface TerminalInstance {
  id: string;
  pty: any;
  cwd: string;
  shell: string;
}

/** 终端实例存储 */
const terminals = new Map<string, TerminalInstance>();

/** 获取系统默认 shell */
function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

/** 获取 shell 参数（如 login shell） */
function getShellArgs(): string[] {
  if (process.platform === 'win32') {
    return [];
  }
  return []; // 不强制 login shell，由用户环境决定
}

/**
 * 创建新的终端实例
 */
function createTerminal(id: string, cwd?: string): TerminalInstance {
  const shell = getDefaultShell();
  const args = getShellArgs();

  // 默认 cwd：仓库路径或用户主目录
  const workDir = cwd || os.homedir();

  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: workDir,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    } as Record<string, string>,
  });

  const instance: TerminalInstance = {
    id,
    pty: ptyProcess,
    cwd: workDir,
    shell,
  };

  terminals.set(id, instance);

  console.log(`[Terminal] 创建终端 ${id}, shell=${shell}, cwd=${workDir}`);

  return instance;
}

/**
 * 获取终端实例
 */
function getTerminal(id: string): TerminalInstance | undefined {
  return terminals.get(id);
}

/**
 * 向终端写入数据
 */
function writeTerminal(id: string, data: string): void {
  const instance = terminals.get(id);
  if (instance) {
    instance.pty.write(data);
  }
}

/**
 * 调整终端尺寸
 */
function resizeTerminal(id: string, cols: number, rows: number): void {
  const instance = terminals.get(id);
  if (instance) {
    try {
      instance.pty.resize(cols, rows);
    } catch (e) {
      // resize 可能在终端未就绪时失败
      console.warn(`[Terminal] resize 失败 ${id}:`, e);
    }
  }
}

/**
 * 关闭终端实例
 */
function killTerminal(id: string): void {
  const instance = terminals.get(id);
  if (instance) {
    try {
      instance.pty.kill();
    } catch (e) {
      console.warn(`[Terminal] kill 失败 ${id}:`, e);
    }
    terminals.delete(id);
    console.log(`[Terminal] 关闭终端 ${id}`);
  }
}

/**
 * 关闭所有终端
 */
function killAllTerminals(): void {
  for (const id of terminals.keys()) {
    killTerminal(id);
  }
}

module.exports = {
  createTerminal,
  getTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal,
  killAllTerminals,
  getDefaultShell,
};
