/**
 * 自定义操作管理面板
 * 创建、编辑、删除自定义 Shell 命令操作
 */
import React, { useState, useEffect } from 'react';
import './CustomActionsPanel.css';

interface CustomAction {
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
    try {
      const result = await window.electronAPI.git.executeCustomAction(id);
      alert(result.exitCode === 0 ? `✅ 成功\n${result.stdout}` : `❌ 失败 (code ${result.exitCode})\n${result.stderr}`);
    } catch (e: any) { alert(e.message); }
    finally { setExecuting(null); }
  };

  if (!visible) return null;

  return (
    <div className="ca-overlay">
      <div className="ca-dialog">
        <div className="ca-header">
          <h3>自定义操作</h3>
          <button className="btn-add" onClick={() => setEditing({ ...newAction, id: `action-${Date.now()}` })}>+ 新建</button>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {editing && (
          <div className="ca-editor">
            <input placeholder="名称" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            <input placeholder="命令" value={editing.command} onChange={e => setEditing({ ...editing, command: e.target.value })} />
            <input placeholder="工作目录（可选）" value={editing.workingDir || ''} onChange={e => setEditing({ ...editing, workingDir: e.target.value })} />
            <input placeholder="快捷键（可选）" value={editing.shortcut || ''} onChange={e => setEditing({ ...editing, shortcut: e.target.value })} />
            <input placeholder="文件匹配模式（可选，如 *.js）" value={editing.filePattern || ''} onChange={e => setEditing({ ...editing, filePattern: e.target.value })} />
            <div className="ca-checkboxes">
              <label><input type="checkbox" checked={editing.showInContextMenu} onChange={e => setEditing({ ...editing, showInContextMenu: e.target.checked })} />上下文菜单</label>
              <label><input type="checkbox" checked={editing.showInToolbar} onChange={e => setEditing({ ...editing, showInToolbar: e.target.checked })} />工具栏</label>
            </div>
            <div className="ca-editor-actions">
              <button onClick={() => setEditing(null)}>取消</button>
              <button className="btn-primary" onClick={handleSave}>保存</button>
            </div>
          </div>
        )}

        <div className="ca-list">
          {loading ? <div>加载中...</div> :
           actions.map(a => (
            <div key={a.id} className="ca-item">
              <div className="ca-item-info">
                <span className="ca-name">{a.icon || '⚡'} {a.name}</span>
                <span className="ca-command">{a.command}</span>
                {a.shortcut && <span className="ca-shortcut">{a.shortcut}</span>}
              </div>
              <div className="ca-item-actions">
                <button onClick={() => setEditing({ ...a })}>编辑</button>
                <button onClick={() => handleExecute(a.id)} disabled={executing === a.id}>▶</button>
                <button className="btn-danger" onClick={() => handleDelete(a.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default CustomActionsPanel;
