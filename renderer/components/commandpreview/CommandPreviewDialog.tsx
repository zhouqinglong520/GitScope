/**
 * Git 命令预览对话框
 * 在执行 git 操作前显示即将执行的命令
 * 教育 + 透明：新手学 Git，老手确认意图
 */

import React, { useState, useEffect } from 'react';
import './CommandPreviewDialog.css';

interface CommandInfo {
  command: string;
  description: string;
  risk: 'safe' | 'moderate' | 'dangerous';
  category: string;
}

interface Props {
  visible: boolean;
  commands: CommandInfo[];
  onConfirm: () => void;
  onCancel: () => void;
}

const RISK_CONFIG = {
  safe: { color: '#6cc644', label: '安全', icon: '✓' },
  moderate: { color: '#e2a855', label: '注意', icon: '⚠' },
  dangerous: { color: '#e85d75', label: '危险', icon: '🔴' },
};

function CommandPreviewDialog({ visible, commands, onConfirm, onCancel }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (visible) setDontShowAgain(false);
  }, [visible]);

  if (!visible || commands.length === 0) return null;

  const maxRisk = commands.reduce((max, cmd) => {
    const levels = ['safe', 'moderate', 'dangerous'];
    return levels.indexOf(cmd.risk) > levels.indexOf(max) ? cmd.risk : max;
  }, 'safe' as 'safe' | 'moderate' | 'dangerous');

  const riskInfo = RISK_CONFIG[maxRisk];

  return (
    <div className="cpd-overlay">
      <div className="cpd-dialog">
        {/* Header */}
        <div className="cpd-header">
          <div className="cpd-header-left">
            <span className="cpd-risk-badge" style={{ color: riskInfo.color, background: `${riskInfo.color}18` }}>
              {riskInfo.icon} {riskInfo.label}
            </span>
            <span className="cpd-title">Git 命令预览</span>
          </div>
        </div>

        {/* Commands */}
        <div className="cpd-commands">
          {commands.map((cmd, idx) => {
            const risk = RISK_CONFIG[cmd.risk];
            return (
              <div key={idx} className="cpd-command">
                <div className="cpd-command-meta">
                  <span className="cpd-category">{cmd.category}</span>
                  <span className="cpd-risk-dot" style={{ background: risk.color }} />
                </div>
                <div className="cpd-command-text">
                  <span className="cpd-prompt">$</span>
                  <code>{cmd.command}</code>
                </div>
                <div className="cpd-command-desc">{cmd.description}</div>
              </div>
            );
          })}
        </div>

        {/* Don't show again */}
        <label className="cpd-dont-show">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={e => setDontShowAgain(e.target.checked)}
          />
          <span>不再显示此类命令预览</span>
        </label>

        {/* Actions */}
        <div className="cpd-actions">
          <button className="cpd-btn-cancel" onClick={onCancel}>取消</button>
          <button
            className="cpd-btn-confirm"
            style={{ background: riskInfo.color }}
            onClick={() => {
              if (dontShowAgain) {
                localStorage.setItem(`majie-cmd-preview-${commands[0]?.category}`, 'skip');
              }
              onConfirm();
            }}
          >
            执行
          </button>
        </div>
      </div>
    </div>
  );
}

export default CommandPreviewDialog;

/**
 * 辅助函数：生成 git 命令预览信息
 */
export function getGitCommandPreview(action: string, params?: Record<string, any>): CommandInfo[] {
  const previews: Record<string, () => CommandInfo[]> = {
    push: () => [{
      command: `git push${params?.remote ? ` ${params.remote}` : ''}${params?.branch ? ` ${params.branch}` : ''}`,
      description: '将本地提交推送到远程仓库',
      risk: 'moderate',
      category: '远程',
    }],
    pull: () => [
      { command: 'git fetch', description: '获取远程更新', risk: 'safe', category: '远程' },
      { command: `git merge${params?.remote ? ` ${params.remote}/${params.branch}` : ''}`, description: '合并远程分支', risk: 'moderate', category: '合并' },
    ],
    fetch: () => [{
      command: `git fetch${params?.remote ? ` ${params.remote}` : ' --all'}`,
      description: '获取远程仓库最新信息（不修改本地）',
      risk: 'safe',
      category: '远程',
    }],
    merge: () => [{
      command: `git merge ${params?.branch || ''}`,
      description: '合并指定分支到当前分支',
      risk: 'moderate',
      category: '合并',
    }],
    rebase: () => [{
      command: `git rebase ${params?.onto || ''}`,
      description: '变基到指定提交/分支',
      risk: 'moderate',
      category: '变基',
    }],
    reset_hard: () => [{
      command: `git reset --hard ${params?.ref || 'HEAD'}`,
      description: '⚠️ 硬重置，丢弃所有未提交更改',
      risk: 'dangerous',
      category: '重置',
    }],
    reset_mixed: () => [{
      command: `git reset --mixed ${params?.ref || 'HEAD'}`,
      description: '混合重置，保留工作区更改',
      risk: 'moderate',
      category: '重置',
    }],
    reset_soft: () => [{
      command: `git reset --soft ${params?.ref || 'HEAD'}`,
      description: '软重置，保留暂存区和工作区',
      risk: 'safe',
      category: '重置',
    }],
    cherryPick: () => [{
      command: `git cherry-pick ${params?.oid || ''}`,
      description: '将指定提交应用到当前分支',
      risk: 'moderate',
      category: '摘取',
    }],
    revert: () => [{
      command: `git revert ${params?.oid || ''}`,
      description: '创建一个新提交来撤销指定提交',
      risk: 'safe',
      category: '撤销',
    }],
    stash: () => [{
      command: `git stash${params?.message ? ` push -m "${params.message}"` : ''}`,
      description: '暂存当前工作区更改',
      risk: 'safe',
      category: '暂存',
    }],
    stashPop: () => [{
      command: `git stash pop${params?.index ? ` stash@{${params.index}}` : ''}`,
      description: '恢复暂存的更改并删除 stash 条目',
      risk: 'moderate',
      category: '暂存',
    }],
    branch_delete: () => [{
      command: `git branch${params?.force ? ' -D' : ' -d'} ${params?.name || ''}`,
      description: params?.force ? '强制删除分支（即使未合并）' : '删除已合并的分支',
      risk: params?.force ? 'dangerous' : 'moderate',
      category: '分支',
    }],
    commit_amend: () => [{
      command: 'git commit --amend',
      description: '修改上次提交（如果已推送会影响历史）',
      risk: 'moderate',
      category: '提交',
    }],
  };

  return (previews[action] || (() => []))();
}

/**
 * 检查某类操作是否需要显示预览
 */
export function shouldShowPreview(category: string): boolean {
  return localStorage.getItem(`majie-cmd-preview-${category}`) !== 'skip';
}
