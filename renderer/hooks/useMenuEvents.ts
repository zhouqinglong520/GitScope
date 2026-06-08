/**
 * 监听主进程菜单事件
 * 主进程菜单点击 → IPC → 渲染进程触发专业弹窗
 *
 * 所有 showInputBox 假功能已替换为 Fork 风格专业弹窗
 */

import { useEffect } from 'react';
import { useRepoStore } from '../stores/repoStore';

/** 全局弹窗状态管理 — 供 App.tsx / MainLayout 读取 */
export interface DialogState {
  newBranch: boolean;
  deleteBranch: string | null;   // 预填分支名
  renameBranch: string | null;   // 预填分支名
  switchBranch: boolean;
  mergeBranch: string | null;    // 预填来源分支
  newTag: boolean;
  deleteTag: string | null;      // 预填标签名
  pushTag: string | null;        // 预填标签名
  initRepo: boolean;
  remotesManager: boolean;
  gitignoreEditor: boolean;
  stashMenu: boolean;
  cloneRepo: boolean;
}

export const initialDialogState: DialogState = {
  newBranch: false,
  deleteBranch: null,
  renameBranch: null,
  switchBranch: false,
  mergeBranch: null,
  newTag: false,
  deleteTag: null,
  pushTag: null,
  initRepo: false,
  remotesManager: false,
  gitignoreEditor: false,
  stashMenu: false,
  cloneRepo: false,
};

export type DialogAction =
  | { type: 'SHOW'; dialog: keyof DialogState; payload?: string | null }
  | { type: 'HIDE'; dialog: keyof DialogState };

export function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case 'SHOW':
      return { ...state, [action.dialog]: action.payload !== undefined ? action.payload : true };
    case 'HIDE':
      return { ...state, [action.dialog]: typeof state[action.dialog] === 'string' ? null : false };
    default:
      return state;
  }
}

/** 菜单事件到弹窗的映射 */
export function useMenuEvents(dispatch: (action: DialogAction) => void) {
  const {
    currentRepo,
    activeRepoId,
    openRepo,
    closeRepo,
    toggleSidebar,
  } = useRepoStore();

  useEffect(() => {
    const handlers: Record<string, () => void> = {
      'menu:openRepo': async () => {
        const path = await window.electronAPI.fs.selectFolder();
        if (path) await openRepo(path);
      },

      'menu:cloneRepo': () => {
        dispatch({ type: 'SHOW', dialog: 'cloneRepo' });
      },

      'menu:initRepo': () => {
        dispatch({ type: 'SHOW', dialog: 'initRepo' });
      },

      'menu:closeRepo': () => {
        if (activeRepoId) closeRepo(activeRepoId);
      },

      'menu:undo': () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'z', ctrlKey: true, bubbles: true,
        }));
      },

      'menu:redo': () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'z', ctrlKey: true, shiftKey: true, bubbles: true,
        }));
      },

      'menu:find': () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'k', ctrlKey: true, bubbles: true,
        }));
      },

      'menu:refresh': async () => {
        if (currentRepo) await window.electronAPI.git.refresh();
      },

      'menu:toggleSidebar': () => {
        toggleSidebar();
      },

      'menu:quickLaunch': () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'k', ctrlKey: true, bubbles: true,
        }));
      },

      'menu:fetch': async () => {
        if (currentRepo) {
          // 触发 PushPullDialog 的 fetch 模式
          window.dispatchEvent(new CustomEvent('showPushPullDialog', { detail: 'fetch' }));
        }
      },

      'menu:pull': async () => {
        if (currentRepo) {
          window.dispatchEvent(new CustomEvent('showPushPullDialog', { detail: 'pull' }));
        }
      },

      'menu:push': async () => {
        if (currentRepo) {
          window.dispatchEvent(new CustomEvent('showPushPullDialog', { detail: 'push' }));
        }
      },

      'menu:stash': () => {
        dispatch({ type: 'SHOW', dialog: 'stashMenu' });
      },

      'menu:stashPop': () => {
        // 触发 Stash 管理面板（StashDialog 或 StashSection）
        if (currentRepo) {
          window.dispatchEvent(new CustomEvent('showStashPop'));
        }
      },

      'menu:editGitignore': () => {
        dispatch({ type: 'SHOW', dialog: 'gitignoreEditor' });
      },

      'menu:manageRemotes': () => {
        dispatch({ type: 'SHOW', dialog: 'remotesManager' });
      },

      'menu:submodules': () => {
        window.dispatchEvent(new CustomEvent('showSubmodulesManager'));
      },

      'menu:reflog': () => {
        window.dispatchEvent(new CustomEvent('showReflog'));
      },

      'menu:openTerminal': async () => {
        if (currentRepo) await window.electronAPI.shell.openTerminal(currentRepo.path);
      },

      'menu:openInExplorer': async () => {
        if (currentRepo) await window.electronAPI.shell.openPath(currentRepo.path);
      },

      'menu:newBranch': () => {
        dispatch({ type: 'SHOW', dialog: 'newBranch' });
      },

      'menu:switchBranch': () => {
        dispatch({ type: 'SHOW', dialog: 'switchBranch' });
      },

      'menu:merge': () => {
        dispatch({ type: 'SHOW', dialog: 'mergeBranch' });
      },

      'menu:interactiveRebase': () => {
        window.dispatchEvent(new CustomEvent('showInteractiveRebase'));
      },

      'menu:renameBranch': () => {
        dispatch({ type: 'SHOW', dialog: 'renameBranch', payload: currentRepo?.currentBranch || null });
      },

      'menu:deleteBranch': () => {
        dispatch({ type: 'SHOW', dialog: 'deleteBranch' });
      },

      'menu:newTag': () => {
        dispatch({ type: 'SHOW', dialog: 'newTag' });
      },

      'menu:deleteTag': () => {
        dispatch({ type: 'SHOW', dialog: 'deleteTag' });
      },

      'menu:pushTag': () => {
        dispatch({ type: 'SHOW', dialog: 'pushTag' });
      },

      'menu:shortcuts': () => {
        window.dispatchEvent(new CustomEvent('showShortcuts'));
      },

      'menu:openRepoAtPath': async (_: any, path: string) => {
        if (path) await openRepo(path);
      },
    };

    // 注册所有菜单事件监听
    const cleanupFns: (() => void)[] = [];

    for (const [channel, handler] of Object.entries(handlers)) {
      const listener = (...args: any[]) => handler(...args);
      window.electronAPI.ipc.on(channel, listener);
      cleanupFns.push(() => window.electronAPI.ipc.removeListener(channel, listener));
    }

    return () => {
      cleanupFns.forEach(fn => fn());
    };
  }, [currentRepo, activeRepoId, openRepo, closeRepo, toggleSidebar, dispatch]);
}
