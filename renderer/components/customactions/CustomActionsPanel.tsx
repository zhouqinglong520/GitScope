/**
 * 自定义操作管理面板（增强版）
 * 创建、编辑、删除、执行自定义 Shell 命令操作
 * 导出右键菜单集成工具
 */
import React, { useState, useEffect } from 'react';
import './CustomActionsPanel.css';

export interface CustomAction {
  id: string; name: string; command: string; workingDir?: string;
  env?: Record<string, string>; icon?: string; shortcut?: string;
  filePattern?: string; showInContextMenu: boolean; showInToolbar: boolean;
}

interface Props { visible: boolean; onClose: () => void; }

export const CustomActionsPanel: React.FC<Props> = ({ visible, onClose }) => {
  const [actions, setActions] = useState<CustomAction[]>([]);
  const [editing, setEditing] = useState<CustomAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [outputLog, setOutputLog] = useState<{ id: string; stdout: string; stderr: string; exitCode: number } | null>(null);

  useEffect(() => { if (visible) loadActions(); }, [visible]);

  const loadActions = async () => {
    setLoading(true);
    try { setActions(await window.electronAPI.git.listCustomActions()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const newAction: CustomAction = {
    id: `action-${Date.now()}`, name: '', command: '', showInContextMenu: true, showInToolbar: false,
  };

  const handleSave = async () => {
    if (!editing || !editing.name || !editing.command) return;
    try {
      await window.electronAPI.git.saveCustomAction(editing);
      setEditing(null); loadActions();
    } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此操作?')) return;
    try { await window.electronAPI.git.deleteCustomAction(id); loadActions(); }
    catch (e: any) { alert(e.message); }
  };

  const handleExecute = async (id: string) => {
    setExecuting(id);
    setOutputLog(null);
    try {
      const result = await window.electronAPI.git.executeCustomAction(id);
      setOutputLog({ id, ...result });
    } catch (e: any) { alert(e.message); }
    finally { setExecuting(null); }
  };

  if (!visible) return null;

  return (
    <div className="ca-overlay">
      <div className="ca-dialog" style={{ width: 580 }}>
        <div className="ca-header">
          <h3>自定义操作</h3>
          <button className="btn-add" onClick={() => setEditing({ ...newAction, id: `action-${Date.now()}` })}>+ 新建</button>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {editing && (
          <div className="ca-editor">
            <div className="ca-editor-row">
              <label>名称</label>
              <input placeholder="如：运行测试" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="ca-editor-row">
              <label>命令</label>
              <input placeholder="如：npm test" value={editing.command} onChange={e => setEditing({ ...editing, command: e.target.value })} />
            </div>
            <div className="ca-editor-row">
              <label>工作目录</label>
              <input placeholder="可选，留空为仓库根目录" value={editing.workingDir || ''} onChange={e => setEditing({ ...editing, workingDir: e.target.value })} />
            </div>
            <div className="ca-editor-row">
              <label>快捷键</label>
              <input placeholder="如：Ctrl+Shift+T" value={editing.shortcut || ''} onChange={e => setEditing({ ...editing, shortcut: e.target.value })} />
            </div>
            <div className="ca-editor-row">
              <label>文件匹配</label>
              <input placeholder="如：*.ts（仅匹配文件右键显示）" value={editing.filePattern || ''} onChange={e => setEditing({ ...editing, filePattern: e.target.value })} />
            </div>
            <div className="ca-checkboxes">
              <label><input type="checkbox" checked={editing.showInContextMenu} onChange={e => setEditing({ ...editing, showInContextMenu: e.target.checked })} />右键菜单</label>
              <label><input type="checkbox" checked={editing.showInToolbar} onChange={e => setEditing({ ...editing, showInToolbar: e.target.checked })} />工具栏</label>
            </div>
            <div className="ca-editor-actions">
              <button onClick={() => setEditing(null)}>取消</button>
              <button className="btn-primary" onClick={handleSave}>保存</button>
            </div>
          </div>
        )}

        <div className="ca-list">
          {loading ? <div className="ca-loading">加载中...</div> :
           actions.length === 0 ? <div className="ca-empty">暂无自定义操作，点击"新建"创建</div> :
           actions.map(a => (
            <div key={a.id} className={`ca-item ${outputLog?.id === a.id ? 'has-output' : ''}`}>
              <div className="ca-item-info">
                <span className="ca-name">{a.icon || '⚡'} {a.name}</span>
                <span className="ca-command">{a.command}</span>
                <div className="ca-tags">
                  {a.showInContextMenu && <span className="ca-tag">右键</span>}
                  {a.showInToolbar && <span className="ca-tag">工具栏</span>}
                  {a.shortcut && <span className="ca-tag ca-shortcut-tag">{a.shortcut}</span>}
                </div>
              </div>
              <div className="ca-item-actions">
                <button onClick={() => setEditing({ ...a })} title="编辑">✎</button>
                <button className="ca-run-btn" onClick={() => handleExecute(a.id)} disabled={executing === a.id} title="执行">
                  {executing === a.id ? '...' : '▶'}
                </button>
                <button className="btn-danger" onClick={() => handleDelete(a.id)} title="删除">✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* 执行输出 */}
        {outputLog && (
          <div className="ca-output">
            <div className="ca-output-header">
              <span>执行结果 ({outputLog.exitCode === 0 ? '成功' : `退出码 ${outputLog.exitCode}`})</span>
              <button onClick={() => setOutputLog(null)}>✕</button>
            </div>
            {outputLog.stdout && <pre className="ca-stdout">{outputLog.stdout}</pre>}
            {outputLog.stderr && <pre className="ca-stderr">{outputLog.stderr}</pre>}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 获取右键菜单中的自定义操作项
 * 供其他组件的 ContextMenu 使用
 */
export async function getCustomActionMenuItems(
  filePath?: string
): Promise<Array<{ id: string; label: string; onClick: () => void }>> {
  try {
    const actions: CustomAction[] = await window.electronAPI.git.listCustomActions();
    const contextActions = actions.filter(a => a.showInContextMenu);
    // 如果指定了文件路径，按 filePattern 过滤
    const filtered = filePath
      ? contextActions.filter(a => !a.filePattern || new RegExp(a.filePattern.replace(/\./g, '\\.').replace(/\*/g, '.*')).test(filePath))
      : contextActions;

    return filtered.map(a => ({
      id: `custom-action-${a.id}`,
      label: `${a.icon || '⚡'} ${a.name}${a.shortcut ? ` (${a.shortcut})` : ''}`,
      onClick: async () => {
        try {
          const result = await window.electronAPI.git.executeCustomAction(a.id);
          if (result.exitCode !== 0) {
            alert(`自定义操作失败 (${result.exitCode}): ${result.stderr}`);
          }
        } catch (e: any) { alert(e.message); }
      },
    }));
  } catch {
    return [];
  }
}

export default CustomActionsPanel;
