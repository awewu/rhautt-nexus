'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { getPCA } from 'lcn';
import { siteDealers } from '../../../lib/api';
import {
  StatusPill,
  WorkbenchFilterToolbar,
  WorkbenchPaginationFooter,
  WorkbenchTableShell,
  WorkbenchTableState,
} from '../../../components/WorkbenchCore';

type DealerStatus = 'active' | 'inactive';
type DealerRow = {
  id: string;
  name: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  phone?: string;
  dealerType?: string;
  services?: string[];
  certifications?: string[];
  latitude?: number | null;
  longitude?: number | null;
  sortOrder: number;
  status: DealerStatus;
};
type DealerDraft = {
  name: string;
  province: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  dealerType: string;
  services: string;
  certifications: string;
  latitude: string;
  longitude: string;
  sortOrder: string;
  status: DealerStatus;
};
type DealerCityOption = {
  code: string;
  name: string;
  districts: string[];
};
type DealerProvinceOption = {
  code: string;
  name: string;
  cities: DealerCityOption[];
};
type DealerLcnNode = {
  code?: string;
  name?: string;
  children?: DealerLcnNode[];
};

const EMPTY_DRAFT: DealerDraft = {
  name: '',
  province: '',
  city: '',
  district: '',
  address: '',
  phone: '',
  dealerType: '',
  services: '',
  certifications: '',
  latitude: '',
  longitude: '',
  sortOrder: '0',
  status: 'active',
};

const REGION_OPTIONS: DealerProvinceOption[] = (getPCA() as DealerLcnNode[])
  .map((provinceItem) => ({
    code: String(provinceItem.code || ''),
    name: String(provinceItem.name || ''),
    cities: (provinceItem.children || []).map((cityItem) => ({
      code: String(cityItem.code || ''),
      name: String(cityItem.name || ''),
      districts: (cityItem.children || [])
        .map((districtItem) => String(districtItem.name || ''))
        .filter(Boolean),
    })),
  }))
  .filter((provinceItem) => provinceItem.code && provinceItem.name);

function listText(value: string) {
  return [
    ...new Set(
      value
        .split(/[,，、\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

function shortText(value: string, max = 54) {
  const clean = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

function trimRegionName(value: string | undefined | null) {
  return String(value || '').trim();
}

function stripRegionSuffix(value: string) {
  return value.replace(
    /(特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|自治州|自治县|地区|盟|省|市|区|县)$/u,
    ''
  );
}

function sameRegionName(source: string, target: string) {
  const cleanSource = trimRegionName(source);
  const cleanTarget = trimRegionName(target);
  if (!cleanSource || !cleanTarget) return false;
  return (
    cleanSource === cleanTarget || stripRegionSuffix(cleanSource) === stripRegionSuffix(cleanTarget)
  );
}

function uniqueOptions(values: Array<string | undefined | null>) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function findProvinceOption(provinceName: string) {
  return REGION_OPTIONS.find((item) => item.name === provinceName);
}

function findCityOption(provinceName: string, cityName: string) {
  return findProvinceOption(provinceName)?.cities.find((item) => item.name === cityName);
}

function normalizeProvinceName(provinceName: string | undefined) {
  const clean = trimRegionName(provinceName);
  if (!clean) return '';
  return REGION_OPTIONS.find((item) => sameRegionName(item.name, clean))?.name || clean;
}

function normalizeCityName(provinceName: string, cityName: string | undefined) {
  const clean = trimRegionName(cityName);
  if (!clean) return '';
  const provinceOption = findProvinceOption(provinceName);
  return provinceOption?.cities.find((item) => sameRegionName(item.name, clean))?.name || clean;
}

function normalizeDistrictName(
  provinceName: string,
  cityName: string,
  districtName: string | undefined
) {
  const clean = trimRegionName(districtName);
  if (!clean) return '';
  const cityOption = findCityOption(provinceName, cityName);
  return cityOption?.districts.find((item) => sameRegionName(item, clean)) || clean;
}

function draftFromRow(row: DealerRow): DealerDraft {
  const province = normalizeProvinceName(row.province);
  const city = normalizeCityName(province, row.city);
  const district = normalizeDistrictName(province, city, row.district);
  return {
    name: row.name || '',
    province,
    city,
    district,
    address: row.address || '',
    phone: row.phone || '',
    dealerType: row.dealerType || '',
    services: (row.services || []).join(', '),
    certifications: (row.certifications || []).join(', '),
    latitude: row.latitude == null ? '' : String(row.latitude),
    longitude: row.longitude == null ? '' : String(row.longitude),
    sortOrder: String(row.sortOrder || 0),
    status: row.status || 'active',
  };
}

export default function SiteDealerPanel({
  siteCode,
  permissions,
}: {
  siteCode: string;
  permissions: { canCreate: boolean; canUpdate: boolean; canDelete: boolean };
}) {
  const [items, setItems] = useState<DealerRow[]>([]);
  const [keyword, setKeyword] = useState('');
  const [province, setProvince] = useState('');
  const [service, setService] = useState('');
  const [status, setStatus] = useState<'all' | DealerStatus>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<DealerDraft>(EMPTY_DRAFT);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    null
  );

  const provinceOptions = useMemo(
    () =>
      uniqueOptions([
        ...REGION_OPTIONS.map((item) => item.name),
        ...items.map((item) => normalizeProvinceName(item.province)),
        normalizeProvinceName(province),
        draft.province,
      ]),
    [draft.province, items, province]
  );
  const cityOptions = useMemo(() => {
    const preset = findProvinceOption(draft.province)?.cities.map((item) => item.name) || [];
    const existing = items
      .filter((item) => !draft.province || normalizeProvinceName(item.province) === draft.province)
      .map((item) => normalizeCityName(draft.province, item.city));
    return uniqueOptions([...preset, ...existing, draft.city]);
  }, [draft.city, draft.province, items]);
  const districtOptions = useMemo(() => {
    const preset = findCityOption(draft.province, draft.city)?.districts || [];
    const existing = items
      .filter((item) => {
        const itemProvince = normalizeProvinceName(item.province);
        const itemCity = normalizeCityName(itemProvince, item.city);
        return (
          (!draft.province || itemProvince === draft.province) &&
          (!draft.city || itemCity === draft.city)
        );
      })
      .map((item) => normalizeDistrictName(draft.province, draft.city, item.district));
    return uniqueOptions([...preset, ...existing, draft.district]);
  }, [draft.city, draft.district, draft.province, items]);
  const query = useMemo(
    () => ({
      page: String(page),
      pageSize: String(pageSize),
      q: keyword,
      status,
      ...(province ? { province } : {}),
      ...(service ? { service } : {}),
    }),
    [keyword, page, pageSize, province, service, status]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = (await siteDealers.list(siteCode, query)) as any;
      const data = result?.data || result || {};
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
    } catch (error) {
      setItems([]);
      setTotal(0);
      setFeedback({ tone: 'error', text: (error as Error).message || '服务网点加载失败' });
    } finally {
      setLoading(false);
    }
  }, [query, siteCode]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (key: keyof DealerDraft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const updateDraftProvince = (value: string) => {
    const selectedProvince = findProvinceOption(value);
    setDraft((current) => ({
      ...current,
      province: value,
      city: selectedProvince?.cities.length === 1 ? selectedProvince.cities[0]?.name || '' : '',
      district: '',
    }));
  };
  const updateDraftCity = (value: string) =>
    setDraft((current) => ({
      ...current,
      city: value,
      district: '',
    }));
  const startCreate = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setEditorOpen(true);
  };
  const startEdit = (row: DealerRow) => {
    setEditingId(row.id);
    setEditorOpen(true);
    setDraft(draftFromRow(row));
  };
  const closeEditor = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setEditorOpen(false);
  };

  async function save() {
    if ((!editingId && !permissions.canCreate) || (editingId && !permissions.canUpdate) || busy)
      return;
    if (!draft.name.trim()) {
      setFeedback({ tone: 'error', text: '请填写服务网点名称' });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: draft.name.trim(),
        province: draft.province.trim(),
        city: draft.city.trim(),
        district: draft.district.trim(),
        address: draft.address.trim(),
        phone: draft.phone.trim(),
        dealerType: draft.dealerType.trim(),
        services: listText(draft.services),
        certifications: listText(draft.certifications),
        latitude: draft.latitude.trim() ? Number(draft.latitude) : null,
        longitude: draft.longitude.trim() ? Number(draft.longitude) : null,
        sortOrder: Math.max(Number(draft.sortOrder) || 0, 0),
        status: draft.status,
      };
      if (editingId) await siteDealers.update(siteCode, editingId, payload);
      else await siteDealers.create(siteCode, payload);
      setFeedback({ tone: 'success', text: editingId ? '服务网点已保存' : '服务网点已新增' });
      closeEditor();
      await load();
    } catch (error) {
      setFeedback({ tone: 'error', text: (error as Error).message || '服务网点保存失败' });
    } finally {
      setBusy(false);
    }
  }

  async function archive(row: DealerRow) {
    if (!permissions.canDelete || !window.confirm(`确认归档“${row.name}”？`)) return;
    setBusy(true);
    try {
      await siteDealers.archive(siteCode, row.id);
      setFeedback({ tone: 'success', text: '服务网点已归档' });
      await load();
    } catch (error) {
      setFeedback({ tone: 'error', text: (error as Error).message || '服务网点归档失败' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="official-site-panel site-dealer-panel">
      <div className="official-site-panel-head">
        <div>
          <p className="t-label">服务网点管理</p>
          <h3>
            <MapPin size={16} />
            官网查找经销商
          </h3>
          <p className="muted-value">维护官网公开展示的授权经销商与安装服务网点。</p>
        </div>
        <div>
          {permissions.canCreate && (
            <button type="button" className="btn btn-brand btn-sm" onClick={startCreate}>
              <Plus size={13} />
              新增网点
            </button>
          )}
        </div>
      </div>
      <WorkbenchFilterToolbar>
        <input
          className="input"
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setPage(1);
          }}
          placeholder="搜索名称、电话、城市或地址"
          aria-label="搜索服务网点"
        />
        <select
          className="input"
          value={province}
          onChange={(event) => {
            setProvince(event.target.value);
            setPage(1);
          }}
          aria-label="省份筛选"
        >
          <option value="">全部省份</option>
          {provinceOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={service}
          onChange={(event) => {
            setService(event.target.value);
            setPage(1);
          }}
          aria-label="服务筛选"
        >
          <option value="">全部服务</option>
          {['家用', '商用', '安装', '售后'].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as 'all' | DealerStatus);
            setPage(1);
          }}
          aria-label="状态筛选"
        >
          <option value="all">全部状态</option>
          <option value="active">启用</option>
          <option value="inactive">停用</option>
        </select>
        <button type="button" className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} />
          刷新
        </button>
      </WorkbenchFilterToolbar>
      {feedback && (
        <div className={`brand-console-notice ${feedback.tone}`} role="status">
          {feedback.text}
        </div>
      )}
      {editorOpen && (
        <div className="site-dealer-editor">
          <div className="official-site-section-head">
            <h4>{editingId ? '编辑服务网点' : '新增服务网点'}</h4>
            <button
              type="button"
              className="btn btn-outline btn-sm icon-only"
              onClick={closeEditor}
              aria-label="关闭编辑"
            >
              <X size={13} />
            </button>
          </div>
          <div className="site-dealer-form">
            <label>
              名称
              <input
                className="input"
                value={draft.name}
                onChange={(event) => update('name', event.target.value)}
              />
            </label>
            <label>
              电话
              <input
                className="input"
                value={draft.phone}
                onChange={(event) => update('phone', event.target.value)}
              />
            </label>
            <label>
              省份
              <select
                className="input"
                value={draft.province}
                onChange={(event) => updateDraftProvince(event.target.value)}
              >
                <option value="">请选择省份</option>
                {provinceOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              城市
              <select
                className="input"
                value={draft.city}
                onChange={(event) => updateDraftCity(event.target.value)}
                disabled={!draft.province}
              >
                <option value="">请选择城市</option>
                {cityOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              区县
              <select
                className="input"
                value={draft.district}
                onChange={(event) => update('district', event.target.value)}
                disabled={!draft.city}
              >
                <option value="">请选择区县</option>
                {districtOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              网点类型
              <input
                className="input"
                value={draft.dealerType}
                onChange={(event) => update('dealerType', event.target.value)}
              />
            </label>
            <label className="span-2">
              地址
              <input
                className="input"
                value={draft.address}
                onChange={(event) => update('address', event.target.value)}
              />
            </label>
            <label>
              服务标签
              <input
                className="input"
                value={draft.services}
                onChange={(event) => update('services', event.target.value)}
                placeholder="家用, 安装, 售后"
              />
            </label>
            <label>
              认证标签
              <input
                className="input"
                value={draft.certifications}
                onChange={(event) => update('certifications', event.target.value)}
              />
            </label>
            <label>
              纬度
              <input
                className="input"
                value={draft.latitude}
                onChange={(event) => update('latitude', event.target.value)}
              />
            </label>
            <label>
              经度
              <input
                className="input"
                value={draft.longitude}
                onChange={(event) => update('longitude', event.target.value)}
              />
            </label>
            <label>
              排序
              <input
                className="input"
                type="number"
                min="0"
                value={draft.sortOrder}
                onChange={(event) => update('sortOrder', event.target.value)}
              />
            </label>
            <label>
              状态
              <select
                className="input"
                value={draft.status}
                onChange={(event) => update('status', event.target.value)}
              >
                <option value="active">启用</option>
                <option value="inactive">停用</option>
              </select>
            </label>
          </div>
          <div className="product-create-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={closeEditor}>
              取消
            </button>
            <button type="button" className="btn btn-brand btn-sm" onClick={save} disabled={busy}>
              <Save size={13} />
              保存
            </button>
          </div>
        </div>
      )}
      <WorkbenchTableShell>
        <div className="brand-product-table-wrap">
          <table className="table site-dealer-table">
            <thead>
              <tr>
                <th>网点</th>
                <th>地址</th>
                <th>电话</th>
                <th>服务</th>
                <th>认证</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length ? (
                items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <small>{row.dealerType || '-'}</small>
                    </td>
                    <td title={row.address}>{shortText(row.address || '')}</td>
                    <td>{row.phone || '-'}</td>
                    <td>{(row.services || []).join('、') || '-'}</td>
                    <td>{(row.certifications || []).join('、') || '-'}</td>
                    <td>
                      <StatusPill tone={row.status === 'active' ? 'success' : 'neutral'}>
                        {row.status === 'active' ? '启用' : '停用'}
                      </StatusPill>
                    </td>
                    <td>
                      <div className="table-actions">
                        {permissions.canUpdate && (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm icon-only"
                            title="编辑网点"
                            aria-label="编辑网点"
                            onClick={() => startEdit(row)}
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        {permissions.canDelete && (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm icon-only btn-danger"
                            title="归档网点"
                            aria-label="归档网点"
                            onClick={() => archive(row)}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <WorkbenchTableState
                      type={loading ? 'loading' : 'empty'}
                      title={loading ? '正在加载服务网点' : '暂无服务网点'}
                      description="新增网点后将显示在官网查找经销商页面。"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <WorkbenchPaginationFooter
          currentPage={page}
          totalPages={Math.max(Math.ceil(total / pageSize), 1)}
          totalItems={total}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 50, 100]}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
          onPageChange={loading ? undefined : setPage}
          onPrevious={loading || page <= 1 ? undefined : () => setPage((value) => value - 1)}
          onNext={
            loading || page >= Math.max(Math.ceil(total / pageSize), 1)
              ? undefined
              : () => setPage((value) => value + 1)
          }
        />
      </WorkbenchTableShell>
      <style jsx>{`
        .site-dealer-panel {
          display: grid;
          gap: 14px;
          padding: 18px 20px 24px;
        }
        .site-dealer-panel h3 {
          display: flex;
          align-items: center;
          gap: 7px;
          margin: 3px 0;
        }
        .site-dealer-editor {
          display: grid;
          gap: 12px;
          padding: 14px 16px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
        }
        .site-dealer-form {
          display: grid;
          grid-template-columns: repeat(4, minmax(140px, 1fr));
          gap: 10px;
        }
        .site-dealer-form label {
          display: grid;
          gap: 5px;
          color: var(--t-secondary);
          font-size: 11px;
          font-weight: 700;
        }
        .site-dealer-form .span-2 {
          grid-column: span 2;
        }
        .site-dealer-table {
          min-width: 980px;
        }
        .site-dealer-table td strong,
        .site-dealer-table td small {
          display: block;
        }
        .table-actions {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }
        @media (max-width: 820px) {
          .site-dealer-form {
            grid-template-columns: 1fr 1fr;
          }
          .site-dealer-form .span-2 {
            grid-column: span 2;
          }
        }
        @media (max-width: 560px) {
          .site-dealer-form {
            grid-template-columns: 1fr;
          }
          .site-dealer-form .span-2 {
            grid-column: auto;
          }
        }
      `}</style>
    </div>
  );
}
