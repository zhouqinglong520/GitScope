/**
 * Git 服务完整实现
 * 策略：isomorphic-git 为主，git CLI 降级兜底
 * 
 * isomorphic-git：纯 JS 实现，跨平台，用于 log/branch/status/add/commit 等基础操作
 * git CLI：用于 isomorphic-git 不完善的功能（diff 详细内容、merge、stash、fetch 等）
 */
// @ts-nocheck
export {};

const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');

const execFileAsync = promisify(execFile);

/** isomorphic-git 使用的 fs */
const isoFs = { promises: fs };

/** Git 服务类 */
class GitService {
  private dir: string | null = null;

  /** 获取当前仓库路径 — 供 IPC 调用 */
  getRepoPath(): string | null {
    return this.dir;
  }

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
  async diff(filePath?: string, commitOid?: string, algorithm?: 'myers' | 'patience' | 'histogram'): Promise<GitDiff[]> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      let cmd = 'git';
      let args: string[];

      if (commitOid) {
        // 查看某个提交的 diff
        // 需要先获取提交的父提交信息
        try {
          const commitObj = await git.readCommit({ fs: isoFs, dir: this.dir, oid: commitOid });
          if (commitObj.commit.parent.length === 0) {
            // 初始提交，使用 --root 参数
            args = ['diff', '--root', '--', ...(filePath ? [filePath] : [])];
          } else {
            // 有父提交的情况
            const parentOid = commitObj.commit.parent[0];
            args = ['diff', parentOid, commitOid, ...(filePath ? ['--', filePath] : [])];
          }
        } catch {
          // 读取提交信息失败，使用传统方式
          args = ['diff', commitOid + '^', commitOid, ...(filePath ? ['--', filePath] : [])];
        }
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
  async stagedDiff(filePath?: string, algorithm?: 'myers' | 'patience' | 'histogram'): Promise<GitDiff[]> {
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
   * 暂存文件（stage）- 别名方法
   */
  async stage(files: string[]): Promise<void> {
    await this.add(files);
  }

  /**
   * 暂存所有文件（stageAll）- 别名方法
   */
  async stageAll(): Promise<void> {
    await this.addAll();
  }

  /**
   * 取消暂存（unstage）
   */
  async unstage(files: string[]): Promise<void> {
    await this.reset(files);
  }

  /**
   * 取消暂存所有（unstageAll）
   */
  async unstageAll(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await this.gitCliExec(['reset', 'HEAD']);
    } catch (error) {
      console.error('[GitService] unstageAll 失败:', error);
      throw error;
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
   * 创建分支并切换
   */
  async createBranch(name: string, startPoint?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      // 使用 git CLI 直接创建并切换分支（更可靠）
      const args = ['checkout', '-b', name];
      if (startPoint) args.push(startPoint);
      await this.gitCliExec(args);
    } catch (error) {
      console.error('[GitService] 创建分支失败:', error);
      // 降级到分步操作
      try {
        await git.branch({
          fs: isoFs,
          dir: this.dir,
          ref: name,
          object: startPoint || undefined,
        });
        await git.checkout({
          fs: isoFs,
          dir: this.dir,
          ref: name,
        });
      } catch (fallbackError) {
        console.error('[GitService] 降级方案也失败:', fallbackError);
        throw error;
      }
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
   * 删除标签
   */
  async deleteTag(name: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await this.gitCliExec(['tag', '-d', name]);
    } catch (error) {
      console.error('[GitService] 删除标签失败:', error);
      throw error;
    }
  }

  /**
   * 添加远程仓库
   */
  async addRemote(name: string, url: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await this.gitCliExec(['remote', 'add', name, url]);
    } catch (error) {
      console.error('[GitService] 添加远程仓库失败:', error);
      throw error;
    }
  }

  /**
   * 删除远程仓库
   */
  async removeRemote(name: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await this.gitCliExec(['remote', 'remove', name]);
    } catch (error) {
      console.error('[GitService] 删除远程仓库失败:', error);
      throw error;
    }
  }

  /**
   * 修改远程仓库 URL
   */
  async setRemoteUrl(name: string, url: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await this.gitCliExec(['remote', 'set-url', name, url]);
    } catch (error) {
      console.error('[GitService] 修改远程仓库 URL 失败:', error);
      throw error;
    }
  }

  /**
   * 获取 reflog
   */
  async reflog(): Promise<Array<{ hash: string; action: string; ref: string; message: string; date: string }>> {
    if (!this.dir) return [];

    try {
      const { stdout } = await execFileAsync('git', ['reflog', '--format=%H|%gd|%gs|%gD'], { cwd: this.dir });
      const lines = stdout.trim().split('\n').filter(Boolean);
      const entries: Array<{ hash: string; action: string; ref: string; message: string; date: string }> = [];

      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 4) {
          entries.push({
            hash: parts[0],
            ref: parts[1],
            action: parts[1].includes('HEAD@{') ? 'HEAD' : parts[1],
            message: parts[2],
            date: parts[3],
          });
        }
      }

      return entries;
    } catch {
      return [];
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
  async stashPop(index?: number): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    const args = ['stash', 'pop'];
    if (index !== undefined) args.push(`stash@{${index}}`);
    await this.gitCliExec(args);
  }

  /**
   * Stash apply - 应用 stash 但不删除
   */
  async stashApply(index?: number): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    const args = ['stash', 'apply'];
    if (index !== undefined) args.push(`stash@{${index}}`);
    await this.gitCliExec(args);
  }

  /**
   * Stash drop - 删除 stash
   */
  async stashDrop(index?: number): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    const args = ['stash', 'drop'];
    if (index !== undefined) args.push(`stash@{${index}}`);
    await this.gitCliExec(args);
  }

  /**
   * 获取 stash 列表
   */
  async getStashes(): Promise<GitStashEntry[]> {
    if (!this.dir) return [];

    try {
      const { stdout } = await execFileAsync('git', ['stash', 'list', '--format=%gd:%gs:%gD'], { cwd: this.dir });
      const lines = stdout.trim().split('\n').filter(Boolean);
      const stashes: GitStashEntry[] = [];

      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(':');
        const ref = parts[0];
        const message = parts.slice(1).join(':');
        
        // 获取 stash 的详细信息
        let files: StashFileChange[] = [];
        let stats = { additions: 0, deletions: 0, filesChanged: 0 };
        
        try {
          const { stdout: diffOut } = await execFileAsync('git', ['diff', `${ref}^`, ref, '--name-status'], { cwd: this.dir });
          const diffLines = diffOut.trim().split('\n');
          for (const line of diffLines) {
            const [status, path] = line.split('\t');
            if (status && path) {
              files.push({
                path,
                type: status === 'A' ? 'added' : status === 'D' ? 'deleted' : 'modified',
                additions: 0,
                deletions: 0,
              });
              stats.filesChanged++;
            }
          }
        } catch {
          // 忽略获取文件列表失败
        }

        stashes.push({
          index: i,
          ref,
          message,
          date: Date.now(),
          dateStr: new Date().toLocaleString(),
          files,
          stats,
        });
      }

      return stashes;
    } catch {
      return [];
    }
  }

  /**
   * 重命名分支
   */
  async renameBranch(oldName: string, newName: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await this.gitCliExec(['branch', '-m', oldName, newName]);
    } catch (error) {
      console.error('[GitService] 重命名分支失败:', error);
      throw error;
    }
  }

  /**
   * 撤销提交（revert）
   */
  async revert(oid: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await this.gitCliExec(['revert', oid]);
    } catch (error) {
      console.error('[GitService] revert 失败:', error);
      throw error;
    }
  }

  /**
   * Cherry-pick 提交
   */
  async cherryPick(oid: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');

    try {
      await this.gitCliExec(['cherry-pick', oid]);
    } catch (error) {
      console.error('[GitService] cherry-pick 失败:', error);
      throw error;
    }
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
        // 获取文件状态和路径
        const { stdout: statusOutput } = await execFileAsync(
          'git',
          ['diff-tree', '--no-commit-id', '--name-status', '-r', oid],
          { cwd: this.dir }
        );
        
        // 根据是否有父提交选择不同的 diff 命令
        let numstatOutput = '';
        if (commitObj.commit.parent.length > 0) {
          // 有父提交的情况
          const { stdout } = await execFileAsync(
            'git',
            ['diff', '--numstat', oid + '^', oid],
            { cwd: this.dir }
          );
          numstatOutput = stdout;
        } else {
          // 初始提交，使用 --root 参数
          const { stdout } = await execFileAsync(
            'git',
            ['diff', '--numstat', '--root', oid],
            { cwd: this.dir }
          );
          numstatOutput = stdout;
        }

        // 解析状态信息
        const statusMap: Record<string, CommitFileChange['shortStatus']> = {
          A: 'A', M: 'M', D: 'D', R: 'R', C: 'C',
        };
        const fullStatusMap: Record<string, CommitFileChange['status']> = {
          A: 'added', M: 'modified', D: 'deleted', R: 'renamed', C: 'copied',
        };

        // 解析 numstat 输出，创建路径到统计的映射
        const numstatMap: Record<string, { additions: number; deletions: number }> = {};
        for (const line of numstatOutput.trim().split('\n')) {
          if (!line.trim()) continue;
          const parts = line.split('\t');
          if (parts.length >= 3) {
            const additions = parseInt(parts[0]) || 0;
            const deletions = parseInt(parts[1]) || 0;
            const filePath = parts[2];
            numstatMap[filePath] = { additions, deletions };
          }
        }

        // 解析状态输出并合并统计信息
        for (const line of statusOutput.trim().split('\n')) {
          if (!line.trim()) continue;
          const parts = line.split('\t');
          const statusCode = parts[0]?.trim();
          const filePath = parts[1] || parts[0]?.substring(1)?.trim();

          if (!statusCode || !filePath) continue;

          const shortStatus = statusMap[statusCode[0]] || 'M';
          const status = fullStatusMap[statusCode[0]] || 'modified';
          const stats = numstatMap[filePath] || { additions: 0, deletions: 0 };

          files.push({
            path: filePath,
            status,
            shortStatus,
            additions: stats.additions,
            deletions: stats.deletions,
            oldPath: statusCode.startsWith('R') ? parts[1] : undefined,
          });
        }
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
   * 获取当前分支名
   */
  private async currentBranch(): Promise<string | null> {
    if (!this.dir) return null;

    try {
      return await git.currentBranch({ fs: isoFs, dir: this.dir, fullname: false }) || null;
    } catch {
      return null;
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

  /**
   * 获取当前分支与上游分支的 ahead/behind 数量
   */
  async getAheadBehind(): Promise<{ ahead: number; behind: number }> {
    if (!this.dir) return { ahead: 0, behind: 0 };

    try {
      const { stdout } = await execFileAsync('git', ['rev-list', '--count', '--left-right', '@{upstream}...HEAD'], { cwd: this.dir });
      const parts = stdout.trim().split('\t');
      if (parts.length === 2) {
        return {
          behind: parseInt(parts[0], 10) || 0,
          ahead: parseInt(parts[1], 10) || 0,
        };
      }
    } catch {
      // 如果没有上游分支，返回默认值
    }

    return { ahead: 0, behind: 0 };
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
  // ========== 冲突解决 ==========

  /** 中止合并 */
  async abortMerge(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['merge', '--abort']);
  }

  /** 继续合并 */
  async continueMerge(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['merge', '--continue']);
  }

  /** 中止变基 */
  async abortRebase(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['rebase', '--abort']);
  }

  /** 继续变基 */
  async continueRebase(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['rebase', '--continue']);
  }

  /** 中止拣选 */
  async abortCherryPick(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['cherry-pick', '--abort']);
  }

  /** 继续拣选 */
  async continueCherryPick(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['cherry-pick', '--continue']);
  }

  /** 获取冲突文件列表 */
  async getConflictedFiles(): Promise<string[]> {
    if (!this.dir) return [];
    try {
      const { stdout } = await this.gitCliExec(['diff', '--name-only', '--diff-filter=U']);
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  /** 使用我们的版本解决冲突 */
  async resolveConflictUseOurs(filePath: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['checkout', '--ours', filePath]);
    await this.gitCliExec(['add', filePath]);
  }

  /** 使用他们的版本解决冲突 */
  async resolveConflictUseTheirs(filePath: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['checkout', '--theirs', filePath]);
    await this.gitCliExec(['add', filePath]);
  }

  /** 用指定策略解决所有冲突 */
  async resolveAllConflicts(strategy: 'ours' | 'theirs'): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    const conflicts = await this.getConflictedFiles();
    for (const file of conflicts) {
      if (strategy === 'ours') {
        await this.resolveConflictUseOurs(file);
      } else {
        await this.resolveConflictUseTheirs(file);
      }
    }
  }

  /** 预检合并是否会产生冲突 */
  async checkMergeConflict(branch: string): Promise<{ hasConflict: boolean; files: string[] }> {
    if (!this.dir) return { hasConflict: false, files: [] };
    try {
      const mergeBase = (await this.gitCliExec(['merge-base', 'HEAD', branch])).stdout.trim();
      const { stdout } = await this.gitCliExec(['merge-tree', mergeBase, 'HEAD', branch]);
      const files: string[] = [];
      for (const line of stdout.split('\n')) {
        if (line.includes('changed in both') || line.includes('CONFLICT')) {
          const match = line.match(/:(\d+):(\d+): (.*)/);
          if (match) files.push(match[3]);
        }
      }
      return { hasConflict: files.length > 0, files };
    } catch {
      return { hasConflict: false, files: [] };
    }
  }

  /** 预检变基是否会产生冲突 */
  async checkRebaseConflict(onto: string): Promise<{ hasConflict: boolean; files: string[] }> {
    if (!this.dir) return { hasConflict: false, files: [] };
    try {
      const { stdout } = await this.gitCliExec(['diff', '--name-only', '--diff-filter=U', onto + '...HEAD']);
      const files = stdout.trim().split('\n').filter(Boolean);
      return { hasConflict: files.length > 0, files };
    } catch {
      return { hasConflict: false, files: [] };
    }
  }

  /** 预检拣选是否会产生冲突 */
  async checkCherryPickConflict(oid: string): Promise<{ hasConflict: boolean; files: string[] }> {
    if (!this.dir) return { hasConflict: false, files: [] };
    try {
      const { stdout } = await this.gitCliExec(['cherry-pick', '--no-commit', oid]);
      const conflicts = await this.getConflictedFiles();
      await this.gitCliExec(['cherry-pick', '--abort']);
      return { hasConflict: conflicts.length > 0, files: conflicts };
    } catch {
      return { hasConflict: false, files: [] };
    }
  }

  // ========== Bisect 二分查找 ==========

  /** 开始 bisect */
  async bisectStart(goodRef?: string, badRef?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    const args = ['bisect', 'start'];
    if (badRef) args.push(badRef);
    if (goodRef) args.push(goodRef);
    await this.gitCliExec(args);
  }

  /** 标记 bisect 提交 */
  async bisectMark(ref: string, kind: 'good' | 'bad'): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['bisect', kind, ref]);
  }

  /** 跳过当前 bisect 提交 */
  async bisectSkip(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['bisect', 'skip']);
  }

  /** 重置 bisect */
  async bisectReset(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['bisect', 'reset']);
  }

  /** 获取 bisect 状态 */
  async getBisectState(): Promise<{ active: boolean; goodRef?: string; badRef?: string; remaining?: number }> {
    if (!this.dir) return { active: false };
    try {
      const { stdout } = await this.gitCliExec(['bisect', 'log']);
      const isActive = stdout.trim().length > 0;
      return { active: isActive };
    } catch {
      return { active: false };
    }
  }

  // ========== LFS 大文件存储 ==========

  /** 获取 LFS 状态 */
  async getLfsStatus(): Promise<{ tracked: string[]; locked: string[]; pointers: string[] }> {
    if (!this.dir) return { tracked: [], locked: [], pointers: [] };
    try {
      const { stdout: trackOut } = await this.gitCliExec(['lfs', 'track']);
      const tracked = trackOut.trim().split('\n').filter(l => l && !l.startsWith('Listing')).map(l => l.split(' ')[0]).filter(Boolean);
      const { stdout: lockOut } = await this.gitCliExec(['lfs', 'locks']);
      const locked = lockOut.trim().split('\n').filter(Boolean).map(l => l.split('\t')[0]);
      return { tracked, locked, pointers: [] };
    } catch {
      return { tracked: [], locked: [], pointers: [] };
    }
  }

  /** 安装 LFS */
  async installLfs(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['lfs', 'install']);
  }

  /** LFS 追踪 */
  async lfsTrack(pattern: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['lfs', 'track', pattern]);
  }

  /** LFS 取消追踪 */
  async lfsUntrack(pattern: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['lfs', 'untrack', pattern]);
  }

  /** LFS 锁定文件 */
  async lfsLock(filePath: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['lfs', 'lock', filePath]);
  }

  /** LFS 解锁文件 */
  async lfsUnlock(filePath: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['lfs', 'unlock', filePath]);
  }

  /** LFS 拉取 */
  async lfsPull(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['lfs', 'pull']);
  }

  /** LFS 推送 */
  async lfsPush(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['lfs', 'push', '--all', 'origin']);
  }

  /** LFS 清理 */
  async lfsPrune(): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['lfs', 'prune']);
  }

  // ========== 交互式变基 ==========

  /** 获取变基操作列表 */
  async getRebaseActions(onto: string): Promise<Array<{ action: string; oid: string; message: string }>> {
    if (!this.dir) return [];
    try {
      const { stdout } = await this.gitCliExec(['log', '--oneline', onto + '..HEAD']);
      return stdout.trim().split('\n').filter(Boolean).map(line => {
        const [oid, ...msgParts] = line.split(' ');
        return { action: 'pick', oid, message: msgParts.join(' ') };
      });
    } catch {
      return [];
    }
  }

  /** 执行变基计划 */
  async executeRebasePlan(plan: Array<{ action: string; oid: string }>, onto: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    const todo = plan.map(p => p.action + ' ' + p.oid).join('\n');
    await this.gitCliExec(['rebase', '--onto', onto, '--interactive'], undefined, todo);
  }

  /** 交互式变基 */
  async rebaseInteractive(onto: string, todoContent?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['rebase', '-i', onto], undefined, todoContent);
  }

  // ========== Worktree 工作树 ==========

  /** 列出工作树 */
  async listWorktrees(): Promise<Array<{ path: string; branch: string; isMain: boolean }>> {
    if (!this.dir) return [];
    try {
      const { stdout } = await this.gitCliExec(['worktree', 'list', '--porcelain']);
      const worktrees: Array<{ path: string; branch: string; isMain: boolean }> = [];
      let current: Partial<{ path: string; branch: string; isMain: boolean }> = {};
      for (const line of stdout.split('\n')) {
        if (line.startsWith('worktree ')) {
          if (current.path) worktrees.push(current as any);
          current = { path: line.substring(9), isMain: worktrees.length === 0 };
        } else if (line.startsWith('branch ')) {
          current.branch = line.substring(7).replace('refs/heads/', '');
        }
      }
      if (current.path) worktrees.push(current as any);
      return worktrees;
    } catch {
      return [];
    }
  }

  /** 创建工作树 */
  async createWorktree(path: string, ref: string, newBranch?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    const args = ['worktree', 'add', path];
    if (newBranch) args.push('-b', newBranch);
    args.push(ref);
    await this.gitCliExec(args);
  }

  /** 移除工作树 */
  async removeWorktree(path: string, force?: boolean): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    const args = ['worktree', 'remove', path];
    if (force) args.push('--force');
    await this.gitCliExec(args);
  }

  // ========== Patch 补丁 ==========

  /** 创建补丁 */
  async createPatch(oids: string[], outputPath?: string): Promise<string> {
    if (!this.dir) throw new Error('仓库未打开');
    const args = ['format-patch', '--stdout'];
    if (oids.length === 1) {
      args.push(oids[0] + '^..' + oids[0]);
    } else {
      args.push('-' + oids.length.toString());
    }
    const { stdout } = await this.gitCliExec(args);
    if (outputPath) {
      const fs = await import('fs/promises');
      await fs.writeFile(outputPath, stdout, 'utf-8');
    }
    return stdout;
  }

  /** 应用补丁 */
  async applyPatch(patchPath: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['am', patchPath]);
  }

  /** 应用补丁到暂存区（行级暂存用） */
  async applyPatchCached(patchPath: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['apply', '--cached', patchPath]);
  }

  /** 反向应用补丁（取消暂存行用） */
  async applyPatchReverse(patchPath: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['apply', '-R', '--cached', patchPath]);
  }

  /** 读取冲突文件内容 */
  async readConflictFile(filePath: string): Promise<string> {
    if (!this.dir) throw new Error('仓库未打开');
    const fs = await import('fs/promises');
    const path = await import('path');
    const fullPath = path.join(this.dir, filePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  /** 写入冲突文件内容 */
  async writeConflictFile(filePath: string, content: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    const fs = await import('fs/promises');
    const path = await import('path');
    const fullPath = path.join(this.dir, filePath);
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  /**
   * 获取选中代码的历史（Fork 标志性功能）
   * 支持两种模式：
   * - line-range: git log -L start,end:file 追踪行范围
   * - pickaxe: git log -S "code" -- file 搜索代码出现/消失的提交
   */
  async getCodeHistory(options: {
    filePath: string;
    startLine?: number;
    endLine?: number;
    codeSnippet?: string;
    mode: 'line-range' | 'pickaxe';
    maxCount?: number;
  }): Promise<Array<{
    oid: string;
    shortOid: string;
    message: string;
    authorName: string;
    authorEmail: string;
    authorTimestamp: number;
    changeType: 'added' | 'removed' | 'modified';
    diffSnippet: string;
  }>> {
    if (!this.dir) throw new Error('仓库未打开');
    
    const maxCount = options.maxCount || 50;
    let stdout: string;
    
    try {
      if (options.mode === 'line-range' && options.startLine && options.endLine) {
        // git log -L start,end:file — 追踪行范围变更历史
        stdout = await this.gitCliExec([
          'log', `--max-count=${maxCount}`,
          `--format=COMMIT_START%n%H%n%h%n%s%n%an%n%ae%n%at%nCOMMIT_END`,
          `-L`, `${options.startLine},${options.endLine}:${options.filePath}`,
        ]);
      } else if (options.mode === 'pickaxe' && options.codeSnippet) {
        // git log -S "code" -- file — pickaxe 搜索
        stdout = await this.gitCliExec([
          'log', `--max-count=${maxCount}`,
          `--format=COMMIT_START%n%H%n%h%n%s%n%an%n%ae%n%at%nCOMMIT_END`,
          '-S', options.codeSnippet,
          '--', options.filePath,
        ]);
      } else {
        return [];
      }
    } catch (error) {
      // git log -L 可能因为没有变更而返回非零
      console.warn('getCodeHistory error:', error);
      return [];
    }
    
    // 解析输出
    const entries: Array<{
      oid: string; shortOid: string; message: string;
      authorName: string; authorEmail: string; authorTimestamp: number;
      changeType: 'added' | 'removed' | 'modified'; diffSnippet: string;
    }> = [];
    
    const commitBlocks = stdout.split('COMMIT_START
').filter(b => b.trim());
    
    for (const block of commitBlocks) {
      const lines = block.split('
');
      if (lines.length < 7) continue;
      
      const oid = lines[0]?.trim();
      const shortOid = lines[1]?.trim();
      const message = lines[2]?.trim();
      const authorName = lines[3]?.trim();
      const authorEmail = lines[4]?.trim();
      const authorTimestamp = parseInt(lines[5]?.trim() || '0', 10);
      
      // 跳过 COMMIT_END 标记，剩余的是 diff
      const diffStart = lines.indexOf('COMMIT_END') + 1;
      const diffLines = lines.slice(diffStart);
      
      // 判断变更类型
      let changeType: 'added' | 'removed' | 'modified' = 'modified';
      const hasAdd = diffLines.some(l => l.startsWith('+') && !l.startsWith('+++'));
      const hasDel = diffLines.some(l => l.startsWith('-') && !l.startsWith('---'));
      if (hasAdd && !hasDel) changeType = 'added';
      else if (hasDel && !hasAdd) changeType = 'removed';
      
      const diffSnippet = diffLines.slice(0, 30).join('
');
      
      entries.push({
        oid, shortOid, message, authorName, authorEmail, authorTimestamp,
        changeType, diffSnippet,
      });
    }
    
    return entries;
  }

  /**
   * Blame 上一版本（Fork/GitKraken 功能）
   * 获取指定行所在提交的上一版本的 blame
   */
  async blamePreviousRevision(filePath: string, lineCommitOid: string): Promise<{
    filePath: string;
    lines: Array<{
      lineNumber: number;
      content: string;
      commit: string;
      shortCommit: string;
      author: string;
      authorEmail: string;
      date: number;
      commitMessage: string;
    }>;
    authors: string[];
    dateRange: { oldest: number; newest: number };
  } | null> {
    if (!this.dir) throw new Error('仓库未打开');
    
    try {
      // git blame commit^ -- file — 对该提交的上一版本做 blame
      const stdout = await this.gitCliExec([
        'blame', `${lineCommitOid}^`, '--porcelain', '--', filePath,
      ]);
      
      return this.parseBlameOutput(stdout, filePath);
    } catch (error) {
      console.warn('blamePreviousRevision failed:', error);
      return null;
    }
  }

  /**
   * 解析 git blame --porcelain 输出
   */
  private parseBlameOutput(stdout: string, filePath: string): {
    filePath: string;
    lines: Array<{
      lineNumber: number;
      content: string;
      commit: string;
      shortCommit: string;
      author: string;
      authorEmail: string;
      date: number;
      commitMessage: string;
    }>;
    authors: string[];
    dateRange: { oldest: number; newest: number };
  } {
    const lines = stdout.split('
');
    const blameLines: Array<{
      lineNumber: number;
      content: string;
      commit: string;
      shortCommit: string;
      author: string;
      authorEmail: string;
      date: number;
      commitMessage: string;
    }> = [];
    
    // 简化解析：提取每个 blame 行的关键信息
    let currentCommit = '';
    let currentAuthor = '';
    let currentEmail = '';
    let currentDate = 0;
    let currentMessage = '';
    let lineNumber = 0;
    const authorSet = new Set<string>();
    let oldestDate = Infinity;
    let newestDate = 0;
    
    for (const line of lines) {
      if (line.startsWith('author ')) currentAuthor = line.slice(7);
      else if (line.startsWith('author-mail ')) currentEmail = line.slice(12).replace(/[<>]/g, '');
      else if (line.startsWith('author-time ')) {
        currentDate = parseInt(line.slice(12), 10);
        if (currentDate > 0) {
          oldestDate = Math.min(oldestDate, currentDate);
          newestDate = Math.max(newestDate, currentDate);
        }
      }
      else if (line.startsWith('summary ')) currentMessage = line.slice(8);
      else if (line.startsWith('	')) {
        // 实际代码行
        lineNumber++;
        const shortOid = currentCommit.substring(0, 7);
        blameLines.push({
          lineNumber,
          content: line.slice(1),
          commit: currentCommit,
          shortCommit: shortOid,
          author: currentAuthor,
          authorEmail: currentEmail,
          date: currentDate,
          commitMessage: currentMessage,
        });
        authorSet.add(currentAuthor);
        // Reset for next line
        currentMessage = '';
      }
      else if (line.length >= 40 && /^[0-9a-f]{40}/.test(line)) {
        // 新的 commit SHA 行（blame 输出第一行格式: sha origLine resultLine [group]）
        currentCommit = line.substring(0, 40);
      }
    }
    
    return {
      filePath,
      lines: blameLines,
      authors: [...authorSet].sort(),
      dateRange: { oldest: oldestDate === Infinity ? 0 : oldestDate, newest: newestDate },
    };
  }

  /** 列出补丁 */
  async listPatches(): Promise<string[]> {
    if (!this.dir) return [];
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const patchDir = path.join(this.dir, '.git', 'patches');
      const files = await fs.readdir(patchDir);
      return files.filter(f => f.endsWith('.patch'));
    } catch {
      return [];
    }
  }

  // ========== 设置/偏好 ==========

  /** 获取偏好设置 */
  async getPreferences(): Promise<Record<string, any>> {
    if (!this.dir) return {};
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const prefsPath = path.join(this.dir, '.git', 'majie.json');
      const data = await fs.readFile(prefsPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  /** 保存偏好设置 */
  async savePreferences(prefs: Record<string, any>): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    const fs = await import('fs/promises');
    const path = await import('path');
    const prefsPath = path.join(this.dir, '.git', 'majie.json');
    let existing: Record<string, any> = {};
    try {
      const data = await fs.readFile(prefsPath, 'utf-8');
      existing = JSON.parse(data);
    } catch {}
    const merged = { ...existing, ...prefs };
    await fs.writeFile(prefsPath, JSON.stringify(merged, null, 2), 'utf-8');
  }

  // ========== 自定义操作 ==========

  /** 列出自定义操作 */
  async listCustomActions(): Promise<Array<{ id: string; name: string; command: string; workingDir?: string; shortcut?: string; filePattern?: string }>> {
    const prefs = await this.getPreferences();
    return prefs.customActions || [];
  }

  /** 保存自定义操作 */
  async saveCustomAction(action: { name: string; command: string; workingDir?: string; shortcut?: string; filePattern?: string }): Promise<string> {
    const prefs = await this.getPreferences();
    const actions = prefs.customActions || [];
    const id = 'action_' + Date.now();
    actions.push({ id, ...action });
    await this.savePreferences({ customActions: actions });
    return id;
  }

  /** 删除自定义操作 */
  async deleteCustomAction(id: string): Promise<void> {
    const prefs = await this.getPreferences();
    const actions = (prefs.customActions || []).filter((a: any) => a.id !== id);
    await this.savePreferences({ customActions: actions });
  }

  /** 执行自定义操作 */
  async executeCustomAction(id: string): Promise<{ success: boolean; output: string }> {
    const prefs = await this.getPreferences();
    const action = (prefs.customActions || []).find((a: any) => a.id === id);
    if (!action) throw new Error('自定义操作不存在');
    try {
      const { stdout } = await this.gitCliExec(action.command.split(' '), action.workingDir);
      return { success: true, output: stdout };
    } catch (error: any) {
      return { success: false, output: error.message || '执行失败' };
    }
  }

  // ========== 其他功能 ==========

  /** Blame 追踪 */
  async blame(filePath: string): Promise<Array<{ oid: string; line: number; author: string; date: string; content: string }>> {
    if (!this.dir) return [];
    try {
      const { stdout } = await this.gitCliExec(['blame', '--porcelain', filePath]);
      const results: Array<{ oid: string; line: number; author: string; date: string; content: string }> = [];
      let current: Partial<{ oid: string; line: number; author: string; date: string; content: string }> = {};
      for (const line of stdout.split('\n')) {
        const headerMatch = line.match(/^([0-9a-f]{40})\s+(\d+)\s+(\d+)/);
        if (headerMatch) {
          if (current.oid && current.line) results.push(current as any);
          current = { oid: headerMatch[1], line: parseInt(headerMatch[3]) };
        } else if (line.startsWith('author ')) {
          current.author = line.substring(7);
        } else if (line.startsWith('author-time ')) {
          current.date = new Date(parseInt(line.substring(12)) * 1000).toISOString();
        } else if (line.startsWith('\t')) {
          current.content = line.substring(1);
        }
      }
      if (current.oid && current.line) results.push(current as any);
      return results;
    } catch {
      return [];
    }
  }

  /** 重置到指定引用 */
  async resetTo(ref: string, mode: 'soft' | 'mixed' | 'hard'): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['reset', '--' + mode, ref]);
  }

  /** 获取提交中指定文件的差异 */
  async getFileDiff(oid: string, filePath: string): Promise<GitDiff[]> {
    if (!this.dir) return [];
    try {
      const { stdout } = await this.gitCliExec(['diff', oid + '^..' + oid, '--', filePath]);
      return parseDiffOutput(stdout);
    } catch {
      return [];
    }
  }

  /** 增强版文件历史 */
  async getFileHistoryEnhanced(filePath: string, options?: { maxCount?: number; skip?: number }): Promise<Array<{ oid: string; message: string; author: string; date: string; additions: number; deletions: number }>> {
    if (!this.dir) return [];
    try {
      const args = ['log', '--format=%H|%s|%an|%aI', '--numstat', '--', filePath];
      if (options?.maxCount) args.push('--max-count=' + options.maxCount.toString());
      if (options?.skip) args.push('--skip=' + options.skip.toString());
      const { stdout } = await this.gitCliExec(args);
      const results: Array<{ oid: string; message: string; author: string; date: string; additions: number; deletions: number }> = [];
      let current: Partial<typeof results[0]> | null = null;
      for (const line of stdout.split('\n')) {
        if (line.includes('|')) {
          if (current) results.push(current as any);
          const [oid, message, author, date] = line.split('|');
          current = { oid, message, author, date, additions: 0, deletions: 0 };
        } else if (current && line.trim()) {
          const parts = line.trim().split('\t');
          if (parts.length >= 2) {
            current.additions = (current.additions || 0) + (parseInt(parts[0]) || 0);
            current.deletions = (current.deletions || 0) + (parseInt(parts[1]) || 0);
          }
        }
      }
      if (current) results.push(current as any);
      return results;
    } catch {
      return [];
    }
  }

  /** 在外部 Diff 工具中打开 */
  async openInDiffTool(filePath: string, oldOid?: string, newOid?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['difftool', filePath]);
  }

  /** 获取仓库统计 */
  async getRepoStats(): Promise<{ totalCommits: number; totalAuthors: number; totalFiles: number; repoSize: string }> {
    if (!this.dir) return { totalCommits: 0, totalAuthors: 0, totalFiles: 0, repoSize: '0' };
    try {
      const { stdout: logOut } = await this.gitCliExec(['log', '--oneline']);
      const totalCommits = logOut.trim().split('\n').filter(Boolean).length;
      const { stdout: shortLog } = await this.gitCliExec(['shortlog', '-sn']);
      const totalAuthors = shortLog.trim().split('\n').filter(Boolean).length;
      const { stdout: lsOut } = await this.gitCliExec(['ls-files']);
      const totalFiles = lsOut.trim().split('\n').filter(Boolean).length;
      return { totalCommits, totalAuthors, totalFiles, repoSize: 'N/A' };
    } catch {
      return { totalCommits: 0, totalAuthors: 0, totalFiles: 0, repoSize: '0' };
    }
  }

  /** 获取 Pull Requests（Gitee/GitHub） */
  async getPullRequests(remote?: string): Promise<Array<{ id: number; title: string; state: string; url: string }>> {
    // 需要集成 Gitee/GitHub API，暂返回空
    return [];
  }

  /** 验证提交签名 */
  async verifyCommitSignature(oid: string): Promise<{ verified: boolean; key: string; signer: string }> {
    if (!this.dir) return { verified: false, key: '', signer: '' };
    try {
      const { stdout } = await this.gitCliExec(['verify-commit', '--raw', oid]);
      return { verified: stdout.includes('GOODSIG'), key: '', signer: '' };
    } catch {
      return { verified: false, key: '', signer: '' };
    }
  }

  /** 删除未追踪文件 */
  async deleteUntrackedFile(filePath: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    const fs = await import('fs/promises');
    const path = await import('path');
    await fs.rm(path.join(this.dir, filePath), { recursive: true, force: true });
  }

  /** 丢弃文件修改 */
  async discardChanges(filePath: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['checkout', '--', filePath]);
  }

  /** 获取提交模板 */
  async getCommitTemplate(): Promise<string> {
    if (!this.dir) return '';
    try {
      const { stdout } = await this.gitCliExec(['config', 'commit.template']);
      if (stdout.trim()) {
        const fs = await import('fs/promises');
        return await fs.readFile(stdout.trim(), 'utf-8');
      }
    } catch {}
    return '';
  }

  /** 推送标签 */
  async pushTag(name: string, remote?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['push', remote || 'origin', name]);
  }

  /** 推送所有标签 */
  async pushAllTags(remote?: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['push', remote || 'origin', '--tags']);
  }

  /** 增强版子模块列表 */
  async listSubmodulesEnhanced(): Promise<Array<{ name: string; path: string; url: string; branch: string; status: string }>> {
    if (!this.dir) return [];
    try {
      const { stdout } = await this.gitCliExec(['submodule', 'status', '--recursive']);
      const results: Array<{ name: string; path: string; url: string; branch: string; status: string }> = [];
      for (const line of stdout.trim().split('\n').filter(Boolean)) {
        const match = line.match(/^[+\-U ]([0-9a-f]+)\s+(\S+)/);
        if (match) {
          const prefix = line[0];
          const status = prefix === '+' ? 'modified' : prefix === '-' ? 'not initialized' : prefix === 'U' ? 'conflict' : 'clean';
          results.push({ name: match[2].split('/').pop() || match[2], path: match[2], url: '', branch: '', status });
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  /** 同步子模块 */
  async syncSubmodule(subPath: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['submodule', 'sync', '--', subPath]);
  }

  // ========== P1-8: 陈旧分支（已合并分支查询） ==========

  /** 获取已合并到指定分支的分支列表 */
  async getMergedBranches(targetBranch?: string): Promise<Array<{ name: string; isRemote: boolean; lastCommitDate: string; lastCommitMsg: string }>> {
    if (!this.dir) return [];
    try {
      const args = ['branch', '--merged', targetBranch || 'HEAD', '--format=%(refname:short)|%(upstream:short)|%(committerdate:short)|%(subject)'];
      const { stdout } = await this.gitCliExec(args);
      const currentBranch = await git.currentBranch({ fs: isoFs, dir: this.dir, fullname: false }) || '';
      const lines = stdout.trim().split('\n').filter(Boolean);
      const result: Array<{ name: string; isRemote: boolean; lastCommitDate: string; lastCommitMsg: string }> = [];
      for (const line of lines) {
        const [name, upstream, date, msg] = line.split('|');
        if (!name || name === currentBranch || name === 'master' || name === 'main' || name === 'develop') continue;
        const isRemote = name.includes('/');
        result.push({ name, isRemote, lastCommitDate: date || '', lastCommitMsg: (msg || '').substring(0, 60) });
      }
      return result;
    } catch {
      return [];
    }
  }

  /** 批量删除分支 */
  async batchDeleteBranches(names: string[], force = false): Promise<Array<{ name: string; success: boolean; error?: string }>> {
    if (!this.dir) return [];
    const results: Array<{ name: string; success: boolean; error?: string }> = [];
    for (const name of names) {
      try {
        if (name.includes('/')) {
          // 远程分支：git push origin --delete <branch>
          const parts = name.split('/');
          const remote = parts[0];
          const branch = parts.slice(1).join('/');
          await this.gitCliExec(['push', remote, '--delete', branch]);
        } else {
          await this.gitCliExec(['branch', force ? '-D' : '-d', name]);
        }
        results.push({ name, success: true });
      } catch (e: any) {
        results.push({ name, success: false, error: e.message || '删除失败' });
      }
    }
    return results;
  }

  // ========== P1-7: Git Flow ==========

  /** 初始化 Git Flow（创建 develop 分支和基础配置） */
  async gitflowInit(options?: { masterBranch?: string; developBranch?: string; featurePrefix?: string; releasePrefix?: string; hotfixPrefix?: string; versionTagPrefix?: string }): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    const master = options?.masterBranch || 'main';
    const develop = options?.developBranch || 'develop';
    const featurePrefix = options?.featurePrefix || 'feature/';
    const releasePrefix = options?.releasePrefix || 'release/';
    const hotfixPrefix = options?.hotfixPrefix || 'hotfix/';
    const tagPrefix = options?.versionTagPrefix || '';

    // 保存 Git Flow 配置
    const prefs: Record<string, string> = {
      'gitflow.branch.master': master,
      'gitflow.branch.develop': develop,
      'gitflow.prefix.feature': featurePrefix,
      'gitflow.prefix.release': releasePrefix,
      'gitflow.prefix.hotfix': hotfixPrefix,
      'gitflow.prefix.versiontag': tagPrefix,
      'gitflow.initialized': 'true',
    };
    for (const [key, value] of Object.entries(prefs)) {
      try { await this.gitCliExec(['config', key, value]); } catch {}
    }
    // 确保 develop 分支存在
    try {
      const branches = await git.listBranches({ fs: isoFs, dir: this.dir });
      if (!branches.includes(develop)) {
        await this.gitCliExec(['branch', develop]);
      }
    } catch {}
  }

  /** 检查 Git Flow 是否已初始化 */
  async gitflowIsInitialized(): Promise<boolean> {
    if (!this.dir) return false;
    try {
      const { stdout } = await this.gitCliExec(['config', 'gitflow.initialized']);
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  /** 开始 Feature 分支 */
  async gitflowStartFeature(name: string, base?: string): Promise<string> {
    if (!this.dir) throw new Error('仓库未打开');
    let prefix = 'feature/';
    try { const { stdout } = await this.gitCliExec(['config', 'gitflow.prefix.feature']); prefix = stdout.trim() || 'feature/'; } catch {}
    const branchName = name.startsWith(prefix) ? name : prefix + name;
    const startPoint = base || 'develop';
    await this.gitCliExec(['checkout', '-b', branchName, startPoint]);
    return branchName;
  }

  /** 完成 Feature 分支（合并回 develop） */
  async gitflowFinishFeature(name: string, options?: { noFf?: boolean; squash?: boolean; deleteBranch?: boolean }): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    let prefix = 'feature/';
    try { const { stdout } = await this.gitCliExec(['config', 'gitflow.prefix.feature']); prefix = stdout.trim() || 'feature/'; } catch {}
    let develop = 'develop';
    try { const { stdout } = await this.gitCliExec(['config', 'gitflow.branch.develop']); develop = stdout.trim() || 'develop'; } catch {}

    const branchName = name.startsWith(prefix) ? name : prefix + name;
    // 切换到 develop
    await this.gitCliExec(['checkout', develop]);
    // 合并
    const mergeArgs = ['merge'];
    if (options?.noFf !== false) mergeArgs.push('--no-ff');
    if (options?.squash) mergeArgs.push('--squash');
    mergeArgs.push(branchName);
    await this.gitCliExec(mergeArgs);
    // 删除分支
    if (options?.deleteBranch !== false) {
      await this.gitCliExec(['branch', '-d', branchName]);
    }
  }

  /** 开始 Release 分支 */
  async gitflowStartRelease(version: string): Promise<string> {
    if (!this.dir) throw new Error('仓库未打开');
    let prefix = 'release/';
    try { const { stdout } = await this.gitCliExec(['config', 'gitflow.prefix.release']); prefix = stdout.trim() || 'release/'; } catch {}
    const branchName = version.startsWith(prefix) ? version : prefix + version;
    let develop = 'develop';
    try { const { stdout } = await this.gitCliExec(['config', 'gitflow.branch.develop']); develop = stdout.trim() || 'develop'; } catch {}
    await this.gitCliExec(['checkout', '-b', branchName, develop]);
    return branchName;
  }

  /** 完成 Release 分支（合并到 main + develop，打标签） */
  async gitflowFinishRelease(version: string, options?: { tagMessage?: string; deleteBranch?: boolean }): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    let prefix = 'release/';
    try { const { stdout } = await this.gitCliExec(['config', 'gitflow.prefix.release']); prefix = stdout.trim() || 'release/'; } catch {}
    let master = 'main';
    try { const { stdout } = await this.gitCliExec(['config', 'gitflow.branch.master']); master = stdout.trim() || 'main'; } catch {}
    let develop = 'develop';
    try { const { stdout } = await this.gitCliExec(['config', 'gitflow.branch.develop']); develop = stdout.trim() || 'develop'; } catch {}

    const branchName = version.startsWith(prefix) ? version : prefix + version;
    // 合并到 master/main
    await this.gitCliExec(['checkout', master]);
    await this.gitCliExec(['merge', '--no-ff', branchName]);
    // 打标签
    const tagMsg = options?.tagMessage || `Release ${version}`;
    await this.gitCliExec(['tag', '-a', version, '-m', tagMsg]);
    // 合并回 develop
    await this.gitCliExec(['checkout', develop]);
    await this.gitCliExec(['merge', '--no-ff', branchName]);
    // 删除分支
    if (options?.deleteBranch !== false) {
      await this.gitCliExec(['branch', '-d', branchName]);
    }
  }

  /** 开始 Hotfix 分支 */
  async gitflowStartHotfix(version: string): Promise<string> {
    if (!this.dir) throw new Error('仓库未打开');
    let prefix = 'hotfix/';
    try { const { stdout } = await this.gitCliExec(['config', 'gitflow.prefix.hotfix']); prefix = stdout.trim() || 'hotfix/'; } catch {}
    let master = 'main';
    try { const { stdout } = await this.gitCliExec(['config', 'gitflow.branch.master']); master = stdout.trim() || 'main'; } catch {}
    const branchName = version.startsWith(prefix) ? version : prefix + version;
    await this.gitCliExec(['checkout', '-b', branchName, master]);
    return branchName;
  }

  /** 完成 Hotfix 分支（合并到 main + develop，打标签） */
  async gitflowFinishHotfix(version: string, options?: { tagMessage?: string; deleteBranch?: boolean }): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    let prefix = 'hotfix/';
    try { const { stdout } = await this.gitCliExec(['config', 'gitflow.prefix.hotfix']); prefix = stdout.trim() || 'hotfix/'; } catch {}
    let master = 'main';
    try { const { stdout } = await this.gitCliExec(['config', 'gitflow.branch.master']); master = stdout.trim() || 'main'; } catch {}
    let develop = 'develop';
    try { const { stdout } = await this.gitCliExec(['config', 'gitflow.branch.develop']); develop = stdout.trim() || 'develop'; } catch {}

    const branchName = version.startsWith(prefix) ? version : prefix + version;
    await this.gitCliExec(['checkout', master]);
    await this.gitCliExec(['merge', '--no-ff', branchName]);
    const tagMsg = options?.tagMessage || `Hotfix ${version}`;
    await this.gitCliExec(['tag', '-a', version, '-m', tagMsg]);
    await this.gitCliExec(['checkout', develop]);
    await this.gitCliExec(['merge', '--no-ff', branchName]);
    if (options?.deleteBranch !== false) {
      await this.gitCliExec(['branch', '-d', branchName]);
    }
  }

  /** 获取 Git Flow 配置 */
  async gitflowGetConfig(): Promise<Record<string, string>> {
    if (!this.dir) return {};
    const keys = ['gitflow.branch.master', 'gitflow.branch.develop', 'gitflow.prefix.feature', 'gitflow.prefix.release', 'gitflow.prefix.hotfix', 'gitflow.prefix.versiontag', 'gitflow.initialized'];
    const config: Record<string, string> = {};
    for (const key of keys) {
      try {
        const { stdout } = await this.gitCliExec(['config', key]);
        config[key] = stdout.trim();
      } catch {
        config[key] = '';
      }
    }
    return config;
  }

  // ========== P1-9: 外部 Diff/Merge 工具 ==========

  /** 在外部 Merge 工具中打开 */
  async openInMergeTool(filePath: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['mergetool', filePath]);
  }

  /** 获取 diff 工具配置 */
  async getDiffToolConfig(): Promise<{ tool: string; available: string[] }> {
    if (!this.dir) return { tool: '', available: [] };
    try {
      const { stdout } = await this.gitCliExec(['config', 'diff.guitool']);
      const tool = stdout.trim();
      // 尝试列出已知工具
      const known = ['vscode', 'code', 'bcompare', 'beyondcompare4', 'meld', 'kdiff3', 'p4merge', 'diffmerge', 'tkdiff', 'xxdiff', 'araxis', 'vimdiff'];
      return { tool, available: known };
    } catch {
      return { tool: '', available: [] };
    }
  }

  /** 设置 diff 工具 */
  async setDiffTool(tool: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['config', 'diff.guitool', tool]);
    // 同时设置 difftool.<tool>.cmd（如果是 vscode/code）
    if (tool === 'vscode' || tool === 'code') {
      await this.gitCliExec(['config', 'difftool.vscode.cmd', 'code --wait --diff $LOCAL $REMOTE']);
      await this.gitCliExec(['config', 'difftool.code.cmd', 'code --wait --diff $LOCAL $REMOTE']);
    }
  }

  /** 获取 merge 工具配置 */
  async getMergeToolConfig(): Promise<{ tool: string; available: string[] }> {
    if (!this.dir) return { tool: '', available: [] };
    try {
      const { stdout } = await this.gitCliExec(['config', 'merge.tool']);
      const tool = stdout.trim();
      const known = ['vscode', 'code', 'bcompare', 'beyondcompare4', 'meld', 'kdiff3', 'p4merge', 'diffmerge', 'tortoisemerge', 'araxis'];
      return { tool, available: known };
    } catch {
      return { tool: '', available: [] };
    }
  }

  /** 设置 merge 工具 */
  async setMergeTool(tool: string): Promise<void> {
    if (!this.dir) throw new Error('仓库未打开');
    await this.gitCliExec(['config', 'merge.tool', tool]);
    if (tool === 'vscode' || tool === 'code') {
      await this.gitCliExec(['config', 'mergetool.vscode.cmd', 'code --wait $MERGED']);
      await this.gitCliExec(['config', 'mergetool.code.cmd', 'code --wait $MERGED']);
    }
  }

  // ========== P1-6: GitHub 通知 ==========

  /** 获取 GitHub 通知（通过 GitHub API） */
  async getGitHubNotifications(token: string): Promise<Array<{ id: string; subject: { title: string; type: string; url: string }; repository: { name: string; full_name: string }; reason: string; updated_at: string; unread: boolean }>> {
    try {
      const https = require('https');
      return await new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.github.com',
          path: '/notifications',
          method: 'GET',
          headers: {
            'Authorization': `token ${token}`,
            'User-Agent': 'Majie-Git-Client',
            'Accept': 'application/vnd.github.v3+json',
          },
        };
        const req = https.request(options, (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => { data += chunk; });
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch { resolve([]); }
          });
        });
        req.on('error', () => resolve([]));
        req.setTimeout(10000, () => { req.destroy(); resolve([]); });
        req.end();
      });
    } catch {
      return [];
    }
  }

  // ========== P2: 增强功能 ==========

  /** P2-5: Rebase with --update-refs */
  async rebaseWithUpdateRefs(onto: string, updateRefs: boolean): Promise<{ success: boolean; conflicts?: boolean; message?: string }> {
    if (!this.dir) throw new Error('仓库未打开');
    const args = ['rebase', onto];
    if (updateRefs) args.push('--update-refs');
    try {
      await this.gitCliExec(args);
      return { success: true };
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('conflict')) {
        return { success: false, conflicts: true, message: 'Rebase 产生冲突，请手动解决' };
      }
      return { success: false, message: msg };
    }
  }

  /** P2-6: 从剪贴板内容应用 Patch */
  async applyPatchFromContent(patchContent: string, options?: { check?: boolean; cached?: boolean; reject?: boolean }): Promise<{ success: boolean; message?: string }> {
    if (!this.dir) throw new Error('仓库未打开');
    try {
      const fs = require('fs/promises');
      const tmpPath = require('path').join(require('os').tmpdir(), `majie-paste-patch-${Date.now()}.patch`);
      await fs.writeFile(tmpPath, patchContent, 'utf-8');
      const args = ['apply'];
      if (options?.check) args.push('--check');
      if (options?.cached) args.push('--cached');
      if (options?.reject) args.push('--reject');
      args.push(tmpPath);
      await this.gitCliExec(args);
      // 清理临时文件
      try { await fs.unlink(tmpPath); } catch {}
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message || 'Patch 应用失败' };
    }
  }

  /** P2-7: 仓库磁盘占用统计 */
  async getRepoDiskUsage(): Promise<{ totalSize: number; entries: Array<{ path: string; size: number; type: 'file' | 'dir'; extension?: string }> }> {
    if (!this.dir) throw new Error('仓库未打开');
    try {
      const { stdout } = await this.gitCliExec(['ls-files']);
      const files = stdout.trim().split('\n').filter(Boolean);
      const entries: Array<{ path: string; size: number; type: 'file'; extension?: string }> = [];
      let totalSize = 0;
      for (const file of files) {
        try {
          const stat = await fs.stat(require('path').join(this.dir!, file));
          totalSize += stat.size;
          const ext = file.split('.').pop()?.toLowerCase() || '';
          entries.push({ path: file, size: stat.size, type: 'file', extension: ext });
        } catch { /* skip */ }
      }
      // 按大小降序
      entries.sort((a, b) => b.size - a.size);
      return { totalSize, entries };
    } catch {
      return { totalSize: 0, entries: [] };
    }
  }

  /** P2-8: 操作活动日志 */
  private activityLog: Array<{ id: string; action: string; detail: string; timestamp: number; status: 'running' | 'success' | 'failed' }> = [];

  logActivity(action: string, detail: string, status: 'running' | 'success' | 'failed' = 'running'): string {
    const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.activityLog.unshift({ id, action, detail, timestamp: Date.now(), status });
    // 最多保留 200 条
    if (this.activityLog.length > 200) this.activityLog = this.activityLog.slice(0, 200);
    return id;
  }

  updateActivity(id: string, status: 'success' | 'failed', detail?: string): void {
    const act = this.activityLog.find(a => a.id === id);
    if (act) {
      act.status = status;
      if (detail) act.detail = detail;
    }
  }

  getActivityLog(limit?: number): Array<{ id: string; action: string; detail: string; timestamp: number; status: string }> {
    return (limit ? this.activityLog.slice(0, limit) : this.activityLog).map(a => ({ ...a }));
  }

  clearActivityLog(): void {
    this.activityLog = [];
  }

  /** P2-10: 部分 Stash (git stash push -p) */
  async stashPartial(options?: { message?: string }): Promise<{ success: boolean; message?: string }> {
    if (!this.dir) throw new Error('仓库未打开');
    try {
      const args = ['stash', 'push', '-p'];
      if (options?.message) args.push('-m', options.message);
      const { stdout } = await this.gitCliExecWithInput(args, '');
      return { success: true, message: stdout.trim() };
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('did not save')) {
        return { success: false, message: '没有选择任何更改，Stash 未保存' };
      }
      return { success: false, message: msg };
    }
  }

  /** 辅助：带 stdin 输入的 git CLI 执行（用于 -p 交互式命令，自动回复 'a' 全选） */
  private async gitCliExecWithInput(args: string[], input: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = require('child_process').spawn('git', args, {
        cwd: this.dir || undefined,
        env: { ...process.env, GIT_EDITOR: 'true', GIT_TERMINAL_PROMPT: '0', LANG: 'C' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '', stderr = '';
      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      // 对 -p 交互式，自动发送 'a' (apply all) 然后 'q' (quit)
      proc.stdin.write('a\nq\n');
      proc.stdin.end();
      proc.on('close', (code: number) => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(stderr || `git ${args.join(' ')} failed with code ${code}`));
      });
      proc.on('error', (err: Error) => reject(err));
    });
  }

}


// 导出单例
const gitService = new GitService();
export { gitService };
