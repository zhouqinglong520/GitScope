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
} from '../../../shared/types/git.js';

const execFileAsync = promisify(execFile);

/** isomorphic-git 使用的 fs */
const isoFs = { promises: fs };

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
   */
  async diff(filePath?: string, commitOid?: string): Promise<GitDiff[]> {
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

      const { stdout } = await execFileAsync(cmd, args, { cwd: this.dir, maxBuffer: 10 * 1024 * 1024 });
      return parseDiffOutput(stdout);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // git CLI 不可用，降级到简单实现
        return this.simpleDiff(filePath);
      }
      console.error('[GitService] diff 失败:', error);
      return [];
    }
  }

  /**
   * 获取暂存区 diff
   */
  async stagedDiff(filePath?: string): Promise<GitDiff[]> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      const args = ['diff', '--cached'];
      if (filePath) args.push('--', filePath);

      const { stdout } = await execFileAsync('git', args, { cwd: this.dir, maxBuffer: 10 * 1024 * 1024 });
      return parseDiffOutput(stdout);
    } catch {
      return [];
    }
  }

  /**
   * 添加文件到暂存区
   */
  async add(files: string[]): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      for (const file of files) {
        await git.add({ fs: isoFs, dir: this.dir, filepath: file });
      }
    } catch (error) {
      console.error('[GitService] add 失败，尝试 git CLI:', error);
      // 降级到 git CLI
      await this.gitCliExec(['add', ...files]);
    }
  }

  /**
   * 添加所有文件
   */
  async addAll(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      const matrix = await git.statusMatrix({ fs: isoFs, dir: this.dir });
      for (const [filePath, , , stageStatus] of matrix) {
        const st = stageStatus as number;
        if (st === 0) {
          await git.add({ fs: isoFs, dir: this.dir, filepath: filePath });
        }
      }
    } catch {
      await this.gitCliExec(['add', '.']);
    }
  }

  /**
   * 从暂存区移除
   */
  async reset(files: string[]): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      for (const file of files) {
        await git.resetIndex({ fs: isoFs, dir: this.dir, filepath: file });
      }
    } catch {
      await this.gitCliExec(['reset', 'HEAD', '--', ...files]);
    }
  }

  /**
   * 提交更改
   */
  async commit(options: CommitOptions): Promise<string> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      const sha = await git.commit({
        fs: isoFs,
        dir: this.dir,
        message: options.message,
        author: options.author
          ? { name: options.author.name, email: options.author.email }
          : undefined,
      });
      return sha;
    } catch (error) {
      console.error('[GitService] isomorphic-git commit 失败，尝试 CLI:', error);
      const args = ['commit', '-m', options.message];
      if (options.author) {
        args.push('--author', `${options.author.name} <${options.author.email}>`);
      }
      await this.gitCliExec(args);
      // 获取最新 commit sha
      const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: this.dir! });
      return stdout.trim();
    }
  }

  /**
   * 克隆仓库
   */
  async clone(options: CloneOptions): Promise<void> {
    try {
      await git.clone({
        fs: isoFs,
        http,
        dir: options.path,
        url: options.url,
        depth: options.depth,
        singleBranch: options.singleBranch,
        ref: options.branch,
      });
    } catch (error) {
      console.error('[GitService] isomorphic-git clone 失败，尝试 CLI:', error);
      const args = ['clone', options.url, options.path];
      if (options.depth) args.push('--depth', String(options.depth));
      if (options.singleBranch) args.push('--single-branch');
      if (options.branch) args.push('--branch', options.branch);
      await this.gitCliExec(args, undefined);
    }
  }

  /**
   * 推送更改
   */
  async push(remote?: string, branch?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await git.push({
        fs: isoFs,
        http,
        dir: this.dir,
        remote: remote || 'origin',
        ref: branch || undefined,
      });
    } catch (error) {
      console.error('[GitService] isomorphic-git push 失败，尝试 CLI:', error);
      const args = ['push', remote || 'origin'];
      if (branch) args.push(branch);
      await this.gitCliExec(args);
    }
  }

  /**
   * 拉取更改
   */
  async pull(remote?: string, branch?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await git.pull({
        fs: isoFs,
        http,
        dir: this.dir,
        remote: remote || 'origin',
        ref: branch || undefined,
      });
    } catch (error) {
      console.error('[GitService] isomorphic-git pull 失败，尝试 CLI:', error);
      const args = ['pull', remote || 'origin'];
      if (branch) args.push(branch);
      await this.gitCliExec(args);
    }
  }

  /**
   * 获取远程更新
   */
  async fetch(remote?: string, branch?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await git.fetch({
        fs: isoFs,
        http,
        dir: this.dir,
        remote: remote || 'origin',
        ref: branch || undefined,
      });
    } catch (error) {
      console.error('[GitService] isomorphic-git fetch 失败，尝试 CLI:', error);
      const args = ['fetch', remote || 'origin'];
      if (branch) args.push(branch);
      await this.gitCliExec(args);
    }
  }

  /**
   * 获取远程列表
   */
  async remotes(): Promise<GitRemote[]> {
    if (!this.dir) return [];

    try {
      const list = await git.listRemotes({ fs: isoFs, dir: this.dir });
      return list.map((r) => ({ name: r.remote, url: r.url }));
    } catch {
      return [];
    }
  }

  /**
   * 创建分支
   */
  async createBranch(name: string, startPoint?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await git.branch({
        fs: isoFs,
        dir: this.dir,
        ref: name,
        object: startPoint || undefined,
      });
    } catch (error) {
      console.error('[GitService] 创建分支失败，尝试 CLI:', error);
      const args = ['branch', name];
      if (startPoint) args.push(startPoint);
      await this.gitCliExec(args);
    }
  }

  /**
   * 切换分支
   */
  async checkout(ref: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await git.checkout({
        fs: isoFs,
        dir: this.dir,
        ref,
      });
    } catch (error) {
      console.error('[GitService] checkout 失败，尝试 CLI:', error);
      await this.gitCliExec(['checkout', ref]);
    }
  }

  /**
   * 删除分支
   */
  async deleteBranch(name: string, force = false): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await git.deleteBranch({ fs: isoFs, dir: this.dir, ref: name });
    } catch (error) {
      console.error('[GitService] 删除分支失败，尝试 CLI:', error);
      const args = ['branch', force ? '-D' : '-d', name];
      await this.gitCliExec(args);
    }
  }

  /**
   * 合并分支
   */
  async merge(branch: string): Promise<{ success: boolean; conflict?: boolean }> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      const currentBranch = await git.currentBranch({ fs: isoFs, dir: this.dir, fullname: false }) || 'HEAD';
      const result = await git.merge({
        fs: isoFs,
        dir: this.dir,
        ours: currentBranch,
        theirs: branch,
      });
      return { success: !result.alreadyMerged, conflict: false };
    } catch (error: any) {
      if (error?.code === 'MergeNotSupportedError' || error?.data?.conflicts) {
        return { success: false, conflict: true };
      }
      console.error('[GitService] merge 失败，尝试 CLI:', error);
      try {
        await this.gitCliExec(['merge', branch]);
        return { success: true, conflict: false };
      } catch {
        return { success: false, conflict: true };
      }
    }
  }

  /**
   * 获取标签列表
   */
  async tags(): Promise<GitTag[]> {
    if (!this.dir) return [];

    try {
      const tagNames = await git.listTags({ fs: isoFs, dir: this.dir });
      const result: GitTag[] = [];

      for (const name of tagNames) {
        try {
          const oid = await git.resolveRef({ fs: isoFs, dir: this.dir, ref: name });
          result.push({ name, oid });
        } catch {
          result.push({ name, oid: '' });
        }
      }

      return result;
    } catch {
      return [];
    }
  }

  /**
   * 创建标签
   */
  async createTag(name: string, oid?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await git.tag({ fs: isoFs, dir: this.dir, ref: name, object: oid || undefined });
    } catch (error) {
      console.error('[GitService] 创建标签失败，尝试 CLI:', error);
      const args = ['tag', name];
      if (oid) args.push(oid);
      await this.gitCliExec(args);
    }
  }

  /**
   * Stash 暂存
   */
  async stash(message?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    const args = ['stash', 'push'];
    if (message) args.push('-m', message);
    await this.gitCliExec(args);
  }

  /**
   * Stash pop
   */
  async stashPop(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    await this.gitCliExec(['stash', 'pop']);
  }

  /**
   * 获取提交详情（包含文件变更列表）
   */
  async getCommitDetail(oid: string): Promise<CommitDetail | null> {
    if (!this.dir) return null;

    try {
      // 获取提交信息
      const commitObj = await git.readCommit({ fs: isoFs, dir: this.dir, oid });
      const commit: GitCommit = {
        oid: commitObj.oid,
        shortOid: commitObj.oid.substring(0, 7),
        message: commitObj.commit.message.split('\n')[0],
        fullMessage: commitObj.commit.message,
        authorName: commitObj.commit.author.name,
        authorEmail: commitObj.commit.author.email,
        authorTimestamp: commitObj.commit.author.timestamp,
        committerName: commitObj.commit.committer.name,
        committerEmail: commitObj.commit.committer.email,
        committerTimestamp: commitObj.commit.committer.timestamp,
        parentIds: commitObj.commit.parent,
      };

      // 获取文件变更列表（使用 git CLI）
      let files: CommitFileChange[] = [];
      try {
        const { stdout } = await execFileAsync(
          'git',
          ['diff-tree', '--no-commit-id', '--name-status', '-r', oid],
          { cwd: this.dir }
        );
        files = parseNameStatus(stdout);
      } catch {
        // CLI 不可用时返回空列表
      }

      return { commit, files };
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
      const rawCommits = await git.log({
        fs: isoFs,
        dir: this.dir,
        depth: 100,
        ref: 'HEAD',
      });

      // 过滤出涉及该文件的提交
      const commits: GitCommit[] = [];
      const stats: Record<string, { additions: number; deletions: number }> = {};

      for (const c of rawCommits) {
        try {
          // 使用 git CLI 检查文件是否在该提交中变更
          const { stdout } = await execFileAsync(
            'git',
            ['diff-tree', '--no-commit-id', '--name-only', '-r', c.oid, '--', filePath],
            { cwd: this.dir }
          );

          if (stdout.trim().includes(filePath)) {
            commits.push({
              oid: c.oid,
              shortOid: c.oid.substring(0, 7),
              message: c.commit.message.split('\n')[0],
              fullMessage: c.commit.message,
              authorName: c.commit.author.name,
              authorEmail: c.commit.author.email,
              authorTimestamp: c.commit.author.timestamp,
              committerName: c.commit.committer.name,
              committerEmail: c.commit.committer.email,
              committerTimestamp: c.commit.committer.timestamp,
              parentIds: c.commit.parent,
            });

            // 获取变更统计
            try {
              const { stdout: numstat } = await execFileAsync(
                'git',
                ['diff-tree', '--no-commit-id', '--numstat', '-r', c.oid, '--', filePath],
                { cwd: this.dir }
              );
              const parts = numstat.trim().split('\t');
              if (parts.length >= 2) {
                stats[c.oid] = {
                  additions: parseInt(parts[0]) || 0,
                  deletions: parseInt(parts[1]) || 0,
                };
              }
            } catch {
              stats[c.oid] = { additions: 0, deletions: 0 };
            }
          }
        } catch {
          // 忽略单个提交的错误
        }
      }

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

  // ========== 私有方法 ==========

  /**
   * 执行 git CLI 命令
   */
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
