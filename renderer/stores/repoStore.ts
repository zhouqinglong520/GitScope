/**
 * 仓库状态管理
 * 使用 Zustand 管理 Git 仓库相关的全局状态
 * 支持多仓库 Tab
 */

import { create } from 'zustand';
import type { 
  RepositoryInfo, 
  GitCommit, 
  GitBranch, 
  GitStatus, 
  GitTag,
  FileCommitHistory,
  AuthorStats,
  CommitFilter,
  CommitDetail,
  GitStashEntry
} from '../../shared/types/git';

// 导出类型供其他组件使用
export type { GitCommit, GitBranch };

// 仓库信息扩展（包含 ID）
export interface RepoTab {
  id: string;
  path: string;
  name: string;
  currentBranch: string | null;
  isActive: boolean;
}

// Stash 信息
export interface StashInfo {
  id: string;
  message: string;
  date?: string;
}

// 仓库状态接口
interface RepoState {
  /** 仓库 Tab 列表 */
  repos: RepoTab[];
  /** 当前活动的仓库 ID */
  activeRepoId: string | null;
  /** 当前仓库信息 */
  currentRepo: RepositoryInfo | null;
  /** 提交历史 */
  commits: GitCommit[];
  /** 筛选后的提交历史 */
  filteredCommits: GitCommit[];
  /** 分支列表 */
  branches: GitBranch[];
  /** 当前分支 */
  currentBranch: GitBranch | null;
  /** 仓库状态 */
  status: GitStatus | null;
  /** 标签列表 */
  tags: GitTag[];
  /** Stash 列表 */
  stashes: StashInfo[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 最近打开的仓库列表 */
  recentRepos: string[];
  /** 侧边栏是否折叠 */
  sidebarCollapsed: boolean;
  
  // ========== 新增状态 ==========
  /** 文件历史 */
  fileHistory: FileCommitHistory | null;
  /** 文件历史弹窗是否显示 */
  showFileHistory: boolean;
  /** 提交筛选条件 */
  commitFilter: CommitFilter;
  /** 作者统计列表 */
  authorStats: AuthorStats[];
  /** 当前选中提交的详细信息（包含文件列表） */
  selectedCommitDetail: CommitDetail | null;
  /** 是否显示提交详情面板 */
  showCommitDetail: boolean;
  /** 本地领先远程的提交数 */
  ahead: number;
  /** 远程领先本地的提交数 */
  behind: number;
  /** 是否有更多提交可加载（增量加载） */
  hasMoreCommits: boolean;
  /** 是否正在加载更多提交 */
  isLoadingMore: boolean;

  // 多仓库 Tab Actions
  /** 设置活动仓库 */
  setActiveRepo: (repoId: string) => void;
  /** 添加仓库 Tab */
  addRepoTab: (repo: RepoTab) => void;
  /** 关闭仓库 Tab */
  closeRepo: (repoId: string) => void;
  /** 更新仓库 Tab 信息 */
  updateRepoTab: (repoId: string, updates: Partial<RepoTab>) => void;

  // 数据设置 Actions
  /** 设置当前仓库 */
  setCurrentRepo: (repo: RepositoryInfo | null) => void;
  /** 设置提交历史 */
  setCommits: (commits: GitCommit[]) => void;
  /** 添加提交历史 */
  addCommits: (commits: GitCommit[]) => void;
  /** 设置分支列表 */
  setBranches: (branches: GitBranch[]) => void;
  /** 设置当前分支 */
  setCurrentBranch: (branch: GitBranch | null) => void;
  /** 设置仓库状态 */
  setStatus: (status: GitStatus | null) => void;
  /** 设置标签列表 */
  setTags: (tags: GitTag[]) => void;
  /** 设置 Stash 列表 */
  setStashes: (stashes: StashInfo[]) => void;
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void;
  /** 设置错误信息 */
  setError: (error: string | null) => void;
  /** 切换侧边栏 */
  toggleSidebar: () => void;

  // ========== 新增 Actions ==========
  /** 设置文件历史 */
  setFileHistory: (history: FileCommitHistory | null) => void;
  /** 设置文件历史弹窗显示状态 */
  setShowFileHistory: (show: boolean) => void;
  /** 设置提交筛选条件 */
  setCommitFilter: (filter: CommitFilter) => void;
  /** 更新筛选条件（部分更新） */
  updateCommitFilter: (filter: Partial<CommitFilter>) => void;
  /** 清除筛选条件 */
  clearCommitFilter: () => void;
  /** 设置作者统计 */
  setAuthorStats: (stats: AuthorStats[]) => void;
  /** 设置选中提交详情 */
  setSelectedCommitDetail: (detail: CommitDetail | null) => void;
  /** 设置显示提交详情面板 */
  setShowCommitDetail: (show: boolean) => void;

  // 文件历史 Actions
  /** 获取文件提交历史 */
  getFileHistory: (filePath: string) => Promise<void>;
  /** 获取提交详情（含文件列表） */
  getCommitDetail: (oid: string) => Promise<void>;
  /** 获取作者统计 */
  fetchAuthorStats: () => Promise<void>;
  /** 筛选提交 */
  filterCommits: () => void;

  // 仓库操作 Actions
  /** 添加到最近仓库 */
  addRecentRepo: (path: string) => void;
  /** 加载仓库数据 */
  loadRepoData: (path: string) => Promise<void>;
  /** 打开仓库 */
  openRepo: (path: string) => Promise<void>;
  /** 刷新状态 */
  refresh: () => Promise<void>;
  /** 暂存文件 */
  stageFile: (path: string) => Promise<void>;
  /** 取消暂存 */
  unstageFile: (path: string) => Promise<void>;
  /** 暂存所有 */
  stageAll: () => Promise<void>;
  /** 取消暂存所有 */
  unstageAll: () => Promise<void>;
  /** 重置状态 */
  reset: () => void;
  /** 加载更多提交（增量加载） */
  loadMoreCommits: () => Promise<void>;
  /** 设置文件监听器（SourceGit 模式） */
  setupWatcher: () => void;
}

/** 默认状态 */
const initialState = {
  repos: [],
  activeRepoId: null,
  currentRepo: null,
  commits: [],
  filteredCommits: [],
  branches: [],
  currentBranch: null,
  status: null,
  tags: [],
  stashes: [],
  isLoading: false,
  error: null,
  recentRepos: [],
  sidebarCollapsed: false,
  // 新增默认值
  fileHistory: null,
  showFileHistory: false,
  commitFilter: {},
  authorStats: [],
  selectedCommitDetail: null,
  showCommitDetail: false,
  ahead: 0,
  behind: 0,
  hasMoreCommits: true,
  isLoadingMore: false,
};

/** 每个仓库的数据缓存（切换 Tab 时保留） */
interface RepoCacheEntry {
  commits: GitCommit[];
  filteredCommits: GitCommit[];
  branches: GitBranch[];
  currentBranch: GitBranch | null;
  status: GitStatus | null;
  tags: GitTag[];
  stashes: { id: string; message: string; date?: string }[];
  authorStats: AuthorStats[];
  ahead: number;
  behind: number;
  hasMoreCommits: boolean;
  timestamp: number; // 缓存时间戳
}
const repoDataCache = new Map<string, RepoCacheEntry>();

/**
 * 仓库状态管理 Hook
 */
export const useRepoStore = create<RepoState>((set, get) => ({
  ...initialState,

  // 多仓库 Tab Actions
  setActiveRepo: (repoId) => {
    const currentState = get();

    // 保存当前仓库数据到缓存
    if (currentState.activeRepoId && currentState.currentRepo) {
      repoDataCache.set(currentState.activeRepoId, {
        commits: currentState.commits,
        filteredCommits: currentState.filteredCommits,
        branches: currentState.branches,
        currentBranch: currentState.currentBranch,
        status: currentState.status,
        tags: currentState.tags,
        stashes: currentState.stashes,
        authorStats: currentState.authorStats,
        ahead: currentState.ahead,
        behind: currentState.behind,
        hasMoreCommits: currentState.hasMoreCommits,
        timestamp: Date.now(),
      });
    }

    set((state) => ({
      repos: state.repos.map((r) => ({
        ...r,
        isActive: r.id === repoId,
      })),
      activeRepoId: repoId,
    }));

    // 加载该仓库的数据
    const repo = get().repos.find((r) => r.id === repoId);
    if (repo) {
      // 先从缓存恢复（立即显示），然后后台刷新
      const cached = repoDataCache.get(repoId);
      if (cached) {
        const newCurrentBranch = cached.currentBranch;
        set({
          commits: cached.commits,
          filteredCommits: cached.filteredCommits,
          branches: cached.branches,
          currentBranch: cached.currentBranch,
          status: cached.status,
          tags: cached.tags,
          stashes: cached.stashes,
          authorStats: cached.authorStats,
          ahead: cached.ahead,
          behind: cached.behind,
          hasMoreCommits: cached.hasMoreCommits,
          currentRepo: {
            path: repo.path,
            name: repo.name,
            currentBranch: newCurrentBranch?.name || null,
            isGitRepo: true,
            remotes: [],
          },
          // 清除前一个仓库的选中状态
          selectedCommitDetail: null,
          showCommitDetail: false,
          fileHistory: null,
          showFileHistory: false,
        });
      }
      // 后台刷新获取最新数据（先切换后端仓库指向，再加载数据）
      window.electronAPI.git.openRepository(repo.path).then(() => {
        get().loadRepoData(repo.path);
      }).catch((err: unknown) => {
        console.error('[Store] 切换仓库失败:', err);
      });
    }
  },

  addRepoTab: (repo) => {
    set((state) => ({
      repos: [...state.repos, repo],
      activeRepoId: repo.id,
      currentRepo: {
        path: repo.path,
        name: repo.name,
        currentBranch: repo.currentBranch,
        isGitRepo: true,
        remotes: [],
      },
    }));
  },

  closeRepo: (repoId) => {
    // 清除该仓库的缓存
    repoDataCache.delete(repoId);

    set((state) => {
      const index = state.repos.findIndex((r) => r.id === repoId);
      const newRepos = state.repos.filter((r) => r.id !== repoId);

      let newActiveRepoId = state.activeRepoId;
      let newCurrentRepo = state.currentRepo;

      // 如果关闭的是当前活动仓库
      if (state.activeRepoId === repoId) {
        if (newRepos.length > 0) {
          // 激活前一个或后一个仓库
          const newIndex = Math.max(0, index - 1);
          newActiveRepoId = newRepos[newIndex].id;
          newCurrentRepo = {
            path: newRepos[newIndex].path,
            name: newRepos[newIndex].name,
            currentBranch: newRepos[newIndex].currentBranch,
            isGitRepo: true,
            remotes: [],
          };
        } else {
          newActiveRepoId = null;
          newCurrentRepo = null;
        }
      }

      return {
        repos: newRepos,
        activeRepoId: newActiveRepoId,
        currentRepo: newCurrentRepo,
      };
    });
  },

  updateRepoTab: (repoId, updates) => {
    set((state) => ({
      repos: state.repos.map((r) =>
        r.id === repoId ? { ...r, ...updates } : r
      ),
      currentRepo: state.activeRepoId === repoId
        ? state.currentRepo ? { ...state.currentRepo, ...updates } : null
        : state.currentRepo,
    }));
  },

  setCurrentRepo: (repo) => set({ currentRepo: repo }),

  setCommits: (commits) => {
    set({ commits });
    // 自动触发筛选
    get().filterCommits();
  },

  addCommits: (commits) => {
    set((state) => ({
      commits: [...state.commits, ...commits],
    }));
    get().filterCommits();
  },

  setBranches: (branches) => {
    const currentBranch = branches.find((b) => b.current) || null;
    set({ branches, currentBranch });

    // 更新当前仓库的分支信息
    const { activeRepoId, updateRepoTab } = get();
    if (activeRepoId && currentBranch) {
      updateRepoTab(activeRepoId, { currentBranch: currentBranch.name });
    }
  },

  setCurrentBranch: (branch) => set({ currentBranch: branch }),

  setStatus: (status) => set({ status }),

  setTags: (tags) => set({ tags }),

  setStashes: (stashes) => set({ stashes }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // ========== 新增 Actions ==========
  setFileHistory: (history) => set({ fileHistory: history }),
  
  setShowFileHistory: (show) => set({ showFileHistory: show }),
  
  setCommitFilter: (filter) => {
    set({ commitFilter: filter });
    get().filterCommits();
  },
  
  updateCommitFilter: (filter) => {
    set((state) => ({
      commitFilter: { ...state.commitFilter, ...filter },
    }));
    get().filterCommits();
  },
  
  clearCommitFilter: () => {
    set({ commitFilter: {} });
    get().filterCommits();
  },
  
  setAuthorStats: (stats) => set({ authorStats: stats }),
  
  setSelectedCommitDetail: (detail) => set({ selectedCommitDetail: detail }),
  
  setShowCommitDetail: (show) => set({ showCommitDetail: show }),

  /**
   * 设置 ahead/behind 数量
   */
  setAheadBehind: ({ ahead, behind }: { ahead: number; behind: number }) => set({ ahead, behind }),

  /**
   * 筛选提交
   */
  filterCommits: () => {
    const { commits, commitFilter } = get();
    
    let filtered = [...commits];
    
    // 搜索过滤
    if (commitFilter.search) {
      const search = commitFilter.search.toLowerCase();
      filtered = filtered.filter((c) =>
        c.message.toLowerCase().includes(search) ||
        c.oid.toLowerCase().includes(search) ||
        c.shortOid.toLowerCase().includes(search) ||
        c.authorName.toLowerCase().includes(search) ||
        c.authorEmail.toLowerCase().includes(search)
      );
    }
    
    // 作者过滤
    if (commitFilter.authors && commitFilter.authors.length > 0) {
      filtered = filtered.filter((c) =>
        commitFilter.authors!.includes(c.authorEmail)
      );
    }
    
    // 日期范围过滤
    if (commitFilter.startDate) {
      filtered = filtered.filter((c) =>
        c.authorTimestamp >= commitFilter.startDate!
      );
    }
    if (commitFilter.endDate) {
      filtered = filtered.filter((c) =>
        c.authorTimestamp <= commitFilter.endDate!
      );
    }
    
    // 分支过滤（这个需要在获取日志时指定 ref，暂时通过 oid 匹配）
    // 如果需要按分支过滤，应该重新调用 getLog 指定 ref
    
    set({ filteredCommits: filtered });
  },

  /**
   * 获取文件提交历史（单次 git log --follow 调用，含统计）
   */
  getFileHistory: async (filePath: string) => {
    try {
      const result = await window.electronAPI.git.getFileHistory(filePath);
      if (result) {
        set({
          fileHistory: { filePath: result.filePath, commits: result.commits, stats: result.stats },
          showFileHistory: true,
        });
      }
    } catch (error) {
      console.error('获取文件历史失败:', error);
    }
  },

  /**
   * 获取提交详情（含文件列表）
   */
  getCommitDetail: async (oid: string) => {
    try {
      console.log(`[Store] getCommitDetail called with oid:`, oid);
      const detail = await window.electronAPI.git.getCommitDetail(oid);
      console.log(`[Store] getCommitDetail result:`, {
        oid,
        hasDetail: detail !== null,
        filesCount: detail?.files?.length || 0,
        commitOid: detail?.commit?.oid,
        commitMessage: detail?.commit?.message,
      });
      set({
        selectedCommitDetail: detail,
        showCommitDetail: detail !== null,
      });
    } catch (error) {
      console.error('获取提交详情失败:', error);
    }
  },

  /**
   * 获取作者统计
   */
  fetchAuthorStats: async () => {
    try {
      const stats = await window.electronAPI.git.getAuthorStats();
      set({ authorStats: stats });
    } catch (error) {
      console.error('获取作者统计失败:', error);
    }
  },

  /**
   * 加载仓库数据
   */
  loadRepoData: async (path: string) => {
    try {
      const [branches, commits, status, tags, aheadBehind] = await Promise.all([
        window.electronAPI.git.getBranches(),
        window.electronAPI.git.getLog({ depth: 300, all: true }),
        window.electronAPI.git.getStatus(),
        window.electronAPI.git.getTags().catch(() => []),
        window.electronAPI.git.getAheadBehind().catch(() => ({ ahead: 0, behind: 0 })),
      ]);

      // 获取 stash 列表
      const stashEntries: GitStashEntry[] = await window.electronAPI.git.getStashes().catch(() => []);
      const stashes = stashEntries.map((s) => ({
        id: s.ref,
        message: s.message,
        date: s.dateStr,
      }));

      // 获取作者统计
      const authorStats = await window.electronAPI.git.getAuthorStats().catch(() => []);

      const newCurrentBranch = branches.find((b) => b.current) || null;

      set((state) => {
        const newState = {
          branches,
          commits,
          filteredCommits: commits,
          status,
          tags,
          stashes,
          authorStats,
          currentBranch: newCurrentBranch,
          ahead: aheadBehind.ahead,
          behind: aheadBehind.behind,
          hasMoreCommits: commits.length >= 100,
          repos: state.repos.map((repo) =>
            repo.path === path ? { ...repo, currentBranch: newCurrentBranch?.name || null } : repo
          ),
        };

        // 更新当前仓库的缓存
        if (state.activeRepoId) {
          repoDataCache.set(state.activeRepoId, {
            commits: newState.commits,
            filteredCommits: newState.filteredCommits,
            branches: newState.branches,
            currentBranch: newState.currentBranch,
            status: newState.status,
            tags: newState.tags,
            stashes: newState.stashes,
            authorStats: newState.authorStats,
            ahead: newState.ahead,
            behind: newState.behind,
            hasMoreCommits: newState.hasMoreCommits,
            timestamp: Date.now(),
          });
        }

        return newState;
      });
    } catch (error) {
      console.error('加载仓库数据失败:', error);
      set({ error: `加载失败: ${error}` });
    }
  },

  /**
   * 添加到最近仓库
   */
  addRecentRepo: (path: string) => {
    set((state) => {
      const filtered = state.recentRepos.filter((r) => r !== path);
      return { recentRepos: [path, ...filtered].slice(0, 10) };
    });
  },

  /**
   * 打开仓库
   */
  openRepo: async (path: string) => {
    // 检查是否已经打开
    const existing = get().repos.find((r) => r.path === path);
    if (existing) {
      get().setActiveRepo(existing.id);
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // 调用主进程打开仓库
      const repo = await window.electronAPI.git.openRepository(path);
      if (!repo) {
        set({ error: '无法打开仓库，请确认这是一个 Git 仓库' });
        return;
      }

      // 添加新的仓库 Tab
      const newRepo: RepoTab = {
        id: `repo-${Date.now()}`,
        path: repo.path,
        name: repo.name,
        currentBranch: repo.currentBranch,
        isActive: true,
      };

      get().addRepoTab(newRepo);

      // 添加到最近仓库
      get().addRecentRepo(path);

      // 加载仓库数据
      await get().loadRepoData(path);
    } catch (error) {
      console.error('打开仓库失败:', error);
      set({ error: `打开仓库失败: ${error}` });
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * 刷新仓库数据
   */
  refresh: async () => {
    const { currentRepo } = get();
    if (!currentRepo) return;

    await get().loadRepoData(currentRepo.path);
  },

  /**
   * 暂存文件
   */
  stageFile: async (path: string) => {
    try {
      await window.electronAPI.git.stage([path]);
      await get().refresh();
    } catch (error) {
      console.error('暂存文件失败:', error);
    }
  },

  /**
   * 取消暂存
   */
  unstageFile: async (path: string) => {
    try {
      await window.electronAPI.git.unstage([path]);
      await get().refresh();
    } catch (error) {
      console.error('取消暂存失败:', error);
    }
  },

  /**
   * 暂存所有
   */
  stageAll: async () => {
    try {
      await window.electronAPI.git.stageAll();
      await get().refresh();
    } catch (error) {
      console.error('暂存所有文件失败:', error);
    }
  },

  /**
   * 取消暂存所有
   */
  unstageAll: async () => {
    try {
      await window.electronAPI.git.unstageAll();
      await get().refresh();
    } catch (error) {
      console.error('取消暂存所有文件失败:', error);
    }
  },

  /**
   * 加载更多提交（增量加载）
   */
  loadMoreCommits: async () => {
    const { commits, hasMoreCommits, isLoadingMore } = get();
    if (!hasMoreCommits || isLoadingMore) return;

    set({ isLoadingMore: true });
    try {
      const PAGE_SIZE = 100;
      const moreCommits = await window.electronAPI.git.getLog({
        depth: PAGE_SIZE,
        all: true,
        skip: commits.length,
      });

      if (moreCommits.length === 0) {
        set({ hasMoreCommits: false, isLoadingMore: false });
        return;
      }

      // 去重：跳过已存在的提交
      const existingOids = new Set(commits.map(c => c.oid));
      const newCommits = moreCommits.filter(c => !existingOids.has(c.oid));

      set((state) => ({
        commits: [...state.commits, ...newCommits],
        hasMoreCommits: moreCommits.length >= PAGE_SIZE,
        isLoadingMore: false,
      }));
      get().filterCommits();
    } catch (error) {
      console.error('加载更多提交失败:', error);
      set({ isLoadingMore: false });
    }
  },

  /**
   * 设置文件监听器（SourceGit 模式：监听 .git 变更自动刷新）
   */
  setupWatcher: () => {
    // 清理旧监听器
    if ((window as any).__repoWatcherCleanup) {
      (window as any).__repoWatcherCleanup();
    }

    const cleanup = window.electronAPI.git.onRepoChangedExternally((changeType: string) => {
      console.log(`[Store] .git 变更: ${changeType}`);
      const { currentRepo } = get();
      if (!currentRepo) return;

      // 根据变更类型选择性刷新（减少不必要的全量刷新）
      if (changeType === 'index') {
        // 暂存区变更：只刷新 status
        window.electronAPI.git.getStatus().then((status) => {
          if (status) set({ status });
        }).catch(() => {});
      } else {
        // refs/head/other 变更：全量刷新
        get().refresh();
      }
    });

    (window as any).__repoWatcherCleanup = cleanup;
  },

  /**
   * 重置状态
   */
  reset: () => {
    if ((window as any).__repoWatcherCleanup) {
      (window as any).__repoWatcherCleanup();
      (window as any).__repoWatcherCleanup = null;
    }
    window.electronAPI.git.closeRepository();
    set(initialState);
  },
}));
