/**
 * 英文语言包
 */

import type { I18nKeys } from './zh-CN';

export const enUS: I18nKeys = {
  // 应用名称
  app: {
    name: 'GitGUI',
    description: 'Modern Git Client',
  },

  // 主菜单
  menu: {
    file: 'File',
    edit: 'Edit',
    view: 'View',
    repository: 'Repository',
    branch: 'Branch',
    help: 'Help',
  },

  // 工具栏
  toolbar: {
    openRepo: 'Open Repository',
    pull: 'Pull',
    push: 'Push',
    fetch: 'Fetch',
    commit: 'Commit',
    refresh: 'Refresh',
    settings: 'Settings',
  },

  // 侧边栏
  sidebar: {
    repositories: 'Repositories',
    branches: 'Branches',
    recent: 'Recent',
    noRepos: 'No repositories',
    addRepo: 'Add Repository',
    collapse: 'Collapse Sidebar',
    expand: 'Expand Sidebar',
    tags: 'Tags',
    stashes: 'Stashes',
  },

  // 提交图
  commitGraph: {
    title: 'Commit History',
    noCommits: 'No commits yet',
    commit: 'Commit',
    author: 'Author',
    date: 'Date',
    message: 'Message',
    parents: 'Parents',
    children: 'Children',
  },

  // 详情面板
  detail: {
    title: 'Details',
    commitDetails: 'Commit Details',
    fileChanges: 'File Changes',
    diff: 'Diff',
    staged: 'Staged',
    unstaged: 'Unstaged',
    untracked: 'Untracked',
    noChanges: 'No changes',
    add: 'Add',
    reset: 'Reset',
    stageAll: 'Stage All',
    unstageAll: 'Unstage All',
    viewDiff: 'View Diff',
  },

  // 分支
  branch: {
    local: 'Local Branches',
    remote: 'Remote Branches',
    current: 'Current Branch',
    newBranch: 'New Branch',
    deleteBranch: 'Delete Branch',
    checkout: 'Checkout',
    merge: 'Merge',
    rebase: 'Rebase',
    noBranches: 'No branches',
    rename: 'Rename',
    track: 'Track Branch',
  },

  // 标签
  tag: {
    title: 'Tags',
    create: 'Create Tag',
    delete: 'Delete Tag',
    push: 'Push Tag',
    checkout: 'Checkout Tag',
    noTags: 'No tags',
  },

  // Stash
  stash: {
    title: 'Stashes',
    create: 'Stash Changes',
    apply: 'Apply',
    pop: 'Pop',
    drop: 'Drop',
    clear: 'Clear',
    noStashes: 'No stashes',
  },

  // 状态
  status: {
    clean: 'Working tree clean',
    modified: 'Modified',
    staged: 'Staged',
    untracked: 'Untracked',
    deleted: 'Deleted',
    added: 'Added',
    renamed: 'Renamed',
  },

  // 提交对话框
  commitDialog: {
    title: 'Commit Changes',
    message: 'Commit Message',
    messagePlaceholder: 'Enter commit message...',
    commit: 'Commit',
    cancel: 'Cancel',
    amend: 'Amend last commit',
  },

  // 差异显示
  diff: {
    oldFile: 'Old File',
    newFile: 'New File',
    binaryFile: 'Binary File',
    untrackedFile: 'Untracked File',
    noDiff: 'No Diff',
    additions: 'Additions',
    deletions: 'Deletions',
    selectFile: 'Select a file to view diff',
    selectCommit: 'Select a commit to view changes',
    viewMode: 'View Mode',
    unified: 'Unified',
    sideBySide: 'Side-by-Side',
    viewModeShortcut: 'Shortcut',
    searchPlaceholder: 'Search...',
    searchNoResults: 'No matches',
    prevHunk: 'Previous Change',
    nextHunk: 'Next Change',
    showWhitespace: 'Show Whitespace',
    ignoreWhitespace: 'Ignore Whitespace',
    openInExternalTool: 'External Tool',
    diffToolNotConfigured: 'Please configure git difftool first',
    syntaxHighlight: 'Syntax Highlight',
  },

  // Quick Launch
  quickLaunch: {
    title: 'Quick Launch',
    placeholder: 'Type a command or search...',
    noResults: 'No matching commands found',
    hint: 'Hint',
    navigate: 'Navigate',
    execute: 'Execute',
    close: 'Close',
  },

  // 右键菜单
  contextMenu: {
    copy: 'Copy',
    paste: 'Paste',
    cut: 'Cut',
    delete: 'Delete',
    rename: 'Rename',
    openInExplorer: 'Open in Explorer',
    openInTerminal: 'Open in Terminal',
    copyPath: 'Copy Path',
    copyCommitHash: 'Copy Commit Hash',
    copyCommitSHA: 'Copy SHA',
    copyCommitInfo: 'Copy Commit Info',
    createBranch: 'Create Branch',
    createBranchHere: 'Create Branch Here',
    createTag: 'Create Tag',
    createTagHere: 'Create Tag Here',
    switchBranch: 'Switch Branch',
    merge: 'Merge into Current Branch',
    rebase: 'Rebase onto Current Branch',
    checkout: 'Checkout',
    checkoutCommit: 'Checkout This Commit',
    discard: 'Discard Changes',
    undo: 'Undo',
    resetToHere: 'Reset to Here',
    cherrypick: 'Cherry-pick Commit',
    revert: 'Revert Commit',
    saveAsPatch: 'Save as Patch...',
    interactiveRebase: 'Interactive Rebase',
    reword: 'Reword',
    squash: 'Squash',
    fixup: 'Fixup',
    drop: 'Drop',
  },

  // 窗口控件
  window: {
    minimize: 'Minimize',
    maximize: 'Maximize',
    restore: 'Restore',
    close: 'Close',
  },

  // 错误信息
  error: {
    openRepoFailed: 'Failed to open repository',
    notGitRepo: 'Not a valid Git repository',
    commitFailed: 'Commit failed',
    pushFailed: 'Push failed',
    pullFailed: 'Pull failed',
    fetchFailed: 'Fetch failed',
    networkError: 'Network error',
    authFailed: 'Authentication failed',
  },

  // 成功信息
  success: {
    commitSuccess: 'Commit successful',
    pushSuccess: 'Push successful',
    pullSuccess: 'Pull successful',
    fetchSuccess: 'Fetch successful',
    cloneSuccess: 'Clone successful',
    stageSuccess: 'Stage successful',
    unstageSuccess: 'Unstage successful',
  },

  // 通用
  common: {
    ok: 'OK',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    rename: 'Rename',
    copy: 'Copy',
    paste: 'Paste',
    loading: 'Loading...',
    noData: 'No data',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    select: 'Select',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    close: 'Close',
    save: 'Save',
    reset: 'Reset',
  },

  // 状态栏
  statusBar: {
    ahead: 'ahead',
    behind: 'behind',
    noRemote: 'No remote',
    upToDate: 'Up to date',
  },

  // 提交详情面板
  commitDetail: {
    title: 'Commit Details',
    sha: 'SHA',
    message: 'Commit Message',
    author: 'Author',
    committer: 'Committer',
    parents: 'Parents',
    fileChanges: 'File Changes',
    filesChanged: 'files changed',
    status: 'Status',
    path: 'Path',
    stats: 'Stats',
    viewDiff: 'View Diff',
    viewHistory: 'View History',
    copySHA: 'Copy SHA',
  },

  // 文件历史
  fileHistory: {
    title: 'File History',
    commits: 'commits',
    diff: 'Diff',
    viewOnGitee: 'View on Gitee',
    viewDiff: 'View diff for this commit',
  },

  // 作者筛选
  authorFilter: {
    title: 'Authors',
    search: 'Search authors...',
    selected: 'selected',
    selectAll: 'Select All',
    selectNone: 'Clear',
    noResults: 'No matching authors found',
  },

  // 筛选工具栏
  filter: {
    searchPlaceholder: 'Search message, SHA or author...',
    dateRange: 'Date Range',
    branch: 'Branch',
    allBranches: 'All Branches',
    current: 'current',
    today: 'Today',
    lastWeek: 'Last Week',
    lastMonth: 'Last Month',
    last3Months: 'Last 3 Months',
    lastYear: 'Last Year',
    allTime: 'All Time',
    since: 'Since',
    until: 'Until',
    customRange: 'Custom Range',
    clear: 'Clear Filter',
    showing: 'Showing',
  },

  // Collapse merge commits
  collapse: {
    collapseBranch: 'Collapse Branch',
    expandBranch: 'Expand Branch',
    collapseAll: 'Collapse All Merges',
    expandAll: 'Expand All Merges',
    commitsCollapsed: 'commits collapsed, click to expand',
  },

  // 冲突预判
  conflict: {
    warningTitle: '⚠️ Conflict Check',
    warningMessage: 'This operation may cause conflicts in {count} file(s). Continue?',
    conflictingFiles: 'Conflicting Files',
    continue: 'Continue',
    cancel: 'Cancel',
    mergeConflict: 'Merge Conflict',
    rebaseConflict: 'Rebase Conflict',
    cherryPickConflict: 'Cherry-pick Conflict',
    noConflict: 'No Conflict',
    conflictDetected: 'Conflict Detected',
    manualMerge: 'Please resolve conflicts manually and continue',
  },

  // Branch Management
  branchManage: {
    upstreamStatus: {
      upToDate: 'Up to date',
      ahead: 'Ahead',
      behind: 'Behind',
      aheadBehind: 'Ahead/Behind',
      diverged: 'Diverged',
      noUpstream: 'No upstream',
      noUpstreamTooltip: 'This branch has no upstream configured',
      aheadTooltip: '{count} commit(s) ahead of upstream',
      behindTooltip: '{count} commit(s) behind upstream',
      aheadBehindTooltip: '{ahead} ahead, {behind} behind',
    },
    filter: {
      placeholder: 'Search branches...',
      noMatch: 'No matching branches',
      hint: 'Press / to focus search',
    },
    pinned: {
      title: 'Pinned',
      pinBranch: 'Pin branch',
      unpinBranch: 'Unpin branch',
      empty: 'No pinned branches',
    },
    group: {
      local: 'Local',
      remote: 'Remote',
      feature: 'Feature',
      bugfix: 'Bugfix',
      release: 'Release',
    },
    toolbarBadge: {
      pullBehind: '↓{count}',
      pushAhead: '↑{count}',
    },
  },
};
