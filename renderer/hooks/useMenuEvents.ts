/**
 * 监听主进程菜单事件
 * 主进程菜单点击 → IPC → 渲染进程执行对应操作
 */

import { useEffect } from 'react';
import { useRepoStore } from '../stores/repoStore';

export function useMenuEvents() {
  const {
    currentRepo,
    activeRepoId,
    openRepo,
    closeRepo,
    toggleSidebar,
  } = useRepoStore();

  useEffect(() => {
    // 菜单事件处理映射
    const handlers: Record<string, () => void> = {
      'menu:openRepo': async () => {
        const path = await window.electronAPI.fs.selectFolder();
        if (path) await openRepo(path);
      },

      'menu:cloneRepo': async () => {
        const url = await window.electronAPI.fs.showInputBox({
          title: '克隆仓库',
          prompt: '请输入仓库 URL',
        });
        if (url) {
          const dir = await window.electronAPI.fs.selectFolder();
          if (dir) {
            await window.electronAPI.git.clone(url, dir);
          }
        }
      },

      'menu:initRepo': async () => {
        const dir = await window.electronAPI.fs.selectFolder();
        if (dir) {
          // 初始化后打开
          await openRepo(dir);
        }
      },

      'menu:closeRepo': () => {
        if (activeRepoId) closeRepo(activeRepoId);
      },

      'menu:undo': () => {
        // 触发 Undo 操作
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
        // 聚焦搜索框或打开 Quick Launch
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
        if (currentRepo) await window.electronAPI.git.fetch();
      },

      'menu:pull': async () => {
        if (currentRepo) await window.electronAPI.git.pull();
      },

      'menu:push': async () => {
        if (currentRepo) await window.electronAPI.git.push();
      },

      'menu:stash': async () => {
        if (currentRepo) {
          const message = await window.electronAPI.fs.showInputBox({
            title: 'Stash',
            prompt: '输入 stash 备注（可选）',
          });
          await window.electronAPI.git.stash({ message: message || undefined });
        }
      },

      'menu:stashPop': async () => {
        if (currentRepo) await window.electronAPI.git.stashPop();
      },

      'menu:editGitignore': () => {
        // 触发 .gitignore 编辑器
        window.dispatchEvent(new CustomEvent('showGitignoreEditor'));
      },

      'menu:manageRemotes': () => {
        // 触发远程仓库管理
        window.dispatchEvent(new CustomEvent('showRemotesManager'));
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

      'menu:newBranch': async () => {
        if (!currentRepo) return;
        const name = await window.electronAPI.fs.showInputBox({
          title: '新建分支',
          prompt: '请输入分支名称',
        });
        if (name) await window.electronAPI.git.createBranch(name);
      },

      'menu:switchBranch': () => {
        // 触发分支选择器
        window.dispatchEvent(new CustomEvent('showBranchSelector'));
      },

      'menu:merge': async () => {
        if (!currentRepo) return;
        const name = await window.electronAPI.fs.showInputBox({
          title: '合并分支',
          prompt: '请输入要合并的分支名称',
        });
        if (name) await window.electronAPI.git.merge(name);
      },

      'menu:interactiveRebase': () => {
        window.dispatchEvent(new CustomEvent('showInteractiveRebase'));
      },

      'menu:renameBranch': async () => {
        if (!currentRepo) return;
        const newName = await window.electronAPI.fs.showInputBox({
          title: '重命名分支',
          prompt: `重命名 ${currentRepo.currentBranch} 为`,
        });
        if (newName) await window.electronAPI.git.renameBranch(currentRepo.currentBranch, newName);
      },

      'menu:deleteBranch': async () => {
        if (!currentRepo) return;
        const name = await window.electronAPI.fs.showInputBox({
          title: '删除分支',
          prompt: '请输入要删除的分支名称',
        });
        if (name) await window.electronAPI.git.deleteBranch(name);
      },

      'menu:newTag': async () => {
        if (!currentRepo) return;
        const name = await window.electronAPI.fs.showInputBox({
          title: '创建标签',
          prompt: '输入标签名称',
        });
        if (name) await window.electronAPI.git.createTag(name);
      },

      'menu:deleteTag': async () => {
        if (!currentRepo) return;
        const name = await window.electronAPI.fs.showInputBox({
          title: '删除标签',
          prompt: '输入要删除的标签名称',
        });
        if (name) await window.electronAPI.git.deleteTag(name);
      },

      'menu:pushTag': async () => {
        if (!currentRepo) return;
        const name = await window.electronAPI.fs.showInputBox({
          title: '推送标签',
          prompt: '输入要推送的标签名称',
        });
        if (name) await window.electronAPI.git.push({ remote: 'origin', branch: name });
      },

      'menu:shortcuts': () => {
        // 显示快捷键列表
        window.dispatchEvent(new CustomEvent('showShortcuts'));
      },
    };

    // 注册所有菜单事件监听
    const cleanupFns: (() => void)[] = [];

    for (const [channel, handler] of Object.entries(handlers)) {
      const listener = () => handler();
      window.electronAPI.ipc.on(channel, listener);
      cleanupFns.push(() => window.electronAPI.ipc.removeListener(channel, listener));
    }

    return () => {
      cleanupFns.forEach(fn => fn());
    };
  }, [currentRepo, activeRepoId, openRepo, closeRepo, toggleSidebar]);
}
