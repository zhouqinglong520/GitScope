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
  /** P2-9: 自定义命令 checkbox — 执行前可选参数 */
  params?: Array<{ name: string; label: string; type: 'checkbox' | 'input'; defaultValue?: string | boolean; checked?: boolean }>;
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
            {/* P2-9: 自定义命令参数（checkbox / input） */}
            <div className="ca-editor-row" style={{ flexDirection: 'column', gap: 4 }}>
              <label>执行参数（P2-9）</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(editing.params || []).map((p, pi) => (
                  <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#0d1117', padding: '2px 8px', borderRadius: 4, border: '1px solid #30363d' }}>
                    {p.type === 'checkbox' ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#8b949e', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!p.checked} onChange={e => {
                          const params = [...(editing.params || [])];
                          params[pi] = { ...params[pi], checked: e.target.checked };
                          setEditing({ ...editing, params });
                        }} />
                        {p.label}
                      </label>
                    ) : (
                      <input placeholder={p.label} value={p.defaultValue as string || ''} onChange={e => {
                        const params = [...(editing.params || [])];
                        params[pi] = { ...params[pi], defaultValue: e.target.value };
                        setEditing({ ...editing, params });
                      }} style={{ fontSize: 11, background: '#0d1117', border: 'none', color: '#e6edf3', outline: 'none', width: 80 }} />
                    )}
                    <button onClick={() => {
                      const params = (editing.params || []).filter((_, i) => i !== pi);
                      setEditing({ ...editing, params });
                    }} style={{ background: 'none', border: 'none', color: '#f85149', cursor: 'pointer', fontSize: 10 }}>✕</button>
                  </div>
                ))}
                <button onClick={() => {
                  const params = [...(editing.params || []), { name: `param${(editing.params || []).length}`, label: '参数', type: 'checkbox' as const, checked: false }];
                  setEditing({ ...editing, params });
                }} style={{ fontSize: 10, padding: '2px 8px', background: '#21262d', color: '#8b949e', border: '1px solid #30363d', borderRadius: 4, cursor: 'pointer' }}>+ checkbox</button>
                <button onClick={() => {
                  const params = [...(editing.params || []), { name: `param${(editing.params || []).length}`, label: '值', type: 'input' as const, defaultValue: '' }];
                  setEditing({ ...editing, params });
                }} style={{ fontSize: 10, padding: '2px 8px', background: '#21262d', color: '#8b949e', border: '1px solid #30363d', borderRadius: 4, cursor: 'pointer' }}>+ input</button>
              </div>
            </div>
            <div className="ca-editor-actions">
              <button onClick={() => setEditing(null)}>取消</button>
              <button className="btn-primary" onClick={handleSave}>保存</button>
            </div>
          </div>
        )}

        <div className="ca-list">
       