'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Archive,
  Eye,
  EyeOff,
  FileText,
  List,
  Loader2,
  Pencil,
  Rocket,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { siteDocuments } from '../../../lib/api';
import { StatusPill, WorkbenchTableState } from '../../../components/WorkbenchCore';

export type SiteDocumentPermissionState = {
  canView: boolean;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canPublish: boolean;
};

export const EMPTY_SITE_DOCUMENT_PERMISSIONS: SiteDocumentPermissionState = {
  canView: false,
  canRead: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
  canPublish: false,
};

export function getSiteDocumentPermissions(
  session: { role?: string; permissions?: string[] } | null | undefined
) {
  const permissions = new Set(session?.permissions || []);
  const elevated =
    session?.role === 'platform_admin' || session?.role === 'hq_admin' || permissions.has('*');
  const has = (permission: string) => elevated || permissions.has(permission);
  return {
    canView: has('site.documentation.view'),
    canRead: has('site.documentation.read'),
    canCreate: has('site.documentation.create'),
    canUpdate: has('site.documentation.update'),
    canDelete: has('site.documentation.delete'),
    canPublish: has('site.documentation.publish'),
  };
}

type Scope = 'residential' | 'commercial';
type CategoryScope = Scope | 'all';
type CategoryStatus = 'active' | 'inactive';
type DocumentStatus = 'draft' | 'published' | 'hidden' | 'archived';
type Category = {
  id: string;
  name: string;
  slug: string;
  scope: CategoryScope;
  sortOrder: number;
  status: CategoryStatus;
};
type Document = {
  id: string;
  categoryId: string;
  displayName: string;
  originalFilename: string;
  sizeBytes: number;
  scope: Scope;
  status: DocumentStatus;
};

function formatSize(value: number) {
  const bytes = Math.max(Number(value) || 0, 0);
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Number(kb.toFixed(kb >= 10 ? 1 : 2))} KB`;
  return `${Number((kb / 1024).toFixed(kb >= 10240 ? 1 : 2))} MB`;
}

function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').replace(/^data:[^;]+;base64,/, ''));
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

function statusTone(status: DocumentStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'published') return 'success';
  if (status === 'draft') return 'warning';
  if (status === 'archived') return 'danger';
  return 'neutral';
}

export default function SiteDocumentPanel({
  siteCode,
  permissions,
}: {
  siteCode: string;
  permissions: SiteDocumentPermissionState;
}) {
  const [scope, setScope] = useState<Scope>('residential');
  const [categories, setCategories] = useState<Category[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    null
  );
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryScope, setCategoryScope] = useState<CategoryScope>('residential');
  const [categoryStatus, setCategoryStatus] = useState<CategoryStatus>('active');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadSortOrder, setUploadSortOrder] = useState('0');
  const [editingDocument, setEditingDocument] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleCategories = useMemo(
    () => categories.filter((item) => item.scope === 'all' || item.scope === scope),
    [categories, scope]
  );

  const load = useCallback(async () => {
    if (!permissions.canRead) return;
    setLoading(true);
    try {
      const [categoryResult, documentResult] = await Promise.all([
        siteDocuments.categories(siteCode),
        siteDocuments.list(siteCode, { scope }),
      ]);
      const nextCategories = Array.isArray(categoryResult) ? (categoryResult as Category[]) : [];
      const nextDocuments = Array.isArray((documentResult as any)?.items)
        ? ((documentResult as any).items as Document[])
        : [];
      setCategories(nextCategories);
      setDocuments(nextDocuments);
      setUploadCategory(
        (current) =>
          current ||
          nextCategories.find(
            (item) => item.status === 'active' && (item.scope === 'all' || item.scope === scope)
          )?.id ||
          ''
      );
    } catch (error) {
      setFeedback({ tone: 'error', text: (error as Error).message || '官网资料加载失败' });
    } finally {
      setLoading(false);
    }
  }, [permissions.canRead, scope, siteCode]);

  useEffect(() => {
    load();
  }, [load]);

  async function createCategory(event: FormEvent) {
    event.preventDefault();
    if (!permissions.canCreate || !categoryName.trim() || busy) return;
    setBusy(true);
    try {
      await siteDocuments.createCategory(siteCode, {
        name: categoryName.trim(),
        scope: categoryScope,
        status: categoryStatus,
      });
      setCategoryName('');
      setCategoryScope(scope);
      setCategoryStatus('active');
      setFeedback({ tone: 'success', text: '资料分类已新增' });
      await load();
    } catch (error) {
      setFeedback({ tone: 'error', text: (error as Error).message || '资料分类保存失败' });
    } finally {
      setBusy(false);
    }
  }

  async function updateCategory(category: Category, patch: Partial<Category>) {
    if (!permissions.canUpdate || busy) return;
    setBusy(true);
    try {
      await siteDocuments.updateCategory(siteCode, category.id, {
        name: patch.name ?? category.name,
        scope: patch.scope ?? category.scope,
        status: patch.status ?? category.status,
      });
      setEditingCategory(null);
      setFeedback({ tone: 'success', text: '资料分类已更新' });
      await load();
    } catch (error) {
      setFeedback({ tone: 'error', text: (error as Error).message || '资料分类更新失败' });
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(category: Category) {
    if (!permissions.canDelete || !window.confirm(`确认删除分类“${category.name}”？`)) return;
    setBusy(true);
    try {
      await siteDocuments.deleteCategory(siteCode, category.id);
      setFeedback({ tone: 'success', text: '资料分类已删除' });
      await load();
    } catch (error) {
      setFeedback({ tone: 'error', text: (error as Error).message || '资料分类删除失败' });
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!permissions.canCreate || !uploadFile || !uploadCategory || busy) return;
    setBusy(true);
    try {
      const created = (await siteDocuments.upload(siteCode, {
        categoryId: uploadCategory,
        displayName: uploadName.trim() || uploadFile.name,
        filename: uploadFile.name,
        mimeType: uploadFile.type || 'application/octet-stream',
        dataBase64: await readBase64(uploadFile),
        scope,
        sortOrder: Number(uploadSortOrder) || 0,
      })) as any;
      if (permissions.canPublish && created?.id) await siteDocuments.publish(siteCode, created.id);
      setFeedback({
        tone: 'success',
        text: permissions.canPublish ? '资料已上传并发布' : '资料已上传为草稿',
      });
      setUploadFile(null);
      setUploadName('');
      setUploadSortOrder('0');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch (error) {
      setFeedback({ tone: 'error', text: (error as Error).message || '资料上传失败' });
    } finally {
      setBusy(false);
    }
  }

  async function saveDocument(document: Document) {
    if (!permissions.canUpdate || !editName.trim() || !editCategory || busy) return;
    setBusy(true);
    try {
      await siteDocuments.update(siteCode, document.id, {
        displayName: editName.trim(),
        categoryId: editCategory,
      });
      setEditingDocument(null);
      setFeedback({ tone: 'success', text: '资料信息已更新' });
      await load();
    } catch (error) {
      setFeedback({ tone: 'error', text: (error as Error).message || '资料更新失败' });
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(document: Document) {
    const publish = document.status !== 'published';
    if ((publish ? !permissions.canPublish : !permissions.canUpdate) || busy) return;
    setBusy(true);
    try {
      if (publish) await siteDocuments.publish(siteCode, document.id);
      else await siteDocuments.hide(siteCode, document.id);
      setFeedback({ tone: 'success', text: publish ? '资料已发布' : '资料已隐藏' });
      await load();
    } catch (error) {
      setFeedback({ tone: 'error', text: (error as Error).message || '资料状态更新失败' });
    } finally {
      setBusy(false);
    }
  }

  async function archive(document: Document) {
    if (!permissions.canDelete || !window.confirm(`确认归档“${document.displayName}”？`)) return;
    setBusy(true);
    try {
      await siteDocuments.archive(siteCode, document.id);
      setFeedback({ tone: 'success', text: '资料已归档' });
      await load();
    } catch (error) {
      setFeedback({ tone: 'error', text: (error as Error).message || '资料归档失败' });
    } finally {
      setBusy(false);
    }
  }

  if (!permissions.canRead) {
    return (
      <WorkbenchTableState
        type="empty"
        title="无官网资料查看权限"
        description="请联系管理员配置官网资料库权限。"
      />
    );
  }

  return (
    <div className="official-site-panel site-document-panel">
      <div className="official-site-panel-head">
        <div>
          <p className="t-label">官网资料库</p>
          <h3>技术文档与下载文件</h3>
        </div>
        <div className="brand-content-switch" aria-label="资料适用范围">
          <button
            type="button"
            className={scope === 'residential' ? 'is-active' : undefined}
            onClick={() => setScope('residential')}
          >
            家用
          </button>
          <button
            type="button"
            className={scope === 'commercial' ? 'is-active' : undefined}
            onClick={() => setScope('commercial')}
          >
            商用
          </button>
        </div>
      </div>
      {feedback && (
        <div className={`brand-console-notice ${feedback.tone}`} role="status">
          {feedback.text}
        </div>
      )}
      {(permissions.canCreate || permissions.canUpdate || permissions.canDelete) && (
        <section className="official-site-section">
          <div className="official-site-section-head">
            <h4>
              <List size={15} />
              资料分类
            </h4>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setCategoryModal((value) => !value)}
            >
              <List size={13} />
              管理分类
            </button>
          </div>
          {categoryModal && (
            <div className="site-document-category-editor">
              {permissions.canCreate && (
                <form onSubmit={createCategory} className="site-document-category-form">
                  <input
                    className="input"
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    placeholder="新分类名称"
                    aria-label="新分类名称"
                  />
                  <select
                    className="input"
                    value={categoryScope}
                    onChange={(event) => setCategoryScope(event.target.value as CategoryScope)}
                    aria-label="分类范围"
                  >
                    <option value="residential">家用</option>
                    <option value="commercial">商用</option>
                    <option value="all">全部</option>
                  </select>
                  <select
                    className="input"
                    value={categoryStatus}
                    onChange={(event) => setCategoryStatus(event.target.value as CategoryStatus)}
                    aria-label="分类状态"
                  >
                    <option value="active">启用</option>
                    <option value="inactive">停用</option>
                  </select>
                  <button
                    type="submit"
                    className="btn btn-brand btn-sm"
                    disabled={busy || !categoryName.trim()}
                  >
                    <Save size={13} />
                    新增
                  </button>
                </form>
              )}
              <div className="site-document-category-list">
                {categories
                  .filter((item) => item.scope === 'all' || item.scope === scope)
                  .map((category) => {
                    const editing = editingCategory === category.id;
                    return (
                      <div className="site-document-category-row" key={category.id}>
                        {editing ? (
                          <input
                            className="input"
                            value={editingCategoryName}
                            aria-label={`编辑分类 ${category.name}`}
                            onChange={(event) => setEditingCategoryName(event.target.value)}
                          />
                        ) : (
                          <strong>{category.name}</strong>
                        )}
                        <span className="muted-value">
                          {category.scope === 'all'
                            ? '全部'
                            : category.scope === 'residential'
                              ? '家用'
                              : '商用'}
                        </span>
                        <StatusPill tone={category.status === 'active' ? 'success' : 'neutral'}>
                          {category.status === 'active' ? '启用' : '停用'}
                        </StatusPill>
                        <div className="table-actions">
                          {permissions.canUpdate && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm icon-only"
                              title={category.status === 'active' ? '停用分类' : '启用分类'}
                              aria-label={category.status === 'active' ? '停用分类' : '启用分类'}
                              onClick={() =>
                                updateCategory(category, {
                                  status: category.status === 'active' ? 'inactive' : 'active',
                                })
                              }
                            >
                              {category.status === 'active' ? (
                                <EyeOff size={13} />
                              ) : (
                                <Eye size={13} />
                              )}
                            </button>
                          )}
                          {permissions.canUpdate && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm icon-only"
                              title="编辑分类"
                              aria-label="编辑分类"
                              onClick={() => {
                                setEditingCategory(editing ? null : category.id);
                                setEditingCategoryName(editing ? '' : category.name);
                              }}
                            >
                              {editing ? <X size={13} /> : <Pencil size={13} />}
                            </button>
                          )}
                          {editing && permissions.canUpdate && (
                            <button
                              type="button"
                              className="btn btn-brand btn-sm icon-only"
                              title="保存分类"
                              aria-label="保存分类"
                              onClick={() =>
                                updateCategory(category, { name: editingCategoryName.trim() })
                              }
                              disabled={!editingCategoryName.trim()}
                            >
                              <Save size={13} />
                            </button>
                          )}
                          {permissions.canDelete && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm icon-only btn-danger"
                              title="删除分类"
                              aria-label="删除分类"
                              onClick={() => deleteCategory(category)}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </section>
      )}
      {permissions.canCreate && (
        <section className="official-site-section">
          <div className="official-site-section-head">
            <h4>
              <Upload size={15} />
              上传资料
            </h4>
          </div>
          <form className="site-document-upload-form" onSubmit={upload}>
            <input
              ref={fileInputRef}
              className="input"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.dwg,.dxf,.rfa"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setUploadFile(file);
                if (file && !uploadName) setUploadName(file.name);
              }}
              aria-label="选择资料文件"
            />
            <input
              className="input"
              value={uploadName}
              onChange={(event) => setUploadName(event.target.value)}
              placeholder="官网显示名称"
              aria-label="官网显示名称"
            />
            <select
              className="input"
              value={uploadCategory}
              onChange={(event) => setUploadCategory(event.target.value)}
              aria-label="资料分类"
            >
              <option value="">选择分类</option>
              {visibleCategories
                .filter((item) => item.status === 'active')
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
            <input
              className="input"
              type="number"
              min="0"
              value={uploadSortOrder}
              onChange={(event) => setUploadSortOrder(event.target.value)}
              aria-label="资料排序"
            />
            <button
              type="submit"
              className="btn btn-brand btn-sm"
              disabled={busy || !uploadFile || !uploadCategory}
            >
              {busy ? <Loader2 size={13} className="spin" /> : <Upload size={13} />}
              {permissions.canPublish ? '上传并发布' : '上传草稿'}
            </button>
          </form>
        </section>
      )}
      <section className="official-site-section">
        <div className="official-site-section-head">
          <h4>
            <FileText size={15} />
            资料列表
          </h4>
          <span className="muted-value">{documents.length} 份</span>
        </div>
        <div className="table-wrap">
          <table className="table site-document-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>分类</th>
                <th>大小</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>正在加载资料...</td>
                </tr>
              ) : documents.length ? (
                documents.map((document) => {
                  const editing = editingDocument === document.id;
                  const category = categories.find((item) => item.id === document.categoryId);
                  return (
                    <tr key={document.id}>
                      <td>
                        {editing ? (
                          <input
                            className="input"
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            aria-label="编辑资料名称"
                          />
                        ) : (
                          <>
                            <strong>{document.displayName}</strong>
                            <small>{document.originalFilename}</small>
                          </>
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <select
                            className="input"
                            value={editCategory}
                            onChange={(event) => setEditCategory(event.target.value)}
                            aria-label="编辑资料分类"
                          >
                            {visibleCategories
                              .filter((item) => item.status === 'active')
                              .map((item) => (
                                <option value={item.id} key={item.id}>
                                  {item.name}
                                </option>
                              ))}
                          </select>
                        ) : (
                          category?.name || '未分类'
                        )}
                      </td>
                      <td>{formatSize(document.sizeBytes)}</td>
                      <td>
                        <StatusPill tone={statusTone(document.status)}>
                          {document.status === 'published'
                            ? '已发布'
                            : document.status === 'draft'
                              ? '草稿'
                              : document.status === 'hidden'
                                ? '已隐藏'
                                : '已归档'}
                        </StatusPill>
                      </td>
                      <td>
                        <div className="table-actions">
                          {editing ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-brand btn-sm icon-only"
                                title="保存资料"
                                aria-label="保存资料"
                                onClick={() => saveDocument(document)}
                              >
                                <Save size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm icon-only"
                                title="取消编辑"
                                aria-label="取消编辑"
                                onClick={() => setEditingDocument(null)}
                              >
                                <X size={13} />
                              </button>
                            </>
                          ) : (
                            permissions.canUpdate && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm icon-only"
                                title="编辑资料"
                                aria-label="编辑资料"
                                onClick={() => {
                                  setEditingDocument(document.id);
                                  setEditName(document.displayName);
                                  setEditCategory(document.categoryId);
                                }}
                              >
                                <Pencil size={13} />
                              </button>
                            )
                          )}
                          {(document.status === 'published'
                            ? permissions.canUpdate
                            : permissions.canPublish) && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm icon-only"
                              title={document.status === 'published' ? '隐藏资料' : '发布资料'}
                              aria-label={document.status === 'published' ? '隐藏资料' : '发布资料'}
                              onClick={() => setStatus(document)}
                            >
                              {document.status === 'published' ? (
                                <EyeOff size={13} />
                              ) : (
                                <Rocket size={13} />
                              )}
                            </button>
                          )}
                          {permissions.canDelete && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm icon-only btn-danger"
                              title="归档资料"
                              aria-label="归档资料"
                              onClick={() => archive(document)}
                            >
                              <Archive size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5}>
                    <WorkbenchTableState
                      type="empty"
                      title="暂无官网资料"
                      description="上传并发布资料后，官网将显示可下载内容。"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <style jsx>{`
        .site-document-panel {
          display: grid;
          gap: 16px;
          padding: 18px 20px 24px;
        }
        .official-site-panel-head,
        .official-site-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .official-site-section {
          display: grid;
          gap: 12px;
          padding-top: 14px;
          border-top: 1px solid var(--border-subtle);
        }
        .official-site-section-head h4 {
          display: flex;
          align-items: center;
          gap: 7px;
          margin: 0;
        }
        .site-document-category-editor {
          display: grid;
          gap: 10px;
        }
        .site-document-category-form,
        .site-document-upload-form {
          display: grid;
          grid-template-columns: minmax(180px, 1fr) 150px 120px auto;
          gap: 8px;
          align-items: center;
        }
        .site-document-upload-form {
          grid-template-columns: minmax(220px, 1.2fr) minmax(160px, 1fr) 180px 90px auto;
        }
        .site-document-category-list {
          display: grid;
          gap: 6px;
        }
        .site-document-category-row {
          display: grid;
          grid-template-columns: minmax(160px, 1fr) 90px 75px auto;
          gap: 9px;
          align-items: center;
          padding: 7px 9px;
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
        }
        .site-document-table th:nth-child(1) {
          width: 34%;
        }
        .site-document-table th:nth-child(2) {
          width: 20%;
        }
        .site-document-table th:nth-child(3) {
          width: 12%;
        }
        .site-document-table th:nth-child(4) {
          width: 14%;
        }
        .site-document-table td strong,
        .site-document-table td small {
          display: block;
        }
        .table-actions {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          white-space: nowrap;
        }
        @media (max-width: 850px) {
          .site-document-category-form,
          .site-document-upload-form {
            grid-template-columns: 1fr 1fr;
          }
          .site-document-category-row {
            grid-template-columns: 1fr auto;
          }
          .site-document-category-row .table-actions {
            grid-column: 1/-1;
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
