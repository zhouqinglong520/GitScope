/**
 * 中文语言包
 */

export const zhCN = {
  // 应用名称
  app: {
    name: 'GitGUI',
    description: '现代化 Git 客户端',
  },

  // 主菜单
  menu: {
    file: '文件',
    edit: '编辑',
    view: '视图',
    repository: '仓库',
    branch: '分支',
    help: '帮助',
  },

  // 工具栏
  toolbar: {
    openRepo: '打开仓库',
    pull: '拉取',
    push: '推送',
    fetch: '获取',
    commit: '提交',
    refresh: '刷新',
    settings: '设置',
  },

  // 侧边栏
  sidebar: {
    repositories: '仓库',
    branches: '分支',
    recent: '最近',
    noRepos: '暂无仓库',
    addRepo: '添加仓库',
    collapse: '折叠侧边栏',
    expand: '展开侧边栏',
    tags: '标签',
    stashes: '暂存',
  },

  // 提交图
  commitGraph: {
    title: '提交历史',
    noCommits: '暂无提交记录',
    commit: '提交',
    author: '作者',
    date: '日期',
    message: '提交信息',
    parents: '父提交',
    children: '子提交',
  },

  // 详情面板
  detail: {
    title: '详情',
    commitDetails: '提交详情',
    fileChanges: '文件变更',
    diff: '差异',
    staged: '已暂存',
    unstaged: '未暂存',
    untracked: '未跟踪',
    noChanges: '暂无变更',
    add: '添加',
    reset: '重置',
    stageAll: '暂存全部',
    unstageAll: '取消全部暂存',
    viewDiff: '查看差异',
  },

  // 分支
  branch: {
    local: '本地分支',
    remote: '远程分支',
    current: '当前分支',
    newBranch: '新建分支',
    deleteBranch: '删除分支',
    checkout: '切换',
    merge: '合并',
    rebase: '变基',
    noBranches: '暂无分支',
    rename: '重命名',
    track: '跟踪分支',
  },

  // 标签
  tag: {
    title: '标签',
    create: '创建标签',
    delete: '删除标签',
    push: '推送标签',
    checkout: '检出标签',
    noTags: '暂无标签',
  },

  // Stash
  stash: {
    title: '暂存',
    create: '暂存更改',
    apply: '应用',
    pop: '弹出',
    drop: '删除',
    clear: '清空',
    noStashes: '暂无暂存',
  },

  // 状态
  status: {
    clean: '工作区干净',
    modified: '已修改',
    staged: '已暂存',
    untracked: '未跟踪',
    deleted: '已删除',
    added: '新增',
    renamed: '已重命名',
  },

  // 提交对话框
  commitDialog: {
    title: '提交更改',
    message: '提交消息',
    messagePlaceholder: '输入提交消息...',
    commit: '提交',
    cancel: '取消',
    amend: '修改上一次提交',
  },

  // 差异显示
  diff: {
    oldFile: '旧文件',
    newFile: '新文件',
    binaryFile: '二进制文件',
    untrackedFile: '未跟踪文件',
    noDiff: '无差异',
    additions: '新增',
    deletions: '删除',
    selectFile: '选择一个文件查看差异',
    selectCommit: '选择一个提交查看变更',
    viewMode: '视图模式',
    unified: 'Unified',
    sideBySide: 'Side-by-Side',
    viewModeShortcut: '快捷键',
    searchPlaceholder: '搜索...',
    searchNoResults: '无匹配结果',
    prevHunk: '上一个变更',
    nextHunk: '下一个变更',
    showWhitespace: '显示空白',
    ignoreWhitespace: '忽略空白',
    openInExternalTool: '外部工具',
    diffToolNotConfigured: '请先配置 git difftool',
    syntaxHighlight: '语法高亮',
  },

  // Quick Launch
  quickLaunch: {
    title: 'Quick Launch',
    placeholder: '输入命令或搜索...',
    noResults: '未找到匹配的命令',
    hint: '提示',
    navigate: '导航',
    execute: '执行',
    close: '关闭',
  },

  // 右键菜单
  contextMenu: {
    copy: '复制',
    paste: '粘贴',
    cut: '剪切',
    delete: '删除',
    rename: '重命名',
    openInExplorer: '在资源管理器中打开',
    openInTerminal: '在终端中打开',
    copyPath: '复制路径',
    copyCommitHash: '复制提交哈希',
    copyCommitSHA: '复制 SHA',
    copyCommitInfo: '复制提交信息',
    createBranch: '创建分支',
    createBranchHere: '在此处创建分支',
    createTag: '创建标签',
    createTagHere: '在此处创建标签',
    switchBranch: '切换分支',
    merge: '合并到当前分支',
    rebase: '变基到当前分支',
    checkout: '检出',
    checkoutCommit: '检出此提交',
    discard: '放弃更改',
    undo: '撤销',
    resetToHere: '重置到此处',
    cherrypick: 'Cherry-pick 提交',
    revert: 'Revert 提交',
    saveAsPatch: '保存为 Patch...',
    interactiveRebase: '交互式变基',
    reword: '修改提交消息',
    squash: '压缩提交',
    fixup: '修复提交',
    drop: '删除提交',
  },

  // 窗口控件
  window: {
    minimize: '最小化',
    maximize: '最大化',
    restore: '还原',
    close: '关闭',
  },

  // 错误信息
  error: {
    openRepoFailed: '打开仓库失败',
    notGitRepo: '不是有效的 Git 仓库',
    commitFailed: '提交失败',
    pushFailed: '推送失败',
    pullFailed: '拉取失败',
    fetchFailed: '获取失败',
    networkError: '网络错误',
    authFailed: '认证失败',
  },

  // 成功信息
  success: {
    commitSuccess: '提交成功',
    pushSuccess: '推送成功',
    pullSuccess: '拉取成功',
    fetchSuccess: '获取成功',
    cloneSuccess: '克隆成功',
    stageSuccess: '暂存成功',
    unstageSuccess: '取消暂存成功',
  },

  // 通用
  common: {
    ok: '确定',
    cancel: '取消',
    confirm: '确认',
    delete: '删除',
    rename: '重命名',
    copy: '复制',
    paste: '粘贴',
    loading: '加载中...',
    noData: '暂无数据',
    search: '搜索',
    filter: '筛选',
    sort: '排序',
    select: '选择',
    selectAll: '全选',
    deselectAll: '取消全选',
    close: '关闭',
    save: '保存',
    reset: '重置',
  },

  // 状态栏
  statusBar: {
    ahead: '领先',
    behind: '落后',
    noRemote: '无远程仓库',
    upToDate: '已是最新',
  },

  // 提交详情面板
  commitDetail: {
    title: '提交详情',
    sha: 'SHA',
    message: '提交消息',
    author: '作者',
    committer: '提交者',
    parents: '父提交',
    fileChanges: '文件变更',
    filesChanged: '个文件变更',
    status: '状态',
    path: '路径',
    stats: '统计',
    viewDiff: '查看差异',
    viewHistory: '查看历史',
    copySHA: '复制 SHA',
  },

  // 文件历史
  fileHistory: {
    title: '文件历史',
    commits: '次提交',
    diff: '差异',
    viewOnGitee: '在 Gitee 中查看',
    viewDiff: '查看该提交中的文件差异',
  },

  // 作者筛选
  authorFilter: {
    title: '作者',
    search: '搜索作者...',
    selected: '已选择',
    selectAll: '全选',
    selectNone: '取消',
    noResults: '未找到匹配的作者',
  },

  // 筛选工具栏
  filter: {
    searchPlaceholder: '搜索提交消息、SHA 或作者...',
    dateRange: '日期范围',
    branch: '分支',
    allBranches: '所有分支',
    current: '当前',
    today: '今天',
    lastWeek: '最近一周',
    lastMonth: '最近一个月',
    last3Months: '最近三个月',
    lastYear: '最近一年',
    allTime: '全部时间',
    since: '自',
    until: '至',
    customRange: '自定义范围',
    clear: '清除筛选',
    showing: '显示',
  },

  // 折叠合并提交
  collapse: {
    collapseBranch: '折叠分支',
    expandBranch: '展开分支',
    collapseAll: '折叠所有合并',
    expandAll: '展开所有合并',
    commitsCollapsed: '个提交已折叠，点击展开',
  },

  // 冲突预判
  conflict: {
    warningTitle: '⚠️ 冲突预检',
    warningMessage: '此操作可能产生 {count} 个文件冲突，是否继续？',
    conflictingFiles: '冲突文件',
    continue: '继续',
    cancel: '取消',
    mergeConflict: '合并冲突',
    rebaseConflict: '变基冲突',
    cherryPickConflict: 'Cherry-pick 冲突',
    noConflict: '无冲突',
    conflictDetected: '检测到冲突',
    manualMerge: '请手动解决冲突后继续操作',
  },

  // 分支管理
  branchManage: {
    upstreamStatus: {
      upToDate: '已同步',
      ahead: '领先',
      behind: '落后',
      aheadBehind: '领先落后',
      diverged: '分叉',
      noUpstream: '仅本地',
      noUpstreamTooltip: '该分支没有配置上游分支',
      aheadTooltip: '领先上游 {count} 个提交',
      behindTooltip: '落后上游 {count} 个提交',
      aheadBehindTooltip: '领先 {ahead} 个，落后 {behind} 个提交',
    },
    filter: {
      placeholder: '搜索分支...',
      noMatch: '无匹配分支',
      hint: '按 / 聚焦搜索框',
    },
    pinned: {
      title: '已收藏',
      pinBranch: '收藏分支',
      unpinBranch: '取消收藏',
      empty: '暂无收藏分支',
    },
    group: {
      local: '本地',
      remote: '远程',
      feature: '功能',
      bugfix: '修复',
      release: '发布',
    },
    toolbarBadge: {
      pullBehind: '↓{count}',
      pushAhead: '↑{count}',
    },
  },
};

export type I18nKeys = typeof zhCN;
