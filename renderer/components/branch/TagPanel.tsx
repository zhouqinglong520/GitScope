/**
 * 标签管理面板（增强版）
 * 支持推送标签、注释标签创建、标签详情
 */
import React, { useState, useEffect } from 'react';
import { useI18 } from '../../i18n';
import { useRepoStore } from '../../stores/repoStore';
import type { GitTag } from '@shared/types/git';

interface Props { visible: boolean; onClose: () => void; onRefresh: () => void; }

export const TagPanel: React.FC<Props> = ({ visible, onClose, onRefresh }) => {
  const { t } = useI18();
  const { tags } = useRepoStore();
  const [selectedTag, setSelectedTag] = useState<GitTag | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagRef, setTagRef] = useState('');
  const [tagMessage, setTagMessage] = useState('');
  const [isAnnotated, setIsAnnotated] = useState(true);
  const [pushing, setPushing] = useState<string | null>(null);
  const [signatureInfo, setSignatureInfo] = useState<Record<string, { valid: boolean; signer: string }>>({});
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => { if (visible && tags.length > 0) loadSignatures(); }, [visible, tags]);

  const loadSignatures = async () => {
    for (const tag of tags.slice(0, 20)) {
      try {
        const sig = await window.electronAPI.git.verifyCommitSignature(tag.oid);
        if (sig) setSignatureInfo(prev => ({ ...prev, [tag.oid]: { valid: sig.valid, signer: sig.signer } }));
      } catch { /* ignore */ }
    }
  };

  const handleCreateTag = async () => {
    if (!tagName.trim()) return;
    try {
      await window.electronAPI.git.createTag(
        tagName.trim(),
        tagRef.trim() || undefined,
        isAnnotated && tagMessage.trim() ? tagMessage.trim() : undefined
      );
      setTagName(''); setTagRef(''); setTagMessage('');
      setShowCreateDialog(false);
      onRefresh();
    } catch (e: any) { alert(`创建标签失败: ${e.message}`); }
  };

  const handlePushTag = async (tagName: string) => {
    setPushing(tagName);
    try {
      await window.electronAPI.git.pushTag(tagName);
      alert(`标签 ${tagName} 已推送到远程`);
    } catch (e: any) {
      alert(`推送标签失败: ${e.message}`);
    } finally {
      setPushing(null);
    }
  };

  const handlePushAllTags = async () => {
    if (!confirm('确定推送所有标签到远程?')) return;
    setPushing('__all__');
    try {
      await window.electronAPI.git.pushAllTags();
      alert('所有标签已推送到远程');
    } catch (e: any) {
      alert(`推送失败: ${e.message}`);
    } finally {
      setPushing(null);
    }
  };

  const handleDeleteTag = async (name: string) => {
    if (!confirm(`确定删除标签 ${name}?`)) return;
    try { await window.electronAPI.git.deleteTag(name); onRefresh(); setSelectedTag(null); }
    catch (e: any) { alert(`删除失败: ${e.message}`); }
  };

  const filteredTags = tags.filter(tag =>
    !searchFilter || tag.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const formatDate = (ts?: number) => ts ? new Date(ts * 1000).toLocaleDateString('zh-CN') : '';

  if (!visible) return null;

  return (
    <div className="tag-overlay">
      <div className="tag-dialog">
        <div className="tag-header">
          <h3>🏷 {t('tags.title') || '标签管理'}</h3>
          <div className="tag-header-actions">
            <button className="btn-sm" onClick={handlePushAllTags} disabled={pushing === '__all__'}>
              {pushing === '__all__' ? '⏳ 推送中...' : '⬆ 推送全部'}
            </button>
            <button className="btn-primary btn-sm" onClick={() => setShowCreateDialog(true)}>
              + 创建标签
            </button>
            <button className="btn-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* 搜索 */}
        <div className="tag-toolbar">
          <input type="text" placeholder="搜索标签..." value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)} className="tag-search" />
          <span className="tag-count">{filteredTags.length} / {tags.length}</span>
        </div>

        {/* 标签列表 + 详情 */}
        <div className="tag-content">
          <div className="tag-list">
            {filteredTags.length === 0 ? (
              <div className="empty">暂无标签</div>
            ) : (
              filteredTags.map(tag => (
                <div key={tag.name}
                  className={`tag-item ${selectedTag?.name === tag.name ? 'selected' : ''}`}
                  onClick={() => setSelectedTag(tag)}>
                  <div className="ti-name">
                    🏷 {tag.name}
                    {signatureInfo[tag.oid]?.valid && <span className="ti-signed" title="已验证签名">✓</span>}
                  </div>
                  <div className="ti-oid">{tag.oid?.substring(0, 7)}</div>
                  <div className="ti-actions">
                    <button className="btn-tiny" onClick={(e) => { e.stopPropagation(); handlePushTag(tag.name); }}
                      disabled={pushing === tag.name} title="推送到远程">
                      {pushing === tag.name ? '⏳' : '⬆'}
                    </button>
                    <button className="btn-tiny btn-danger-tiny" onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.name); }} title="删除">✕</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 详情面板 */}
          {selectedTag && (
            <div className="tag-detail">
              <div className="td-name">{selectedTag.name}</div>
              <div className="td-row">
                <span className="td-label">提交:</span>
                <span className="td-value font-mono">{selectedTag.oid?.substring(0, 12)}</span>
              </div>
              {selectedTag.tagger && (
                <>
                  <div className="td-row">
                    <span className="td-label">创建者:</span>
                    <span className="td-value">{selectedTag.tagger.name} &lt;{selectedTag.tagger.email}&gt;</span>
                  </div>
                  <div className="td-row">
                    <span className="td-label">日期:</span>
                    <span className="td-value">{formatDate(selectedTag.tagger.timestamp)}</span>
                  </div>
                </>
              )}
              {selectedTag.message && (
                <div className="td-message">
                  <span className="td-label">消息:</span>
                  <pre className="td-msg-content">{selectedTag.message}</pre>
                </div>
              )}
              {signatureInfo[selectedTag.oid] && (
                <div className="td-row">
                  <span className="td-label">签名:</span>
                  <span className={`td-value ${signatureInfo[selectedTag.oid].valid ? 'text-green-400' : 'text-red-400'}`}>
                    {signatureInfo[selectedTag.oid].valid ? '✓ 有效' : '✗ 无效'} — {signatureInfo[selectedTag.oid].signer}
                  </span>
                </div>
              )}
              <div className="td-actions">
                <button className="btn-primary btn-sm" onClick={() => handlePushTag(selectedTag.name)}>
                  ⬆ 推送到远程
                </button>
                <button className="btn-danger btn-sm" onClick={() => handleDeleteTag(selectedTag.name)}>
                  🗑 删除
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 创建标签对话框 */}
        {showCreateDialog && (
          <div className="tag-create-dialog">
            <h4>创建标签</h4>
            <div className="tc-field">
              <label>标签名</label>
              <input type="text" value={tagName} onChange={e => setTagName(e.target.value)}
                placeholder="v1.0.0" className="tc-input" />
            </div>
            <div className="tc-field">
              <label>提交 SHA（可选，默认 HEAD）</label>
              <input type="text" value={tagRef} onChange={e => setTagRef(e.target.value)}
                placeholder="HEAD" className="tc-input" />
            </div>
            <div className="tc-field">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isAnnotated} onChange={e => setIsAnnotated(e.target.checked)} />
                注释标签（Annotated）
              </label>
            </div>
            {isAnnotated && (
              <div className="tc-field">
                <label>标签消息</label>
                <textarea value={tagMessage} onChange={e => setTagMessage(e.target.value)}
                  placeholder="Release v1.0.0" className="tc-textarea" rows={3} />
              </div>
            )}
            <div className="tc-actions">
              <button className="btn-sm" onClick={() => setShowCreateDialog(false)}>取消</button>
              <button className="btn-primary" onClick={handleCreateTag} disabled={!tagName.trim()}>创建</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default TagPanel;
