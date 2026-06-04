/**
 * Git 服务完整实现
 * 策略：isomorphic-git 为主，git CLI 降级兜底
 * 
 * isomorphic-git：纯 JS 实现，跨平台，用于 log/branch/status/add/commit 等基础操作
 * git CLI：用于 isomorphic-git 不完善的功能（diff 详细内容、merge、stash、fetch 等）
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';

import type {
  GitCommit,
  GitBranch,
  GitStatus,
  GitFileStatus,
  GitDiff,
  GitDiffHunk,
  GitDiffLine,
  GitRemote,
  RepositoryInfo,
  CloneOptions,
  CommitOptions,
  LogOptions,
  GitTag,
  CommitDetail,
  CommitFileChange,
  AuthorStats,
  FileCommitHistory,
  GitStashEntry,
  StashOptions,
  BlameResult,
  BlameLine,
  BlameFilter,
} from '../../../shared/types/git.js';

const execFileAsync = promisify(execFile);

/** isomorphic-git 使用的 fs */
const isoFs = { promises: fs };

/** Diff 选项 */
interface DiffOptions {
  ignoreWhitespace?: boolean;
}

/** 冲突检测结果类型 */
export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingFiles?: string[];
}

/** Git 服务类 */
export class GitService {
  private dir: string | null = null;

  /**
   * 打开仓库
   */
  async open(repoPath: string): Promise<RepositoryInfo | null> {
    try {
      // 验证是否为 git 仓库：尝试读取 HEAD 文件
      const gitDir = path.join(repoPath, '.git');
      try {
        await fs.access(gitDir);
      } catch {
        return null;
      }

      this.dir = repoPath;
      return await this.getInfo();
    } catch (error) {
      console.error('[GitService] 打开仓库失败:', error);
      this.dir = null;
      return null;
    }
  }

  /**
   * 关闭仓库
   */
  close(): void {
    this.dir = null;
  }

  /**
   * 获取仓库信息
   */
  async getInfo(): Promise<RepositoryInfo | null> {
    if (!this.dir) return null;

    try {
      const currentBranch = await git.currentBranch({ fs: isoFs, dir: this.dir, fullname: false }) || 'HEAD';
      const name = path.basename(this.dir);
      const remotes = await this.remotes();

      return {
        path: this.dir,
        name,
        currentBranch,
        isGitRepo: true,
        remotes,
      };
    } catch (error) {
      console.error('[GitService] 获取仓库信息失败:', error);
      return null;
    }
  }

  /**
   * 获取提交历史
   */
  async log(options: LogOptions = {}): Promise<GitCommit[]> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      const depth = options.depth || 500;
      const ref = options.ref || undefined;

      const rawCommits = await git.log({
        fs: isoFs,
        dir: this.dir,
        depth,
        ref,
      });

      const commits: GitCommit[] = rawCommits.map((c) => {
        const commit = c.commit;
        return {
          oid: c.oid,
          shortOid: c.oid.substring(0, 7),
          message: commit.message.split('\n')[0],
          fullMessage: commit.message,
          authorName: commit.author.name,
          authorEmail: commit.author.email,
          authorTimestamp: Math.floor(new Date(commit.author.timestamp * 1000).getTime() / 1000),
          committerName: commit.committer.name,
          committerEmail: commit.committer.email,
          committerTimestamp: commit.committer.timestamp,
          parentIds: commit.parent,
        };
      });

      return options.skipMerges
        ? commits.filter((c) => c.parentIds.length <= 1)
        : commits;
    } catch (error) {
      console.error('[GitService] 获取提交历史失败:', error);
      return [];
    }
  }

  /**
   * 获取分支列表
   */
  async branches(): Promise<GitBranch[]> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      const currentBranch = await git.currentBranch({ fs: isoFs, dir: this.dir, fullname: false }) || '';
      
      // 本地分支
      const localBranches = await git.listBranches({ fs: isoFs, dir: this.dir });
      
      // 远程分支
      const remoteBranches = await git.listBranches({ fs: isoFs, dir: this.dir, remote: 'origin' });

      const result: GitBranch[] = [];

      for (const name of localBranches) {
        if (name === 'HEAD') continue;
        try {
          const oid = await git.resolveRef({ fs: isoFs, dir: this.dir, ref: name });
          result.push({ name, current: name === currentBranch, oid });
        } catch {
          result.push({ name, current: name === currentBranch });
        }
      }

      for (const name of remoteBranches) {
        if (name === 'HEAD') continue;
        const displayName = `origin/${name}`;
        try {
          const oid = await git.resolveRef({ fs: isoFs, dir: this.dir, ref: `remotes/origin/${name}` });
          result.push({ name: displayName, current: false, remote: 'origin', oid });
        } catch {
          result.push({ name: displayName, current: false, remote: 'origin' });
        }
      }

      return result;
    } catch (error) {
      console.error('[GitService] 获取分支列表失败:', error);
      return [];
    }
  }

  /**
   * 获取当前状态
   */
  async status(): Promise<GitStatus | null> {
    if (!this.dir) return null;

    try {
      const currentBranch = await git.currentBranch({ fs: isoFs, dir: this.dir, fullname: false }) || 'HEAD';
      const matrix = await git.statusMatrix({ fs: isoFs, dir: this.dir });

      const staged: GitFileStatus[] = [];
      const unstaged: GitFileStatus[] = [];
      const untracked: GitFileStatus[] = [];

      for (const [filePath, headStatus, workdirStatus, stageStatus] of matrix) {
        // statusMatrix 编码:
        // headStatus: 0=absent, 1=present(未修改), 2=present(修改)
        // workdirStatus: 同上
        // stageStatus: 同上
        const head = headStatus as number;
        const workdir = workdirStatus as number;
        const stage = stageStatus as number;

        // 未跟踪文件：head=0, workdir=2, stage=0
        if (head === 0 && workdir === 2 && stage === 0) {
          untracked.push({ path: filePath, status: 'added' });
          continue;
        }

        // 暂存区变更
        if (stage !== head) {
          if (head === 0 && stage === 2) {
            staged.push({ path: filePath, status: 'added' });
          } else if (head === 1 && stage === 2) {
            staged.push({ path: filePath, status: 'modified' });
          } else if (head === 1 && stage === 0) {
            staged.push({ path: filePath, status: 'deleted' });
          } else if (head === 2 && stage === 3) {
            staged.push({ path: filePath, status: 'deleted' });
          } else {
            staged.push({ path: filePath, status: 'modified' });
          }
        }

        // 工作区变更（相对于暂存区）
        if (workdir !== stage) {
          if (stage === 0 && workdir === 2) {
            unstaged.push({ path: filePath, status: 'added' });
          } else if (stage === 2 && workdir === 1) {
            // workdir=1 表示与stage相同，无变更
          } else if ((stage === 1 || stage === 2) && workdir === 0) {
            unstaged.push({ path: filePath, status: 'deleted' });
          } else if (workdir === 2) {
            unstaged.push({ path: filePath, status: 'modified' });
          }
        }
      }

      const isClean = staged.length === 0 && unstaged.length === 0 && untracked.length === 0;

      return {
        current: currentBranch,
        isClean,
        staged,
        unstaged,
        untracked,
      };
    } catch (error) {
      console.error('[GitService] 获取状态失败:', error);
      return {
        current: 'HEAD',
        isClean: true,
        staged: [],
        unstaged: [],
        untracked: [],
      };
    }
  }

  /**
   * 获取文件差异（使用 git CLI 获取精确 diff）
   * @param filePath 文件路径
   * @param commitOid 提交 SHA（查看历史提交差异时）
   * @param options Diff 选项
   */
  async diff(filePath?: string, commitOid?: string, options?: DiffOptions): Promise<GitDiff[]> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      let cmd = 'git';
      let args: string[];

      if (commitOid) {
        // 查看某个提交的 diff
        args = ['diff', commitOid + '^', commitOid];
        if (filePath) args.push('--', filePath);
      } else if (filePath) {
        // 查看某个文件的 diff
        args = ['diff', '--', filePath];
      } else {
        // 查看所有 diff
        args = ['diff'];
      }

      // 添加忽略空白选项
      if (options?.ignoreWhitespace) {
        args.push('-w', '--ignore-all-space');
      }

      const { stdout } = await execFileAsync(cmd, args, { cwd: this.dir, maxBuffer: 10 * 1024 * 1024 });
      return parseDiffOutput(stdout);
    } catch (error) {
      console.error('[GitService] 获取 diff 失败:', error);
      // 降级方案
      return this.simpleDiff(filePath);
    }
  }

  /**
   * 获取暂存区差异
   */
  async stagedDiff(filePath?: string, options?: DiffOptions): Promise<GitDiff[]> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      let args = ['diff', '--cached'];
      if (filePath) {
        args.push('--', filePath);
      }

      // 添加忽略空白选项
      if (options?.ignoreWhitespace) {
        args.push('-w', '--ignore-all-space');
      }

      const { stdout } = await execFileAsync('git', args, { cwd: this.dir, maxBuffer: 10 * 1024 * 1024 });
      return parseDiffOutput(stdout);
    } catch (error) {
      console.error('[GitService] 获取暂存区 diff 失败:', error);
      return [];
    }
  }

  /**
   * 在外部 Diff 工具中打开
   * @param filePath 可选的文件路径，不指定则打开所有差异
   */
  async openDiffTool(filePath?: string): Promise<boolean> {
    if (!this.dir) return false;

    try {
      // 首先检查是否配置了 difftool
      const { stdout: hasConfig } = await execFileAsync('git', ['config', '--get', 'diff.tool'], {
        cwd: this.dir,
      }).catch(() => ({ stdout: '' }));

      if (!hasConfig.trim()) {
        console.warn('[GitService] 未配置 git difftool');
        return false;
      }

      let args = ['difftool'];
      if (filePath) {
        args.push('--', filePath);
      }
      // -y 表示直接打开，不提示确认
      args.push('-y');

      await execFileAsync('git', args, { cwd: this.dir, maxBuffer: 10 * 1024 * 1024 });
      return true;
    } catch (error) {
      console.error('[GitService] 打开 difftool 失败:', error);
      return false;
    }
  }

  /**
   * 暂存文件
   */
  async add(files: string[]): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await git.add({ fs: isoFs, dir: this.dir, filepath: files });
  }

  /**
   * 暂存所有文件
   */
  async addAll(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await git.add({ fs: isoFs, dir: this.dir, filepath: '.' });
  }

  /**
   * 取消暂存
   */
  async reset(files: string[]): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    for (const file of files) {
      await git.resetIndex({ fs: isoFs, dir: this.dir, filepath: file });
    }
  }

  /**
   * 提交
   */
  async commit(options: CommitOptions): Promise<string> {
    if (!this.dir) throw new Error('仓库未打开');

    const sig = {
      name: options.author?.name || (await this.getConfigUser()).name,
      email: options.author?.email || (await this.getConfigUser()).email,
    };

    const commitSha = await git.commit({
      fs: isoFs,
      dir: this.dir,
      message: options.message,
      author: sig,
      committer: sig,
    });

    return commitSha;
  }

  /**
   * 获取 git config user 信息
   */
  private async getConfigUser(): Promise<{ name: string; email: string }> {
    try {
      const name = await this.gitCliExec(['config', '--get', 'user.name']);
      const email = await this.gitCliExec(['config', '--get', 'user.email']);
      return { name: name.trim(), email: email.trim() };
    } catch {
      return { name: 'Unknown', email: 'unknown@unknown.com' };
    }
  }

  /**
   * 推送
   */
  async push(remote?: string, branch?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    const currentBranch = await git.currentBranch({ fs: isoFs, dir: this.dir });
    if (!currentBranch) throw new Error('未在分支上');

    await git.push({
      fs: isoFs,
      http,
      dir: this.dir,
      remote: remote || 'origin',
      ref: branch || currentBranch,
      onAuth: async () => {
        // 凭证获取由主进程处理，这里返回 null 让 git 自己处理
        return null;
      },
    });
  }

  /**
   * 拉取
   */
  async pull(remote?: string, branch?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    const currentBranch = await git.currentBranch({ fs: isoFs, dir: this.dir });
    if (!currentBranch) throw new Error('未在分支上');

    await git.pull({
      fs: isoFs,
      http,
      dir: this.dir,
      remote: remote || 'origin',
      ref: branch || currentBranch,
      onAuth: async () => null,
    });
  }

  /**
   * 获取远程更新
   */
  async fetch(remote?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    await git.fetch({
      fs: isoFs,
      http,
      dir: this.dir,
      remote: remote || 'origin',
      onAuth: async () => null,
    });
  }

  /**
   * 克隆仓库
   */
  async clone(options: CloneOptions): Promise<void> {
    await git.clone({
      fs: isoFs,
      http,
      dir: options.dir,
      url: options.url,
      ref: options.ref,
      depth: options.depth,
      onAuth: async () => null,
    });
  }

  /**
   * 获取远程列表
   */
  async remotes(): Promise<GitRemote[]> {
    if (!this.dir) return [];

    try {
      const rawRemotes = await git.listRemotes({ fs: isoFs, dir: this.dir });
      return rawRemotes.map((r) => ({
        name: r.remote,
        url: r.url,
        type: r.url.startsWith('git@') ? 'ssh' : 'https',
      }));
    } catch {
      return [];
    }
  }

  /**
   * 创建分支
   */
  async createBranch(name: string, startPoint?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await git.branch({ fs: isoFs, dir: this.dir, ref: name, checkout: false });
  }

  /**
   * 切换分支
   */
  async checkout(ref: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await git.checkout({ fs: isoFs, dir: this.dir, ref });
  }

  /**
   * 删除分支
   */
  async deleteBranch(name: string, force?: boolean): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await git.deleteBranch({ fs: isoFs, dir: this.dir, ref: name, force: force || false });
  }

  /**
   * 合并分支
   */
  async merge(branch: string): Promise<{ success: boolean; conflict?: boolean }> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await git.merge({
        fs: isoFs,
        dir: this.dir,
        theirs: branch,
        onConflict: async ({ conflicting }) => {
          console.log('Conflict files:', conflicting);
        },
      });
      return { success: true };
    } catch (error: any) {
      if (error.code === 'MergeConflictError') {
        return { success: false, conflict: true };
      }
      throw error;
    }
  }

  /**
   * 获取标签列表
   */
  async tags(): Promise<GitTag[]> {
    if (!this.dir) return [];

    try {
      const rawTags = await git.listTags({ fs: isoFs, dir: this.dir });
      const tags: GitTag[] = [];

      for (const name of rawTags) {
        try {
          const oid = await git.resolveRef({ fs: isoFs, dir: this.dir, ref: `refs/tags/${name}` });
          tags.push({ name, oid });
        } catch {
          tags.push({ name });
        }
      }

      return tags;
    } catch {
      return [];
    }
  }

  /**
   * 创建标签
   */
  async createTag(name: string, oid?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await git.tag({ fs: isoFs, dir: this.dir, ref: oid || 'HEAD', tagname: name });
  }

  /**
   * Stash 暂存
   * @param options Stash 选项
   */
  async stash(options?: StashOptions): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    
    const args: string[] = ['stash'];
    
    if (options?.keepIndex) {
      args.push('--keep-index');
    }
    
    if (options?.includeUntracked) {
      args.push('-u');
    }
    
    if (options?.message) {
      args.push('push', '-m', options.message);
    } else {
      args.push('push');
    }
    
    await this.gitCliExec(args);
  }

  /**
   * Stash pop
   */
  async stashPop(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await git.stashPop({ fs: isoFs, dir: this.dir });
  }

  /**
   * 获取 Stash 列表（详细信息）
   */
  async getStashes(): Promise<GitStashEntry[]> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      // 使用 git stash list --format 获取详细信息
      const { stdout } = await execFileAsync(
        'git',
        ['stash', 'list', '--format=%H|%gd|%s|%ai'],
        { cwd: this.dir }
      );

      const stashes: GitStashEntry[] = [];
      const lines = stdout.trim().split('
').filter(line => line.trim());

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [hash, ref, message, dateStr] = line.split('|');
        const index = i;

        // 获取 stash 的文件统计
        let stats = { additions: 0, deletions: 0, filesChanged: 0 };
        let files: StashFileChange[] = [];
        
        try {
          const statOutput = await this.gitCliExec([
            'stash', 'show', '-p', '--stat', `stash@{${index}}`
          ]);
          
          // 解析统计信息
          const filesMatch = statOutput.match(/(\d+) file/);
          const addMatch = statOutput.match(/(\d+) insertion/);
          const delMatch = statOutput.match(/(\d+) deletion/);
          
          if (filesMatch) stats.filesChanged = parseInt(filesMatch[1]);
          if (addMatch) stats.additions = parseInt(addMatch[1]);
          if (delMatch) stats.deletions = parseInt(delMatch[1]);

          // 解析文件列表
          const fileLines = statOutput.split('
').filter(l => {
            const trimmed = l.trim();
            return trimmed && !trimmed.includes('|') && 
                   !trimmed.includes('insert') && !trimmed.includes('delet') &&
                   !trimmed.includes('stash@{') && !l.startsWith('diff');
          });
          
          files = fileLines.map(fileLine => {
            const [filePath, changeStr] = fileLine.trim().split('|').map(s => s.trim());
            let type: 'added' | 'modified' | 'deleted' = 'modified';
            let additions = 0, deletions = 0;
            
            if (changeStr) {
              const addM = changeStr.match(/(\d+)\+/);
              const delM = changeStr.match(/(\d+)-/);
              if (addM) additions = parseInt(addM[1]);
              if (delM) deletions = parseInt(delM[1]);
            }
            
            return { path: filePath, type, additions, deletions };
          }).filter(f => f.path);
        } catch {
          // 解析文件列表失败，忽略
        }

        // 解析日期
        let date = Date.now();
        let parsedDateStr = dateStr;
        try {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            date = Math.floor(d.getTime() / 1000);
          }
        } catch {
          // 日期解析失败，使用当前时间
        }

        stashes.push({
          index,
          ref: `stash@{${index}}`,
          message: message || `WIP on ${await this.getCurrentBranch()}`,
          date,
          dateStr: parsedDateStr,
          files,
          stats,
        });
      }

      return stashes;
    } catch (error) {
      console.error('[GitService] 获取 stash 列表失败:', error);
      return [];
    }
  }

  /**
   * Stash Apply（不弹出）
   */
  async stashApply(index?: number): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    const ref = index !== undefined ? `stash@{${index}}` : 'stash@{0}';
    await this.gitCliExec(['stash', 'apply', ref]);
  }

  /**
   * Stash Drop（删除单个）
   */
  async stashDrop(index?: number): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    const ref = index !== undefined ? `stash@{${index}}` : 'stash@{0}';
    await this.gitCliExec(['stash', 'drop', ref]);
  }

  /**
   * Stash Branch（从 stash 创建分支）
   */
  async stashBranch(index: number, branchName: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['stash', 'branch', branchName, `stash@{${index}}`]);
  }

  /**
   * 获取 Blame 信息
   */
  async getBlame(filePath: string): Promise<BlameResult | null> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      // 使用 git blame --line-porcelain 获取详细信息
      const { stdout } = await execFileAsync(
        'git',
        ['blame', '--line-porcelain', '--', filePath],
        { cwd: this.dir, maxBuffer: 50 * 1024 * 1024 }
      );

      const lines: BlameLine[] = [];
      const authors = new Set<string>();
      let dateRange = { oldest: Infinity, newest: 0 };

      // 解析 porcelain 格式
      const lineBlocks = stdout.split('
');
      let currentCommit = '';
      let currentAuthor = '';
      let currentEmail = '';
      let currentDate = 0;
      let currentMessage = '';
      let lineNumber = 0;
      let content = '';

      for (const block of lineBlocks) {
        if (block.startsWith('	')) {
          // 这是文件内容行
          content = block.substring(1);
          lineNumber++;
          
          lines.push({
            lineNumber,
            content,
            commit: currentCommit,
            shortCommit: currentCommit.substring(0, 7),
            author: currentAuthor,
            authorEmail: currentEmail,
            date: currentDate,
            commitMessage: currentMessage,
          });

          authors.add(currentAuthor);
          if (currentDate > 0) {
            if (currentDate < dateRange.oldest) dateRange.oldest = currentDate;
            if (currentDate > dateRange.newest) dateRange.newest = currentDate;
          }
        } else if (block.startsWith('')) {
          const colonIdx = block.indexOf(' ');
          if (colonIdx > 0) {
            const key = block.substring(0, colonIdx);
            const value = block.substring(colonIdx + 1);
            
            switch (key) {
              case 'author':
                currentAuthor = value;
                break;
              case 'author-mail':
                currentEmail = value;
                break;
              case 'author-time':
                currentDate = parseInt(value);
                break;
              case 'summary':
                currentMessage = value;
                break;
            }
          }
        } else if (block.match(/^[0-9a-f]{40}/)) {
          currentCommit = block;
        }
      }

      return {
        filePath,
        lines,
        authors: Array.from(authors),
        dateRange: dateRange.oldest === Infinity 
          ? { oldest: 0, newest: 0 } 
          : dateRange,
      };
    } catch (error) {
      console.error('[GitService] 获取 blame 失败:', error);
      return null;
    }
  }

  /**
   * 获取当前分支名称
   */
  private async getCurrentBranch(): Promise<string> {
    if (!this.dir) return 'unknown';
    try {
      return await git.currentBranch({ fs: isoFs, dir: this.dir, fullname: false }) || 'HEAD';
    } catch {
      return 'HEAD';
    }
  }

  /**
   * 获取提交详情
   */
  async getCommitDetail(oid: string): Promise<CommitDetail | null> {
    if (!this.dir) return null;

    try {
      const commit = await git.readCommit({ fs: isoFs, dir: this.dir, oid });
      const message = commit.commit.message.split('\n');
      
      // 获取文件变更
      const parentOid = commit.commit.parent[0] || '';
      const diffOutput = await this.gitCliExec(['diff-tree', '-r', '--name-status', parentOid, oid]);
      const fileChanges = parseNameStatus(diffOutput);

      return {
        oid,
        shortOid: oid.substring(0, 7),
        message: message[0],
        fullMessage: commit.commit.message,
        authorName: commit.commit.author.name,
        authorEmail: commit.commit.author.email,
        authorTimestamp: Math.floor(new Date(commit.commit.author.timestamp * 1000).getTime() / 1000),
        committerName: commit.commit.committer.name,
        committerEmail: commit.commit.committer.email,
        committerTimestamp: Math.floor(new Date(commit.commit.committer.timestamp * 1000).getTime() / 1000),
        parentIds: commit.commit.parent,
        fileChanges,
      };
    } catch (error) {
      console.error('[GitService] 获取提交详情失败:', error);
      return null;
    }
  }

  /**
   * 获取文件提交历史
   */
  async getFileHistory(filePath: string): Promise<FileCommitHistory | null> {
    if (!this.dir) return null;

    try {
      const commits = await git.log({ fs: isoFs, dir: this.dir, depth: 100, ref: filePath });
      const stats = commits.length;
      return { filePath, commits, stats };
    } catch (error) {
      console.error('[GitService] 获取文件历史失败:', error);
      return null;
    }
  }

  /**
   * 获取作者统计
   */
  async getAuthorStats(): Promise<AuthorStats[]> {
    if (!this.dir) return [];

    try {
      const rawCommits = await git.log({ fs: isoFs, dir: this.dir, depth: 1000 });
      const authorMap = new Map<string, AuthorStats>();

      for (const c of rawCommits) {
        const key = c.commit.author.email;
        const existing = authorMap.get(key);

        if (existing) {
          existing.commitCount++;
          if (c.commit.author.timestamp < existing.firstCommitDate) {
            existing.firstCommitDate = c.commit.author.timestamp;
          }
          if (c.commit.author.timestamp > existing.lastCommitDate) {
            existing.lastCommitDate = c.commit.author.timestamp;
          }
        } else {
          authorMap.set(key, {
            name: c.commit.author.name,
            email: c.commit.author.email,
            commitCount: 1,
            firstCommitDate: c.commit.author.timestamp,
            lastCommitDate: c.commit.author.timestamp,
          });
        }
      }

      return Array.from(authorMap.values()).sort((a, b) => b.commitCount - a.commitCount);
    } catch {
      return [];
    }
  }

  /**
   * 刷新仓库状态
   */
  async refresh(): Promise<void> {
    // 重新读取状态即可
    if (!this.dir) return;
    await this.status();
  }

  // ========== 冲突预判方法 ==========

  /**
   * 检测合并分支是否会产生冲突
   * 使用 git merge-tree 安全检测（不改变工作区）
   */
  async checkMergeConflict(branch: string): Promise<ConflictCheckResult> {
    if (!this.dir) return { hasConflict: false };

    try {
      // 使用 git merge-tree 检测冲突
      // merge-tree 会模拟合并并报告冲突，但不实际修改工作区
      const { stdout, stderr } = await execFileAsync(
        'git',
        ['merge-tree', `refs/heads/${branch}`],
        { cwd: this.dir, maxBuffer: 10 * 1024 * 1024 }
      );

      // 解析输出检查冲突
      const conflictFiles = parseMergeTreeOutput(stdout + stderr);
      
      return {
        hasConflict: conflictFiles.length > 0,
        conflictingFiles: conflictFiles,
      };
    } catch (error) {
      // 如果 merge-tree 命令失败，尝试使用 merge --no-commit --no-ff
      return await this.checkMergeConflictFallback(branch);
    }
  }

  /**
   * 使用 merge --no-commit --no-ff + merge --abort 检测冲突（降级方案）
   */
  private async checkMergeConflictFallback(branch: string): Promise<ConflictCheckResult> {
    if (!this.dir) return { hasConflict: false };

    try {
      // 尝试执行 merge，但不提交
      await execFileAsync(
        'git',
        ['merge', '--no-commit', '--no-ff', branch],
        { cwd: this.dir, maxBuffer: 10 * 1024 * 1024 }
      );

      // 检查是否有冲突标记文件
      const conflictFiles = await this.getConflictingFiles();

      // 无论是否有冲突，都需要 abort
      try {
        await execFileAsync('git', ['merge', '--abort'], { cwd: this.dir });
      } catch {
        // abort 失败可能是没有 merge 在进行，忽略
      }

      return {
        hasConflict: conflictFiles.length > 0,
        conflictingFiles: conflictFiles,
      };
    } catch (error: any) {
      // merge 失败说明有冲突
      const conflictFiles = await this.getConflictingFiles();
      
      // 尝试 abort
      try {
        await execFileAsync('git', ['merge', '--abort'], { cwd: this.dir });
      } catch {
        // ignore
      }

      return {
        hasConflict: true,
        conflictingFiles: conflictFiles,
      };
    }
  }

  /**
   * 检测变基是否会产生冲突
   */
  async checkRebaseConflict(upstream: string): Promise<ConflictCheckResult> {
    if (!this.dir) return { hasConflict: false };

    try {
      // 使用 git rebase --no-autostash --exec true 来检测冲突
      // 这会在不实际变基的情况下检测是否会冲突
      const { stdout, stderr } = await execFileAsync(
        'git',
        ['rebase', '--merge', '--no-commit', upstream],
        { cwd: this.dir, maxBuffer: 10 * 1024 * 1024 }
      );

      const conflictFiles = await this.getConflictingFiles();

      // Abort the rebase attempt
      try {
        await execFileAsync('git', ['rebase', '--abort'], { cwd: this.dir });
      } catch {
        // ignore
      }

      return {
        hasConflict: conflictFiles.length > 0 || stdout.includes('CONFLICT'),
        conflictingFiles: conflictFiles,
      };
    } catch (error: any) {
      // rebase 失败通常意味着有冲突
      const conflictFiles = await this.getConflictingFiles();

      // 尝试 abort
      try {
        await execFileAsync('git', ['rebase', '--abort'], { cwd: this.dir });
      } catch {
        // ignore
      }

      return {
        hasConflict: true,
        conflictingFiles: conflictFiles,
      };
    }
  }

  /**
   * 检测 cherry-pick 是否会产生冲突
   */
  async checkCherryPickConflict(oid: string): Promise<ConflictCheckResult> {
    if (!this.dir) return { hasConflict: false };

    try {
      // 执行 cherry-pick 但不提交
      await execFileAsync(
        'git',
        ['cherry-pick', '--no-commit', oid],
        { cwd: this.dir, maxBuffer: 10 * 1024 * 1024 }
      );

      const conflictFiles = await this.getConflictingFiles();

      // Abort the cherry-pick attempt
      try {
        await execFileAsync('git', ['cherry-pick', '--abort'], { cwd: this.dir });
      } catch {
        // ignore
      }

      return {
        hasConflict: conflictFiles.length > 0,
        conflictingFiles: conflictFiles,
      };
    } catch (error: any) {
      // cherry-pick 失败说明有冲突
      const conflictFiles = await this.getConflictingFiles();

      // 尝试 abort
      try {
        await execFileAsync('git', ['cherry-pick', '--abort'], { cwd: this.dir });
      } catch {
        // ignore
      }

      return {
        hasConflict: true,
        conflictingFiles: conflictFiles,
      };
    }
  }

  /**
   * 获取当前冲突文件列表
   */
  private async getConflictingFiles(): Promise<string[]> {
    if (!this.dir) return [];

    try {
      // 使用 git status --porcelain 获取冲突文件
      const { stdout } = await execFileAsync(
        'git',
        ['status', '--porcelain'],
        { cwd: this.dir }
      );

      const conflicts: string[] = [];
      for (const line of stdout.split('\n')) {
        // 冲突文件状态为 UU/AA/DD 等（两个字母）
        if (line.length >= 3) {
          const status = line.substring(0, 2);
          const filePath = line.substring(3).trim();
          
          // 检查是否是冲突状态（两个大写字母）
          if (status[0] !== ' ' && status[1] !== ' ' && 
              status[0] === status[0].toUpperCase() && 
              status[1] === status[1].toUpperCase()) {
            conflicts.push(filePath);
          }
        }
      }

      return conflicts;
    } catch {
      return [];
    }
  }

  // ========== 提交模板 ==========

  /**
   * 获取提交模板内容
   */
  async getCommitTemplate(): Promise<string | null> {
    if (!this.dir) return null;

    try {
      // 1. 检查 git config commit.template
      const { stdout: templatePath } = await execFileAsync(
        'git', ['config', 'commit.template'],
        { cwd: this.dir }
      ).catch(() => ({ stdout: '', stderr: '' }));

      if (templatePath.trim()) {
        const fullPath = path.isAbsolute(templatePath.trim())
          ? templatePath.trim()
          : path.join(this.dir, templatePath.trim());
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          return content.trim();
        } catch {
          // 模板文件不存在，继续尝试默认位置
        }
      }

      // 2. 检查 .git/commit-template
      const defaultPath = path.join(this.dir, '.git', 'commit-template');
      try {
        const content = await fs.readFile(defaultPath, 'utf-8');
        return content.trim();
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }

  // ========== 文件操作 ==========

  /**
   * 丢弃文件工作区修改
   */
  async discardChanges(paths: string[]): Promise<void> {
    if (!this.dir || paths.length === 0) return;

    try {
      await execFileAsync(
        'git', ['checkout', '--', ...paths],
        { cwd: this.dir, maxBuffer: 10 * 1024 * 1024 }
      );
    } catch (error) {
      console.error('[GitService] 丢弃更改失败:', error);
      throw error;
    }
  }

  /**
   * 删除未跟踪文件
   */
  async deleteUntrackedFile(filePath: string): Promise<void> {
    if (!this.dir) return;

    try {
      const fullPath = path.join(this.dir, filePath);
      await fs.unlink(fullPath);
    } catch (error) {
      console.error('[GitService] 删除文件失败:', error);
      throw error;
    }
  }

  // ========== 冲突解决 ==========

  /**
   * 获取冲突文件列表（含冲突数量）
   */
  async getConflictedFiles(): Promise<Array<{ path: string; conflictCount: number }>> {
    if (!this.dir) return [];

    try {
      const { stdout } = await execFileAsync(
        'git', ['diff', '--name-only', '--diff-filter=U'],
        { cwd: this.dir }
      );

      const files: Array<{ path: string; conflictCount: number }> = [];

      for (const filePath of stdout.trim().split('\n')) {
        if (!filePath.trim()) continue;

        try {
          const fullPath = path.join(this.dir, filePath);
          const content = await fs.readFile(fullPath, 'utf-8');
          const conflictCount = (content.match(/<<<<<<< /g) || []).length;
          files.push({ path: filePath, conflictCount });
        } catch {
          files.push({ path: filePath, conflictCount: 0 });
        }
      }

      return files;
    } catch {
      return [];
    }
  }

  /**
   * 使用本地版本解决冲突
   */
  async resolveConflictUseOurs(filePath: string): Promise<void> {
    if (!this.dir) return;

    await execFileAsync('git', ['checkout', '--ours', '--', filePath], { cwd: this.dir });
    await execFileAsync('git', ['add', '--', filePath], { cwd: this.dir });
  }

  /**
   * 使用远程版本解决冲突
   */
  async resolveConflictUseTheirs(filePath: string): Promise<void> {
    if (!this.dir) return;

    await execFileAsync('git', ['checkout', '--theirs', '--', filePath], { cwd: this.dir });
    await execFileAsync('git', ['add', '--', filePath], { cwd: this.dir });
  }

  /**
   * 批量解决所有冲突
   */
  async resolveAllConflicts(strategy: 'ours' | 'theirs'): Promise<void> {
    if (!this.dir) return;

    const conflicts = await this.getConflictedFiles();
    for (const file of conflicts) {
      if (strategy === 'ours') {
        await this.resolveConflictUseOurs(file.path);
      } else {
        await this.resolveConflictUseTheirs(file.path);
      }
    }
  }

  /**
   * 继续合并
   */
  async continueMerge(): Promise<void> {
    if (!this.dir) return;
    await execFileAsync('git', ['merge', '--continue'], { cwd: this.dir, maxBuffer: 10 * 1024 * 1024 });
  }

  /**
   * 中止合并
   */
  async abortMerge(): Promise<void> {
    if (!this.dir) return;
    await execFileAsync('git', ['merge', '--abort'], { cwd: this.dir });
  }

  /**
   * 继续变基
   */
  async continueRebase(): Promise<void> {
    if (!this.dir) return;
    await execFileAsync('git', ['rebase', '--continue'], { cwd: this.dir, maxBuffer: 10 * 1024 * 1024 });
  }

  /**
   * 中止变基
   */
  async abortRebase(): Promise<void> {
    if (!this.dir) return;
    await execFileAsync('git', ['rebase', '--abort'], { cwd: this.dir });
  }

  /**
   * 继续 cherry-pick
   */
  async continueCherryPick(): Promise<void> {
    if (!this.dir) return;
    await execFileAsync('git', ['cherry-pick', '--continue'], { cwd: this.dir, maxBuffer: 10 * 1024 * 1024 });
  }

  /**
   * 中止 cherry-pick
   */
  async abortCherryPick(): Promise<void> {
    if (!this.dir) return;
    await execFileAsync('git', ['cherry-pick', '--abort'], { cwd: this.dir });
  }

  // ========== 私有方法 ==========

  /**
   * 执行 git CLI 命令
   */
  // ========== 远程仓库管理 ==========

  /**
   * 添加远程仓库
   */
  async addRemote(name: string, url: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await git.addRemote({ fs: isoFs, dir: this.dir, remote: name, url });
      console.log(`[GitService] 添加远程仓库 ${name} -> ${url}`);
    } catch (error) {
      console.error('[GitService] 添加远程仓库失败:', error);
      throw error;
    }
  }

  /**
   * 移除远程仓库
   */
  async removeRemote(name: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await git.deleteRemote({ fs: isoFs, dir: this.dir, remote: name });
      console.log(`[GitService] 移除远程仓库 ${name}`);
    } catch (error) {
      console.error('[GitService] 移除远程仓库失败:', error);
      throw error;
    }
  }

  /**
   * 设置远程仓库 URL
   */
  async setRemoteUrl(name: string, url: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      // git remote set-url 会替换现有 URL
      await execFileAsync(
        'git',
        ['remote', 'set-url', name, url],
        { cwd: this.dir }
      );
      console.log(`[GitService] 更新远程仓库 URL ${name} -> ${url}`);
    } catch (error) {
      console.error('[GitService] 设置远程仓库 URL 失败:', error);
      throw error;
    }
  }

  /**
   * Fetch 所有远程仓库
   */
  async fetchAll(options?: { prune?: boolean }): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      const args = ['fetch', '--all'];
      if (options?.prune) {
        args.push('--prune');
      }
      await execFileAsync('git', args, { cwd: this.dir, maxBuffer: 50 * 1024 * 1024 });
      console.log('[GitService] Fetch all remotes');
    } catch (error) {
      console.error('[GitService] Fetch all 失败:', error);
      throw error;
    }
  }

  /**
   * Fetch（增强版，支持 prune）
   */
  async fetch(remote?: string, branch?: string, options?: { prune?: boolean }): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      const args = ['fetch'];
      
      if (remote) {
        args.push(remote);
        if (branch) {
          args.push(branch);
        }
      }
      
      if (options?.prune) {
        args.push('--prune');
      }

      await execFileAsync('git', args, { cwd: this.dir, maxBuffer: 50 * 1024 * 1024 });
      console.log('[GitService] Fetch 完成');
    } catch (error) {
      console.error('[GitService] Fetch 失败:', error);
      throw error;
    }
  }

  /**
   * Push（增强版，支持 forceWithLease）
   */
  async push(remote?: string, branch?: string, options?: { 
    force?: boolean; 
    forceWithLease?: boolean;
    setUpstream?: boolean;
  }): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      const args = ['push'];
      
      if (remote) {
        args.push(remote);
      }
      
      if (branch) {
        args.push(branch);
      }
      
      if (options?.force) {
        args.push('--force');
      } else if (options?.forceWithLease) {
        args.push('--force-with-lease');
      }
      
      if (options?.setUpstream && remote && branch) {
        args.push('--set-upstream');
        args.push(remote);
        args.push(branch);
      }

      await execFileAsync('git', args, { cwd: this.dir, maxBuffer: 50 * 1024 * 1024 });
      console.log('[GitService] Push 完成');
    } catch (error) {
      console.error('[GitService] Push 失败:', error);
      throw error;
    }
  }

  /**
   * Pull（增强版，支持 rebase）
   */
  async pull(remote?: string, branch?: string, options?: { rebase?: boolean }): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      const args = ['pull'];
      
      if (remote) {
        args.push(remote);
      }
      
      if (branch) {
        args.push(branch);
      }
      
      if (options?.rebase) {
        args.push('--rebase');
      }

      await execFileAsync('git', args, { cwd: this.dir, maxBuffer: 50 * 1024 * 1024 });
      console.log('[GitService] Pull 完成');
    } catch (error) {
      console.error('[GitService] Pull 失败:', error);
      throw error;
    }
  }

  /**
   * 获取分支跟踪信息（判断是否有上游）
   */
  async getUpstream(branch?: string): Promise<string | null> {
    if (!this.dir) return null;

    try {
      const branchName = branch || await git.currentBranch({ fs: isoFs, dir: this.dir, fullname: false });
      if (!branchName) return null;

      const upstream = await this.gitCliExec(['rev-parse', '--abbrev-ref', `${branchName}@{upstream}`]).catch(() => '');
      return upstream.trim() || null;
    } catch {
      return null;
    }
  }


  private async gitCliExec(args: string[], cwd?: string): Promise<string> {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd: cwd || this.dir || undefined,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stderr && !stderr.includes('warning:')) {
      console.warn('[GitService] git CLI stderr:', stderr);
    }

    return stdout;
  }

  /**
   * 简单 diff 实现（无 git CLI 时的降级方案）
   */
  private async simpleDiff(filePath?: string): Promise<GitDiff[]> {
    // 降级方案：只返回文件列表，不解析内容
    const status = await this.status();
    if (!status) return [];

    const files = filePath
      ? [...status.staged, ...status.unstaged, ...status.untracked].filter((f) => f.path === filePath)
      : [...status.staged, ...status.unstaged, ...status.untracked];

    return files.map((f) => ({
      type: 'text' as const,
      oldPath: f.path,
      newPath: f.path,
      hunks: [],
    }));
  }
}

// ========== 辅助函数 ==========

/**
 * 解析 git diff 输出为结构化数据
 */
function parseDiffOutput(output: string): GitDiff[] {
  if (!output.trim()) return [];

  const diffs: GitDiff[] = [];
  let currentDiff: GitDiff | null = null;
  let currentHunk: GitDiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of output.split('\n')) {
    // 新的 diff 文件头
    if (line.startsWith('diff --git')) {
      if (currentDiff) diffs.push(currentDiff);

      currentDiff = {
        type: 'text',
        hunks: [],
      };
      currentHunk = null;
      continue;
    }

    if (!currentDiff) continue;

    // 旧文件路径
    if (line.startsWith('--- ')) {
      currentDiff.oldPath = line.substring(4).replace(/^a\//, '');
      if (currentDiff.oldPath === '/dev/null') currentDiff.oldPath = undefined;
      continue;
    }

    // 新文件路径
    if (line.startsWith('+++ ')) {
      currentDiff.newPath = line.substring(4).replace(/^b\//, '');
      if (currentDiff.newPath === '/dev/null') {
        currentDiff.newPath = undefined;
        currentDiff.type = 'deleted';
      }
      if (!currentDiff.oldPath) currentDiff.type = 'untracked';
      continue;
    }

    // 二进制文件
    if (line.startsWith('Binary files')) {
      currentDiff.type = 'binary';
      continue;
    }

    // Hunk 头
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      currentHunk = {
        oldStart: parseInt(hunkMatch[1]),
        oldLines: parseInt(hunkMatch[2] || '1'),
        newStart: parseInt(hunkMatch[3]),
        newLines: parseInt(hunkMatch[4] || '1'),
        lines: [],
      };
      oldLine = currentHunk.oldStart;
      newLine = currentHunk.newStart;
      currentDiff.hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk) continue;

    // Diff 行
    const diffLine: GitDiffLine = {
      type: 'context',
      content: '',
    };

    if (line.startsWith('+')) {
      diffLine.type = 'add';
      diffLine.content = line.substring(1);
      diffLine.newLineNumber = newLine++;
    } else if (line.startsWith('-')) {
      diffLine.type = 'delete';
      diffLine.content = line.substring(1);
      diffLine.oldLineNumber = oldLine++;
    } else if (line.startsWith(' ')) {
      diffLine.type = 'context';
      diffLine.content = line.substring(1);
      diffLine.oldLineNumber = oldLine++;
      diffLine.newLineNumber = newLine++;
    } else {
      // 续行（\ No newline at end of file 等）
      diffLine.type = 'context';
      diffLine.content = line;
    }

    currentHunk.lines.push(diffLine);
  }

  if (currentDiff) diffs.push(currentDiff);

  return diffs;
}

/**
 * 解析 git merge-tree 输出获取冲突文件
 */
function parseMergeTreeOutput(output: string): string[] {
  const conflicts: string[] = [];
  
  // merge-tree 输出格式：包含 "changed in both" 或 "deleted in them" 等表示冲突
  const lines = output.split('\n');
  
  for (const line of lines) {
    // 检测冲突标记
    if (line.includes('changed in both') || 
        line.includes('modified in both') ||
        line.includes('deleted in them') ||
        line.includes('deleted in us')) {
      // 提取文件路径
      const match = line.match(/:(\d+):(\d+): (.*)/);
      if (match) {
        conflicts.push(match[3]);
      }
    }
  }

  return [...new Set(conflicts)]; // 去重
}

/**
 * 解析 git diff-tree --name-status 输出
 */
function parseNameStatus(output: string): CommitFileChange[] {
  const files: CommitFileChange[] = [];
  const statusMap: Record<string, CommitFileChange['shortStatus']> = {
    A: 'A',
    M: 'M',
    D: 'D',
    R: 'R',
    C: 'C',
  };
  const fullStatusMap: Record<string, CommitFileChange['status']> = {
    A: 'added',
    M: 'modified',
    D: 'deleted',
    R: 'renamed',
    C: 'copied',
  };

  for (const line of output.trim().split('\n')) {
    if (!line.trim()) continue;

    const parts = line.split('\t');
    const statusCode = parts[0]?.trim();
    const filePath = parts[1] || parts[0]?.substring(1)?.trim();

    if (!statusCode || !filePath) continue;

    const shortStatus = statusMap[statusCode[0]] || 'M';
    const status = fullStatusMap[statusCode[0]] || 'modified';

    files.push({
      path: filePath,
      status,
      shortStatus,
      additions: 0, // 需要单独获取
      deletions: 0,
      oldPath: statusCode.startsWith('R') ? parts[1] : undefined,
    });
  }

  return files;
}

// 导出单例
export const gitService = new GitService();

/**
 * 获取所有分支的跟踪状态
 * 使用 git rev-list --left-right --count 来计算 ahead/behind
 */
async getBranchTrackingStatus(): Promise<Record<string, { ahead: number; behind: number }>> {
  if (!this.dir) return {};

  const status: Record<string, { ahead: number; behind: number }> = {};

  try {
    // 获取所有本地分支
    const branches = await git.listBranches({ fs: isoFs, dir: this.dir });
    
    for (const branch of branches) {
      if (branch === 'HEAD') continue;
      
      try {
        // 获取上游分支名
        const upstream = await this.gitCliExec(['rev-parse', '--abbrev-ref', `${branch}@{upstream}`]).catch(() => '');
        
        if (upstream.trim()) {
          // 使用 git rev-list 计算 ahead/behind
          const { stdout } = await execFileAsync(
            'git',
            ['rev-list', '--left-right', '--count', `${branch}...${upstream.trim()}`],
            { cwd: this.dir }
          );
          
          const [behind, ahead] = stdout.trim().split('\t').map(Number);
          status[branch] = { ahead: ahead || 0, behind: behind || 0 };
        }
      } catch {
        // 忽略无法获取跟踪状态的分支
      }
    }
  } catch (error) {
    console.error('[GitService] 获取分支跟踪状态失败:', error);
  }

  return status;

  /**
   * 获取图片Diff信息
   */
  async getImageDiff(filePath: string, oldOid?: string, newOid?: string): Promise<any> {
    const isImage = /\.(png|jpg|jpeg|gif|bmp|svg|webp|ico|tiff?)$/i.test(filePath);
    if (!isImage) {
      return null;
    }

    const result: any = {
      oldPath: null,
      newPath: filePath,
      isBinary: true,
    };

    try {
      const repoPath = this.repoPath!;
      
      // Get new image content
      if (newOid || !oldOid) {
        const newRef = newOid || 'HEAD';
        try {
          const { blob } = await this.git.readObject({ fs, dir: repoPath, oid: await this.git.resolveRef({ fs, dir: repoPath, ref: newRef }).then(r => r).catch(() => newRef) });
          if (blob) {
            result.newImage = Buffer.from(blob).toString('base64');
          }
        } catch {
          // File might be new (no old version)
          try {
            const fs_mod = require('fs');
            const fullPath = require('path').join(repoPath, filePath);
            if (fs_mod.existsSync(fullPath)) {
              const buf = fs_mod.readFileSync(fullPath);
              result.newImage = buf.toString('base64');
            }
          } catch {}
        }
      }

      // Get old image content
      if (oldOid) {
        try {
          const { blob } = await this.git.readObject({ fs, dir: repoPath, oid: oldOid });
          if (blob) {
            result.oldImage = Buffer.from(blob).toString('base64');
            result.oldPath = filePath;
          }
        } catch {}
      }

      return result;
    } catch (error) {
      console.error('Failed to get image diff:', error);
      return result;
    }
  }

  /**
   * 获取文件历史（增强版，返回详细条目）
   */
  async getFileHistoryEnhanced(filePath: string): Promise<any[]> {
    try {
      const repoPath = this.repoPath!;
      const logs = await this.git.log({ fs, dir: repoPath, filepath: filePath, depth: 100 });
      
      return logs.map(commit => ({
        oid: commit.oid,
        message: commit.commit.message.split('\n')[0],
        author: commit.commit.author.name,
        date: commit.commit.author.timestamp.toString(),
        status: 'M', // Default, actual status needs diff analysis
      }));
    } catch (error) {
      console.error('Failed to get file history enhanced:', error);
      return [];
    }
  }

  /**
   * 获取文件在指定提交的内容(base64)
   */
  async getFileContent(filePath: string, oid: string): Promise<string | null> {
    try {
      const repoPath = this.repoPath!;
      const { blob } = await this.git.readObject({ fs, dir: repoPath, oid });
      if (blob) {
        return Buffer.from(blob).toString('base64');
      }
      return null;
    } catch (error) {
      console.error('Failed to get file content:', error);
      return null;
    }
  }

}
