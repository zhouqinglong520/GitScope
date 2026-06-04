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
  BranchTrackingMap,
  GitStashEntry,
  StashFileChange,
} from '@shared/types/git';

// 仓库信息扩展（包含 ID）
export interface RepoTab {
  id: string;
  path: string;
  name: string;
  currentBranch: string;
  isActive: boolean;
}

// Stash 信息（使用共享类型）
export type StashInfo = GitStashEntry;

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
  
  /** 分支跟踪状态映射 */
  branchTrackingStatus: BranchTrackingMap;

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
  /** 设置分支跟踪状态 */
  setBranchTrackingStatus: (status: BranchTrackingMap) => void;
  /** 获取分支跟踪状态 */
  fetchBranchTrackingStatus: () => Promise<void>;
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
  branchTrackingStatus: {} as BranchTrackingMap,
  showCommitDetail: false,
};

/**
 * 仓库状态管理 Hook
 */
export const useRepoStore = create<RepoState>((set, get) => ({
  ...initialState,

  // 多仓库 Tab Actions
  setActiveRepo: (repoId) => {
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
      get().loadRepoData(repo.path);
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
   * 重置状态
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
   * 重置状态
   * 获取文件提交历史
   */
  getFileHistory: async (filePath: string) => {
    try {
      const commits = await window.electronAPI.git.getFileLog(filePath);
      // 获取每个提交的变更统计
      const stats: Record<string, { additions: number; deletions: number }> = {};
      
      for (const commit of commits) {
        const detail = await window.electronAPI.git.getCommitDetail(commit.oid);
        const fileChange = detail?.files.find((f) => f.path === filePath);
        if (fileChange) {
          stats[commit.oid] = {
            additions: fileChange.additions,
            deletions: fileChange.deletions,
          };
        }
      }
      
      set({
        fileHistory: { filePath, commits, stats },
        showFileHistory: true,
      });
    } catch (error) {
      console.error('获取文件历史失败:', error);
    }
  },

  /**
   * 重置状态
   * 获取提交详情（含文件列表）
   */
  getCommitDetail: async (oid: string) => {
    try {
      const detail = await window.electronAPI.git.getCommitDetail(oid);
      set({
        selectedCommitDetail: detail,
        showCommitDetail: detail !== null,
      });
    } catch (error) {
      console.error('获取提交详情失败:', error);
    }
  },

  /**
   * 重置状态
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
   * 重置状态
   * 加载仓库数据
   */
  loadRepoData: async (path: string) => {
    try {
      const [branches, commits, status, tags] = await Promise.all([
        window.electronAPI.git.getBranches(),
        window.electronAPI.git.getLog({ depth: 100 }),
        window.electronAPI.git.getStatus(),
        window.electronAPI.git.getTags().catch(() => []),
      ]);

      // 获取 stash 列表
      const stashes = await window.electronAPI.git.getStashes().catch(() => []);

      // 获取作者统计
      const authorStats = await window.electronAPI.git.getAuthorStats().catch(() => []);

      set({
        branches,
        commits,
        filteredCommits: commits,
        status,
        tags,
        stashes,
        authorStats,
        currentBranch: branches.find((b) => b.current) || null,
      });

      // 获取分支跟踪状态
      const trackingStatus = await window.electronAPI.git.getBranchTrackingStatus().catch(() => ({}));
      set({ branchTrackingStatus: trackingStatus });
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
   * 设置分支跟踪状态
   */
  setBranchTrackingStatus: (status: BranchTrackingMap) => {
    set({ branchTrackingStatus: status });
  },

  /**
   * 获取分支跟踪状态
   */
  fetchBranchTrackingStatus: async () => {
    try {
      const trackingStatus = await window.electronAPI.git.getBranchTrackingStatus().catch(() => ({}));
      set({ branchTrackingStatus: trackingStatus as BranchTrackingMap });
    } catch (error) {
      console.error('获取分支跟踪状态失败:', error);
    }
  },

  /**
   * 重置状态
   */
  reset: () => {
    window.electronAPI.git.closeRepository();
    set(initialState);
  },
}));
