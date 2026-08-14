'use client';

/** 2026-08 全页 UX 重构三期 · WorkspaceKit 化：渲染层去内联样式（只动样式层；extractability 可抽取性展示区文案与逻辑原样）。 */

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  BookmarkPlus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Factory,
  FileImage,
  Loader2,
  Package,
  PenLine,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { WorkbenchPaginationFooter } from './WorkbenchCore';
import {
  brandSites,
  content,
  fileArtifacts,
  growthContentAssets,
  growthCopy,
  wechatPublishing,
} from '../lib/api';

type CopyAsset = {
  id: string;
  channel: string;
  brandSlug: string | null;
  prompt: string;
  draft: string | null;
  status: string;
  reviewer: string | null;
  complianceFlags: string[];
  /** 可抽取性评估（迁移 112，生成时落库）：形态启发式，通过≠必被引用 */
  extractability?: {
    score?: number;
    passed?: boolean;
    hints?: string[];
    basis?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  promptTemplateId: string | null;
};

type PromptTemplate = {
  id: string;
  name: string;
  promptBody: string;
  brandSlug: string | null;
  category: string | null;
  channel: string | null;
  usageCount: number;
  verifiedCount: number;
  positiveCount: number;
  negativeCount: number;
  averageLift: number | string;
  evidenceState: 'unverified' | 'promising' | 'proven' | 'negative' | 'inconclusive';
};

type SortBy = 'channel' | 'brandSlug' | 'status' | 'createdAt';
type SortOrder = 'ASC' | 'DESC';
type WechatAccountOption = {
  id: string;
  displayName: string;
  brandId: string;
  appIdMasked: string;
};
type BrandOption = { id: string; label: string };
type FactRef = { type: string; id: string; label?: string; verified?: boolean };
type ProductionProduct = {
  id: string;
  label: string;
  meta?: string;
  brandCode?: string | null;
  category?: string | null;
  verified?: boolean;
  factRef?: FactRef;
};
type ProductionSellingPoint = {
  id: string;
  label: string;
  meta?: string;
  verified?: boolean;
  productId?: string | null;
  factRef?: FactRef;
};
type ProductionMaterial = {
  id: string;
  label: string;
  type?: string;
  meta?: string;
  fileArtifactId?: string | null;
  thumbnailUrl?: string | null;
  fileUrl?: string | null;
  verified?: boolean;
  factRef?: FactRef | null;
};
type ProductionContext = {
  products: ProductionProduct[];
  sellingPoints: ProductionSellingPoint[];
  materials: ProductionMaterial[];
  factSources: FactRef[];
};

const CHANNELS = [
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'douyin', label: '抖音' },
  { value: 'zhihu', label: '知乎' },
  { value: 'wechat', label: '微信公众号' },
  { value: 'seo', label: 'SEO' },
  { value: 'ad', label: '广告投放' },
];
const DEFAULT_BRANDS: BrandOption[] = [
  { id: 'rheem', label: 'Rheem' },
  { id: 'ruud', label: 'Ruud' },
  { id: 'everhot', label: 'Everhot' },
];
const PRODUCT_LIBRARY_TENANT_ID =
  process.env.NEXT_PUBLIC_PRODUCT_LIBRARY_TENANT_ID ||
  process.env.NEXT_PUBLIC_RHAUTT_COMFORT_TENANT_ID ||
  process.env.NEXT_PUBLIC_EVERHOT_TENANT_ID ||
  'e5e40000-0000-4000-8000-000000000001';
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const COPY_OBJECTIVES = ['高意向线索', '新品种草', '活动报名', '经销商转发', '官网 SEO'];
const COPY_AUDIENCES = [
  '家装/换新用户',
  '别墅大宅业主',
  '经销商导购',
  '设计师/暖通顾问',
  '商业项目决策人',
];
const COPY_TONES = ['专业可信', '温暖生活化', '克制高端', '短促强转化', '科普解释型'];
const COPY_BRIEF_CHIPS = [
  '节能省电',
  '恒温舒适',
  '安装条件清晰',
  '专业售后',
  '适合大户型',
  '预算边界明确',
];
const COPY_SCENARIOS = [
  {
    label: '小红书种草',
    channel: 'xiaohongshu',
    objective: '新品种草',
    audience: '家装/换新用户',
    tone: '温暖生活化',
    productFocus: '热水与舒适系统',
    coreMessage: '用真实家庭场景介绍舒适热水体验，突出节能省电、恒温舒适和安装前需要确认的条件。',
  },
  {
    label: '经销商转发',
    channel: 'wechat',
    objective: '经销商转发',
    audience: '经销商导购',
    tone: '专业可信',
    productFocus: '瑞美 Rheem 热水解决方案',
    coreMessage: '帮助经销商向终端用户解释产品价值，突出专业品牌、方案能力、售后支持和适用场景。',
  },
  {
    label: 'SEO 问答',
    channel: 'seo',
    objective: '官网 SEO',
    audience: '设计师/暖通顾问',
    tone: '科普解释型',
    productFocus: '家用热水与舒适系统选型',
    coreMessage:
      '围绕用户常见问题输出可被搜索和 AI 引用的问答内容，解释预算、能效、安装条件和选型注意事项。',
  },
];
const SORTABLE_COLUMNS: Array<{ key: SortBy; label: string }> = [
  { key: 'channel', label: '渠道' },
  { key: 'brandSlug', label: '品牌' },
  { key: 'status', label: '状态' },
  { key: 'createdAt', label: '创建时间' },
];
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'badge badge-grey' },
  approved: { label: '已审核', className: 'badge badge-success' },
  rejected: { label: '已拒绝', className: 'badge badge-danger' },
  published: { label: '已发布', className: 'badge badge-info' },
};
const CHANNEL_HEADINGS: Record<string, string[]> = {
  xiaohongshu: ['小红书', 'xiaohongshu'],
  douyin: ['抖音', 'douyin'],
  zhihu: ['知乎', 'zhihu'],
  wechat: ['公众号', '微信公众号', 'wechat'],
  seo: ['seo'],
  ad: ['广告投放', '广告', 'ad'],
};
const PROMPT_EVIDENCE: Record<
  PromptTemplate['evidenceState'],
  { label: string; className: string }
> = {
  unverified: { label: '待验证', className: 'badge badge-grey' },
  promising: { label: '初步有效', className: 'badge badge-info' },
  proven: { label: '已验证', className: 'badge badge-success' },
  negative: { label: '负向', className: 'badge badge-danger' },
  inconclusive: { label: '无明显变化', className: 'badge badge-warning' },
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function channelLabel(value?: string | null) {
  if (value?.startsWith('geo-')) return '中心AI';
  return CHANNELS.find((item) => item.value === value)?.label || value || '-';
}

function statusBadge(status: string) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'badge badge-grey' };
  return (
    <span className={`${config.className} inline-flex whitespace-nowrap`}>{config.label}</span>
  );
}

function normalizeWechatBrand(value?: string | null) {
  const brand = String(value || '')
    .trim()
    .toLowerCase();
  if (brand.includes('ruud') || brand.includes('瑞德')) return 'ruud';
  if (brand.includes('everhot') || brand.includes('恒热')) return 'everhot';
  return 'rheem';
}

function wechatSubmitMissingReason(form: {
  accountIds: string[];
  digest: string;
  coverAssetId: string;
}) {
  if (!form.accountIds.length) return '请先选择至少一个公众号';
  if (!form.coverAssetId.trim()) return '请选择公众号封面图';
  if (!form.digest.trim()) return '请填写公众号摘要';
  return '';
}

function normalizeHeading(value: string) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[：:]/g, '')
    .toLowerCase();
}

function extractChannelDraft(text: string, channel?: string | null) {
  const source = String(text || '').trim();
  const labels = (CHANNEL_HEADINGS[String(channel || '')] || [String(channel || '')]).map(
    normalizeHeading
  );
  const matches = Array.from(source.matchAll(/^#{1,6}\s*渠道\s*[：:]\s*([^\n\r#]+)\s*$/gim));
  for (let index = 0; index < matches.length; index += 1) {
    const heading = normalizeHeading(matches[index][1] || '');
    if (!labels.some((label) => label && heading.includes(label))) continue;
    const start = matches[index].index || 0;
    const end =
      index + 1 < matches.length ? matches[index + 1].index || source.length : source.length;
    return source
      .slice(start, end)
      .trim()
      .replace(/\n\s*---\s*$/g, '')
      .trim();
  }
  return source;
}

function copyText(item?: Pick<CopyAsset, 'draft' | 'prompt' | 'channel'> | null, fallback = '') {
  return extractChannelDraft(item?.draft || fallback || item?.prompt || '', item?.channel);
}

function truncate(value: string, max = 150) {
  const compact = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return compact.length > max ? `${compact.slice(0, max)}...` : compact;
}

function parseDraftSections(value: string) {
  const source = String(value || '').trim();
  const matches = Array.from(source.matchAll(/^#{1,6}\s*([^#\n\r]+?)\s*[:：]?\s*$/gm));
  if (!source || !matches.length) return [];
  return matches
    .map((match, index) => {
      const start = (match.index || 0) + match[0].length;
      const end =
        index + 1 < matches.length ? matches[index + 1].index || source.length : source.length;
      const title = String(match[1] || '')
        .replace(/^渠道\s*[：:]\s*/i, '')
        .trim();
      const body = source.slice(start, end).trim();
      return { title, body };
    })
    .filter((section) => section.title && section.body);
}

export default function GrowthCopyTable() {
  const [allItems, setAllItems] = useState<CopyAsset[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>(DEFAULT_BRANDS);
  const [generateForm, setGenerateForm] = useState({
    channel: 'xiaohongshu',
    brandSlug: '',
    prompt: '',
    promptTemplateId: '',
  });
  const [briefForm, setBriefForm] = useState({
    objective: COPY_OBJECTIVES[0],
    audience: COPY_AUDIENCES[0],
    productFocus: '热水与舒适系统',
    coreMessage: '',
    tone: COPY_TONES[0],
    complianceFocus: '避免夸大绝对化；明确适用场景、预算和安装条件',
  });
  const [generateBusy, setGenerateBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewItem, setPreviewItem] = useState<CopyAsset | null>(null);
  const [previewDraft, setPreviewDraft] = useState('');
  const [generationWorkbenchOpen, setGenerationWorkbenchOpen] = useState(false);
  const [generationStage, setGenerationStage] = useState(0);
  const [saveBusy, setSaveBusy] = useState(false);
  const [promptBusy, setPromptBusy] = useState(false);
  const [factoryBusy, setFactoryBusy] = useState(false);
  const [wechatSubmitOpen, setWechatSubmitOpen] = useState(false);
  const [wechatAccounts, setWechatAccounts] = useState<WechatAccountOption[]>([]);
  const [wechatForm, setWechatForm] = useState({
    brandId: DEFAULT_BRANDS[0].id,
    accountIds: [] as string[],
    digest: '',
    coverAssetId: '',
    sourceUrl: '',
  });
  const [productionContext, setProductionContext] = useState<ProductionContext>({
    products: [],
    sellingPoints: [],
    materials: [],
    factSources: [],
  });
  const [productionQuery, setProductionQuery] = useState('');
  const [contextBusy, setContextBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedSellingPoints, setSelectedSellingPoints] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [wechatTasks, setWechatTasks] = useState<any[]>([]);
  const [wechatBusy, setWechatBusy] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);
  const urlPromptAppliedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [result, promptResult] = await Promise.all([
        growthCopy.list(),
        growthCopy.promptTemplates(),
      ]);
      setAllItems(Array.isArray(result?.items) ? result.items : []);
      setPromptTemplates(Array.isArray(promptResult?.items) ? promptResult.items : []);
    } catch (loadError) {
      setError((loadError as Error).message || '文案加载失败');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (urlPromptAppliedRef.current || !promptTemplates.length) return;
    urlPromptAppliedRef.current = true;
    const templateId = new URLSearchParams(window.location.search).get('promptTemplateId');
    if (!templateId) return;
    const template = promptTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setGenerateForm((current) => ({
      ...current,
      promptTemplateId: template.id,
      prompt: template.promptBody,
      channel:
        template.channel && CHANNELS.some((item) => item.value === template.channel)
          ? template.channel
          : current.channel,
      brandSlug: template.brandSlug || current.brandSlug,
    }));
    setMessage(`已载入提示词：${template.name}`);
  }, [promptTemplates]);

  useEffect(() => {
    let cancelled = false;
    brandSites
      .list()
      .then((result) => {
        if (cancelled) return;
        const items = Array.isArray(result?.items) ? result.items : [];
        const next = items
          .filter((site: any) => String(site?.status || 'active') === 'active')
          .map((site: any) => {
            const id = String(site?.code || '')
              .trim()
              .toLowerCase();
            const label =
              `${site?.nameCn || site?.name_cn || site?.nameEn || site?.name_en || id} ${site?.nameEn || site?.name_en || ''}`.trim();
            return id ? { id, label } : null;
          })
          .filter(Boolean) as BrandOption[];
        if (!next.length) return;
        setBrandOptions(next);
        setGenerateForm((current) =>
          !current.brandSlug || next.some((brand) => brand.id === current.brandSlug)
            ? current
            : { ...current, brandSlug: '' }
        );
        setWechatForm((current) =>
          next.some((brand) => brand.id === current.brandId)
            ? current
            : { ...current, brandId: next[0].id }
        );
      })
      .catch(() => setBrandOptions(DEFAULT_BRANDS));
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveBrandOption = useCallback(
    (value?: string | null) => {
      const normalized = String(value || '')
        .trim()
        .toLowerCase();
      if (!normalized) return null;
      return (
        brandOptions.find((brand) => {
          const label = brand.label.toLowerCase();
          return (
            brand.id.toLowerCase() === normalized ||
            label === normalized ||
            label.includes(normalized) ||
            normalized.includes(brand.id.toLowerCase())
          );
        }) || null
      );
    },
    [brandOptions]
  );

  const displayBrand = useCallback(
    (value?: string | null) => {
      if (!value) return '-';
      return resolveBrandOption(value)?.label || value;
    },
    [resolveBrandOption]
  );

  const selectedProductItems = useMemo(
    () => productionContext.products.filter((item) => selectedProducts.includes(item.id)),
    [productionContext.products, selectedProducts]
  );
  const selectedSellingPointItems = useMemo(
    () => productionContext.sellingPoints.filter((item) => selectedSellingPoints.includes(item.id)),
    [productionContext.sellingPoints, selectedSellingPoints]
  );
  const selectedMaterialItems = useMemo(
    () =>
      productionContext.materials.filter(
        (item) =>
          selectedMaterials.includes(item.id) ||
          Boolean(item.fileArtifactId && selectedMaterials.includes(item.fileArtifactId))
      ),
    [productionContext.materials, selectedMaterials]
  );
  const selectedCoverMaterial = useMemo(
    () =>
      productionContext.materials.find(
        (item) =>
          item.fileArtifactId === wechatForm.coverAssetId || item.id === wechatForm.coverAssetId
      ) || null,
    [productionContext.materials, wechatForm.coverAssetId]
  );
  const activeBrandLabel = generateForm.brandSlug
    ? displayBrand(generateForm.brandSlug)
    : '全部品牌';
  const activeChannelLabel = channelLabel(generateForm.channel);
  const generationSteps = ['整理产品事实', '结合素材库', '生成渠道草稿', '合规初筛', '保存草稿'];

  const loadProductionContext = useCallback(async () => {
    setContextBusy(true);
    try {
      const result = await content.productionContext({
        brandCode: generateForm.brandSlug || '',
        channel: generateForm.channel || '',
        query: productionQuery.trim(),
        productTenantId: PRODUCT_LIBRARY_TENANT_ID,
        limit: '18',
      });
      const nextProducts = Array.isArray(result?.products) ? result.products : [];
      const nextSellingPoints = Array.isArray(result?.sellingPoints) ? result.sellingPoints : [];
      const nextMaterials = Array.isArray(result?.materials) ? result.materials : [];
      setProductionContext({
        products: nextProducts,
        sellingPoints: nextSellingPoints,
        materials: nextMaterials,
        factSources: Array.isArray(result?.factSources) ? result.factSources : [],
      });
      setSelectedProducts((current) =>
        current.filter((id) => nextProducts.some((item: ProductionProduct) => item.id === id))
      );
      setSelectedSellingPoints((current) =>
        current.filter((id) =>
          nextSellingPoints.some((item: ProductionSellingPoint) => item.id === id)
        )
      );
      setSelectedMaterials((current) =>
        current.filter((id) =>
          nextMaterials.some(
            (item: ProductionMaterial) => item.id === id || item.fileArtifactId === id
          )
        )
      );
    } catch (contextError) {
      setError((contextError as Error).message || '生产资料加载失败');
    } finally {
      setContextBusy(false);
    }
  }, [generateForm.brandSlug, generateForm.channel, productionQuery]);

  useEffect(() => {
    if (!generatorOpen && !wechatSubmitOpen) return;
    const timer = setTimeout(loadProductionContext, 250);
    return () => clearTimeout(timer);
  }, [generatorOpen, loadProductionContext, wechatSubmitOpen]);

  const filtered = useMemo(
    () =>
      allItems.filter((item) => {
        const haystack = `${item.prompt || ''} ${item.draft || ''}`.toLowerCase();
        if (debouncedKeyword && !haystack.includes(debouncedKeyword.toLowerCase())) return false;
        if (channelFilter !== 'all' && item.channel !== channelFilter) return false;
        if (brandFilter !== 'all') {
          if (brandFilter === '' && item.brandSlug) return false;
          if (brandFilter !== '') {
            const option = resolveBrandOption(item.brandSlug);
            if (
              (option?.id ||
                String(item.brandSlug || '')
                  .trim()
                  .toLowerCase()) !== brandFilter
            )
              return false;
          }
        }
        if (statusFilter !== 'all' && item.status !== statusFilter) return false;
        return true;
      }),
    [allItems, brandFilter, channelFilter, debouncedKeyword, resolveBrandOption, statusFilter]
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((left, right) => {
        const leftValue = String(left[sortBy] || '').toLowerCase();
        const rightValue = String(right[sortBy] || '').toLowerCase();
        const result = leftValue.localeCompare(rightValue, 'zh-CN');
        return sortOrder === 'ASC' ? result : -result;
      }),
    [filtered, sortBy, sortOrder]
  );

  const totalPages = Math.max(Math.ceil(sorted.length / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const items = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visibleIds = items.map((item) => item.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      const selectedVisible = visibleIds.filter((id) => selectedIds.includes(id)).length;
      headerCheckboxRef.current.indeterminate =
        selectedVisible > 0 && selectedVisible < visibleIds.length;
    }
  }, [selectedIds, visibleIds]);

  function patchGenerateForm(patch: Partial<typeof generateForm>) {
    setGenerateForm((current) => ({ ...current, ...patch }));
  }

  function patchBriefForm(patch: Partial<typeof briefForm>) {
    setBriefForm((current) => ({ ...current, ...patch }));
  }

  function appendBriefChip(value: string) {
    setBriefForm((current) => {
      const parts = current.coreMessage
        .split(/[，,、]/)
        .map((item) => item.trim())
        .filter(Boolean);
      if (parts.includes(value)) return current;
      return { ...current, coreMessage: [...parts, value].join('、') };
    });
  }

  function toggleSelection(id: string, setter: Dispatch<SetStateAction<string[]>>) {
    setter((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function openCopyWorkbench(item: CopyAsset) {
    setPreviewItem(item);
    setPreviewDraft(copyText(item));
    setGenerationWorkbenchOpen(true);
    setGenerationStage(generationSteps.length);
    setWechatSubmitOpen(false);
  }

  function closeCopyWorkbench() {
    if (generateBusy) return;
    setGenerationWorkbenchOpen(false);
    setPreviewItem(null);
    setPreviewDraft('');
    setWechatSubmitOpen(false);
  }

  function toggleProductSelection(item: ProductionProduct) {
    toggleSelection(item.id, setSelectedProducts);
    const productBrand = String(item.brandCode || '').trim();
    if (productBrand && productBrand !== generateForm.brandSlug) {
      patchGenerateForm({ brandSlug: productBrand });
    }
  }

  function selectedFactRefs() {
    const refs = [
      ...selectedProductItems.map((item) => item.factRef),
      ...selectedSellingPointItems.map((item) => item.factRef),
      ...selectedMaterialItems.map((item) => item.factRef),
    ].filter(Boolean) as FactRef[];
    return Array.from(new Map(refs.map((ref) => [`${ref.type}:${ref.id}`, ref])).values());
  }

  function productionReferencePrompt() {
    const lines = [
      selectedProductItems.length
        ? `已选产品：${selectedProductItems.map((item) => `${item.label}${item.meta ? `（${item.meta}）` : ''}`).join('；')}`
        : '',
      selectedSellingPointItems.length
        ? `已选卖点/证据：${selectedSellingPointItems.map((item) => `${item.label}${item.verified ? '' : '（待补证据，避免直接外宣）'}`).join('；')}`
        : '',
      selectedMaterialItems.length
        ? `已选素材：${selectedMaterialItems.map((item) => `${item.label}${item.type ? `（${item.type}）` : ''}`).join('；')}`
        : '',
    ].filter(Boolean);
    return lines.length ? `\n\n生产资料引用：\n${lines.join('\n')}` : '';
  }

  function readFileBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  function productionFileFormat(file: File) {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
    return (ext || file.type.split('/').pop() || 'image').toLowerCase();
  }

  async function uploadProductionImage(file?: File | null, usage: 'cover' | 'body' = 'body') {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件');
      return;
    }
    setUploadBusy(true);
    setError('');
    try {
      const dataBase64 = await readFileBase64(file);
      const result = await fileArtifacts.uploadBase64({
        entityType: usage === 'cover' ? 'wechat_cover' : 'content_material',
        entityId: previewItem?.id || 'copy-production',
        filename: file.name,
        mimeType: file.type,
        dataBase64,
      });
      const artifact = result?.data || result;
      const artifactId = String(artifact?.id || '');
      if (!artifactId) throw new Error('上传完成但未返回素材');
      const contentUrl =
        artifact?.contentUrl || `/api/v2/file-artifact/${encodeURIComponent(artifactId)}/content`;
      const assetResult = await growthContentAssets.create({
        title: artifact?.originalName || file.name,
        assetType: usage === 'cover' ? '封面图' : '正文配图',
        brandSlug: '',
        channel: generateForm.channel || '',
        summary:
          usage === 'cover' ? '文案 Copilot 上传的公众号封面' : '文案 Copilot 上传的正文配图',
        tags: ['文案Copilot'],
        fileArtifactId: artifactId,
        fileUrl: contentUrl,
        thumbnailUrl: contentUrl,
        fileFormat: productionFileFormat(file),
        usageScene: usage === 'cover' ? '公众号封面' : '文案配图',
      });
      const asset =
        assetResult?.data?.asset || assetResult?.asset || assetResult?.data || assetResult;
      const assetId = String(asset?.id || artifactId);
      if (usage === 'cover') setWechatForm((current) => ({ ...current, coverAssetId: artifactId }));
      setSelectedMaterials((current) => Array.from(new Set([...current, assetId])));
      setProductionContext((current) => ({
        ...current,
        materials: [
          {
            id: assetId,
            label: asset?.title || artifact?.originalName || file.name,
            type: asset?.assetType || (usage === 'cover' ? '封面图' : '正文配图'),
            meta: [
              asset?.assetType || (usage === 'cover' ? '封面图' : '正文配图'),
              asset?.usageScene || (usage === 'cover' ? '公众号封面' : '文案配图'),
              asset?.fileFormat || productionFileFormat(file),
            ]
              .filter(Boolean)
              .join(' · '),
            fileArtifactId: artifactId,
            thumbnailUrl: asset?.thumbnailUrl || contentUrl,
            fileUrl: asset?.fileUrl || contentUrl,
            verified: true,
            factRef: {
              type: 'manual',
              id: artifactId,
              label: asset?.title || artifact?.originalName || file.name,
            },
          },
          ...current.materials,
        ],
      }));
      setMessage(usage === 'cover' ? '封面图已加入内容素材库并选中' : '图片已加入内容素材库并选中');
    } catch (uploadError) {
      setError((uploadError as Error).message || '上传失败');
    } finally {
      setUploadBusy(false);
    }
  }

  function applyScenario(scenario: (typeof COPY_SCENARIOS)[number]) {
    patchGenerateForm({ channel: scenario.channel, promptTemplateId: '' });
    setBriefForm((current) => ({
      ...current,
      objective: scenario.objective,
      audience: scenario.audience,
      tone: scenario.tone,
      productFocus: scenario.productFocus,
      coreMessage: scenario.coreMessage,
    }));
  }

  function composeMarketingPrompt() {
    const lines = [
      `营销目标：${briefForm.objective}`,
      `目标人群：${briefForm.audience}`,
      `产品/主题：${briefForm.productFocus}`,
      `核心卖点/活动信息：${briefForm.coreMessage}`,
      `表达语气：${briefForm.tone}`,
      `合规边界：${briefForm.complianceFocus}`,
      `输出要求：请生成适合${channelLabel(generateForm.channel)}发布的品牌一致性文案，标题清晰，正文可直接交给运营审核；避免绝对化、虚假承诺和无法验证的功效表述。`,
      productionReferencePrompt(),
    ];
    return lines.filter((line) => !line.endsWith('：')).join('\n');
  }

  function selectPromptTemplate(id: string) {
    const template = promptTemplates.find((item) => item.id === id);
    if (!template) {
      patchGenerateForm({ promptTemplateId: '', prompt: '' });
      return;
    }
    patchGenerateForm({
      promptTemplateId: template.id,
      prompt: template.promptBody,
      channel:
        template.channel && CHANNELS.some((item) => item.value === template.channel)
          ? template.channel
          : generateForm.channel,
      brandSlug: template.brandSlug || generateForm.brandSlug,
    });
  }

  function toggleSort(column: SortBy) {
    if (sortBy === column) setSortOrder((current) => (current === 'ASC' ? 'DESC' : 'ASC'));
    else {
      setSortBy(column);
      setSortOrder('ASC');
    }
    setPage(1);
  }

  function sortIcon(column: SortBy) {
    if (sortBy !== column) return <ChevronsUpDown size={12} className="text-muted-foreground/70" />;
    return sortOrder === 'ASC' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  }

  function toggleVisible(checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? Array.from(new Set([...current, ...visibleIds]))
        : current.filter((id) => !visibleIds.includes(id))
    );
  }

  async function generate() {
    const prompt = generateForm.prompt.trim() || composeMarketingPrompt();
    if (!prompt.trim()) return setError('请填写文案需求');
    setGenerationWorkbenchOpen(true);
    setPreviewItem(null);
    setPreviewDraft('');
    setWechatSubmitOpen(false);
    setGenerationStage(0);
    setGenerateBusy(true);
    setError('');
    setMessage('');
    try {
      setGenerationStage(1);
      const refsPrompt = generateForm.prompt.trim() ? productionReferencePrompt() : '';
      setGenerationStage(2);
      const result = await growthCopy.generate({
        channel: generateForm.channel,
        brandSlug: generateForm.brandSlug || undefined,
        prompt: `${prompt}${refsPrompt}`,
        promptTemplateId: generateForm.promptTemplateId || undefined,
      });
      setGenerationStage(3);
      if (result?.asset) {
        openCopyWorkbench(result.asset);
        setPreviewDraft(copyText(result.asset, result.draft));
      }
      setGenerationStage(4);
      setMessage('文案已生成');
      if (!generateForm.promptTemplateId) patchGenerateForm({ prompt: '' });
      await load();
      setGenerationStage(5);
    } catch (generateError) {
      setError((generateError as Error).message || '文案生成失败');
    } finally {
      setGenerateBusy(false);
    }
  }

  async function approve(id: string) {
    setBusy(true);
    setError('');
    try {
      await growthCopy.approve(id);
      setMessage('文案已审核通过');
      await load();
    } catch (approveError) {
      setError((approveError as Error).message || '审核失败');
    } finally {
      setBusy(false);
    }
  }

  async function reject(id: string) {
    setBusy(true);
    setError('');
    try {
      await growthCopy.reject(id);
      setMessage('文案已拒绝');
      await load();
    } catch (rejectError) {
      setError((rejectError as Error).message || '拒绝失败');
    } finally {
      setBusy(false);
    }
  }

  async function removeRejected(id: string) {
    if (!window.confirm('确定删除这条已拒绝文案吗？删除后不会进入归档复用。')) return;
    setBusy(true);
    setError('');
    try {
      await growthCopy.remove(id);
      setSelectedIds((current) => current.filter((item) => item !== id));
      setMessage('已删除废弃文案');
      await load();
    } catch (removeError) {
      setError((removeError as Error).message || '删除失败');
    } finally {
      setBusy(false);
    }
  }

  async function bulkApprove() {
    const ids = allItems
      .filter(
        (item) =>
          selectedIds.includes(item.id) && item.status === 'draft' && !item.complianceFlags.length
      )
      .map((item) => item.id);
    if (!ids.length) return setError('选中的文案中没有可审核通过的草稿');
    setBulkBusy(true);
    setError('');
    try {
      await Promise.all(ids.map(growthCopy.approve));
      setMessage(`已批量审核通过 ${ids.length} 条文案`);
      setSelectedIds([]);
      await load();
    } catch (bulkError) {
      setError((bulkError as Error).message || '批量审核失败');
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkReject() {
    const ids = allItems
      .filter((item) => selectedIds.includes(item.id) && item.status === 'draft')
      .map((item) => item.id);
    if (!ids.length) return setError('选中的文案中没有可拒绝的草稿');
    setBulkBusy(true);
    setError('');
    try {
      await Promise.all(ids.map(growthCopy.reject));
      setMessage(`已批量拒绝 ${ids.length} 条文案`);
      setSelectedIds([]);
      await load();
    } catch (bulkError) {
      setError((bulkError as Error).message || '批量拒绝失败');
    } finally {
      setBulkBusy(false);
    }
  }

  async function savePreview() {
    if (!previewItem) return;
    setSaveBusy(true);
    setError('');
    try {
      const result = await growthCopy.update(previewItem.id, { draft: previewDraft });
      if (result?.asset) setPreviewItem(result.asset);
      setMessage('文案已保存');
      await load();
    } catch (saveError) {
      setError((saveError as Error).message || '保存失败');
    } finally {
      setSaveBusy(false);
    }
  }

  async function savePromptFromPreview() {
    if (!previewItem || previewItem.promptTemplateId) return;
    setPromptBusy(true);
    setError('');
    try {
      const result = await growthCopy.savePromptTemplate(previewItem.id);
      if (result?.template) {
        setPreviewItem({ ...previewItem, promptTemplateId: result.template.id });
        setMessage(
          result.template.verifiedCount > 0
            ? '提示词已入池，并已回填实验效果'
            : '提示词已存入蓄水池，等待 GEO 验证'
        );
      }
      await load();
    } catch (saveError) {
      setError((saveError as Error).message || '提示词保存失败');
    } finally {
      setPromptBusy(false);
    }
  }

  async function sendPreviewToContentFactory() {
    if (!previewItem) return;
    const body = previewDraft.trim() || copyText(previewItem).trim();
    if (!body) {
      setError('文案正文为空，无法送入内容工厂');
      return;
    }
    setFactoryBusy(true);
    setError('');
    try {
      const asset = await persistPreviewDraft();
      const source = copyText(asset || previewItem, body) || body;
      const firstLine =
        source
          .split(/\n/)
          .map((line) => line.trim())
          .find(Boolean) || previewItem.prompt;
      const title = truncate(firstLine.replace(/^#+\s*/, '').replace(/^标题[:：]\s*/, ''), 64);
      await content.create({
        title,
        kind:
          previewItem.channel === 'seo'
            ? 'faq'
            : previewItem.channel === 'ad'
              ? 'social'
              : 'article',
        channel: previewItem.channel,
        brandCode: previewItem.brandSlug || undefined,
        category: 'copywriter',
        body: source,
        factRefs: selectedFactRefs(),
        sourceType: 'copywriter',
        sourceRef: previewItem.id,
        sourceLabel: `文案 Copilot · ${channelLabel(previewItem.channel)}`,
      });
      setMessage('已送入内容工厂草稿池');
      closeCopyWorkbench();
    } catch (factoryError) {
      setError((factoryError as Error).message || '送入内容工厂失败');
    } finally {
      setFactoryBusy(false);
    }
  }

  async function persistPreviewDraft() {
    if (!previewItem) return null;
    if (previewDraft === copyText(previewItem)) return previewItem;
    const result = await growthCopy.update(previewItem.id, { draft: previewDraft });
    const asset = result?.asset || previewItem;
    setPreviewItem(asset);
    return asset as CopyAsset;
  }

  async function approvePreview() {
    if (!previewItem) return;
    setBusy(true);
    setError('');
    try {
      const asset = await persistPreviewDraft();
      if (asset?.complianceFlags?.length)
        throw new Error(`合规词命中，禁止核准：${asset.complianceFlags.join('、')}`);
      await growthCopy.approve(previewItem.id);
      closeCopyWorkbench();
      setMessage('文案已审核通过');
      await load();
    } catch (approveError) {
      setError((approveError as Error).message || '审核失败');
    } finally {
      setBusy(false);
    }
  }

  async function loadWechatAccounts(brandId: string) {
    setWechatBusy(true);
    setError('');
    try {
      const result = await wechatPublishing.availableAccounts(brandId);
      const accounts = Array.isArray(result?.items) ? result.items : [];
      setWechatAccounts(accounts);
      setWechatForm((current) => ({
        ...current,
        accountIds: accounts.length === 1 ? [accounts[0].id] : [],
      }));
    } catch (loadError) {
      setWechatAccounts([]);
      setError((loadError as Error).message || '公众号加载失败');
    } finally {
      setWechatBusy(false);
    }
  }

  async function loadWechatTasks() {
    try {
      const result = await wechatPublishing.tasks();
      setWechatTasks(Array.isArray(result?.items) ? result.items.slice(0, 5) : []);
    } catch {
      setWechatTasks([]);
    }
  }

  async function openWechatSubmit() {
    if (!previewItem) return;
    const brandId =
      resolveBrandOption(previewItem.brandSlug)?.id || normalizeWechatBrand(previewItem.brandSlug);
    setWechatSubmitOpen(true);
    setWechatForm((current) => ({
      ...current,
      brandId,
      digest: current.digest || truncate(copyText(previewItem), 80),
      accountIds: [],
    }));
    await Promise.all([loadWechatAccounts(brandId), loadWechatTasks(), loadProductionContext()]);
  }

  async function submitWechatReview() {
    if (!previewItem) return;
    const missingReason = wechatSubmitMissingReason(wechatForm);
    if (missingReason) {
      setError(missingReason);
      return;
    }
    setWechatBusy(true);
    setError('');
    try {
      const savedAsset = await persistPreviewDraft();
      if (savedAsset?.complianceFlags?.length) {
        setError(`合规词命中，请修改后再提交：${savedAsset.complianceFlags.join('、')}`);
        return;
      }
      const accountResult = await wechatPublishing.availableAccounts(wechatForm.brandId);
      const latestAccounts = Array.isArray(accountResult?.items) ? accountResult.items : [];
      const latestIds = new Set(latestAccounts.map((account: WechatAccountOption) => account.id));
      const selectedAccountIds = wechatForm.accountIds.filter((accountId) =>
        latestIds.has(accountId)
      );
      const effectiveAccountIds = selectedAccountIds.length
        ? selectedAccountIds
        : latestAccounts.length === 1
          ? [latestAccounts[0].id]
          : [];
      if (!effectiveAccountIds.length) {
        setWechatAccounts(latestAccounts);
        setWechatForm((current) => ({ ...current, accountIds: [] }));
        setError(
          '\u5df2\u9009\u516c\u4f17\u53f7\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u53ef\u7528\u516c\u4f17\u53f7\u540e\u518d\u63d0\u4ea4'
        );
        return;
      }
      setWechatAccounts(latestAccounts);
      setWechatForm((current) => ({ ...current, accountIds: effectiveAccountIds }));
      const title = truncate(copyText(previewItem).split(/\n/)[0] || previewItem.prompt, 56);
      const body = copyText({ ...previewItem, draft: previewDraft });
      await Promise.all(
        effectiveAccountIds.map((accountId) =>
          wechatPublishing.createReviewVersion({
            sourceContentId: previewItem.id,
            brandId: wechatForm.brandId,
            brandName:
              brandOptions.find((brand) => brand.id === wechatForm.brandId)?.label ||
              wechatForm.brandId,
            accountId,
            title,
            digest: wechatForm.digest.trim(),
            author: 'Rhautt Comfort',
            contentHtml: `<p>${body.replace(/[<&>]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[char] || char).replace(/\n+/g, '</p><p>')}</p>`,
            sourceUrl: wechatForm.sourceUrl.trim() || undefined,
            coverImage: { assetId: wechatForm.coverAssetId.trim() },
            bodyImages: selectedMaterialItems
              .filter(
                (item) => item.fileArtifactId && item.fileArtifactId !== wechatForm.coverAssetId
              )
              .map((item) => ({ assetId: item.fileArtifactId, caption: item.label })),
          })
        )
      );
      setMessage(`已提交 ${effectiveAccountIds.length} 个公众号审核`);
      await loadWechatTasks();
      setWechatSubmitOpen(false);
      closeCopyWorkbench();
      await load();
    } catch (submitError) {
      setError((submitError as Error).message || '提交审核失败');
    } finally {
      setWechatBusy(false);
    }
  }

  const previewSavedDraft = previewItem ? copyText(previewItem) : '';
  const previewDirty = Boolean(previewItem && previewDraft !== previewSavedDraft);
  const previewCanEdit = Boolean(previewItem && previewItem.status !== 'rejected');
  const previewSections = useMemo(() => parseDraftSections(previewDraft), [previewDraft]);
  const previewTitle = useMemo(() => {
    const section = previewSections.find((item) => /标题|title/i.test(item.title));
    const source =
      section?.body ||
      previewDraft
        .split(/\n/)
        .map((line) => line.trim())
        .find(Boolean) ||
      previewItem?.prompt ||
      '';
    return truncate(source.replace(/^#+\s*/, '').replace(/^标题[:：]\s*/, ''), 72);
  }, [previewDraft, previewItem?.prompt, previewSections]);
  const previewStatusText = previewItem
    ? previewItem.complianceFlags.length
      ? `${previewItem.complianceFlags.length} 项合规命中`
      : previewDirty
        ? '修改后待保存'
        : '可进入下一步'
    : generateBusy
      ? '生成中'
      : '等待生成';
  const workbenchOpen = generationWorkbenchOpen || Boolean(previewItem);
  const visibleDraftCount = filtered.filter((item) => item.status === 'draft').length;
  const selectedDraftCount = allItems.filter(
    (item) => selectedIds.includes(item.id) && item.status === 'draft'
  ).length;
  const todayKey = formatDate(new Date().toISOString());
  const todayCount = allItems.filter((item) => formatDate(item.createdAt) === todayKey).length;
  const readyReviewCount = allItems.filter(
    (item) => item.status === 'draft' && !item.complianceFlags.length
  ).length;
  const blockedCount = allItems.filter(
    (item) => item.status === 'draft' && item.complianceFlags.length > 0
  ).length;
  const approvedCount = allItems.filter((item) => item.status === 'approved').length;

  return (
    <section className="card-elevated growth-copy-workbench">
      <div className="growth-copy-workbench__header">
        <div>
          <p className="t-label">文案管理</p>
          <h2 className="t-headline mt-1">文案生成与审核</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            聚焦 AI 草稿生成、合规命中处理和审核流转；内容工厂总控请在“内容工厂”入口处理。
          </p>
        </div>
        <div className="growth-copy-workbench__summary" aria-label="当前筛选结果摘要">
          <span>
            <strong>{todayCount}</strong> 今日新增
          </span>
          <span>
            <strong>{readyReviewCount}</strong> 待审核
          </span>
          <span>
            <strong>{blockedCount}</strong> 合规命中
          </span>
          <span>
            <strong>{approvedCount}</strong> 可发布
          </span>
          <button
            className="btn btn-brand btn-sm"
            onClick={() => setGeneratorOpen(true)}
            aria-label="打开 AI 生成文案"
          >
            <Sparkles size={13} />
            AI 生成
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={load}
            disabled={busy}
            aria-label="刷新文案列表"
          >
            <RefreshCw size={13} />
            刷新
          </button>
        </div>
      </div>

      <div
        className={`inset growth-copy-generator ${generatorOpen ? 'growth-copy-generator--open' : ''}`}
      >
        <button
          type="button"
          className="growth-copy-generator__toggle"
          onClick={() => setGeneratorOpen((current) => !current)}
          aria-expanded={generatorOpen}
        >
          <span>
            <Sparkles size={16} className="text-primary" />
            <span className="t-label">AI 生成文案</span>
          </span>
          <span className="growth-copy-generator__hint">
            {generatorOpen ? '收起生成表单' : '展开生成新草稿'}
          </span>
          {generatorOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <div className="growth-copy-generator__panel" aria-hidden={!generatorOpen}>
          <div className="growth-copy-generator__panel-inner">
            <div className="growth-copy-contextbar" aria-label="文案生成上下文">
              <label>
                <span className="t-label">品牌</span>
                <select
                  className="input"
                  value={generateForm.brandSlug}
                  onChange={(event) => patchGenerateForm({ brandSlug: event.target.value })}
                  tabIndex={generatorOpen ? undefined : -1}
                >
                  <option value="">全部品牌</option>
                  {brandOptions.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="t-label">渠道</span>
                <select
                  className="input"
                  value={generateForm.channel}
                  onChange={(event) => patchGenerateForm({ channel: event.target.value })}
                  tabIndex={generatorOpen ? undefined : -1}
                >
                  {CHANNELS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="growth-copy-contextbar__summary" role="status">
                <span>当前范围</span>
                <strong>{activeBrandLabel}</strong>
                <strong>{activeChannelLabel}</strong>
              </div>
            </div>
            <div className="growth-copy-commandbar">
              <div className="growth-copy-scenarios" aria-label="常用生成场景">
                {COPY_SCENARIOS.map((scenario) => (
                  <button
                    key={scenario.label}
                    type="button"
                    className={`growth-copy-scenario ${generateForm.channel === scenario.channel && briefForm.objective === scenario.objective ? 'growth-copy-scenario--active' : ''}`}
                    onClick={() => applyScenario(scenario)}
                    tabIndex={generatorOpen ? undefined : -1}
                  >
                    {scenario.label}
                  </button>
                ))}
              </div>
              <label className="growth-copy-commandbar__input">
                <span className="t-label">这次要生成什么</span>
                <input
                  className="input"
                  value={briefForm.coreMessage}
                  onChange={(event) => patchBriefForm({ coreMessage: event.target.value })}
                  placeholder="例如：给小红书写一条热水系统种草文案，突出节能、恒温和安装前条件"
                  tabIndex={generatorOpen ? undefined : -1}
                />
              </label>
              <button
                className="btn btn-brand growth-copy-generate-btn"
                onClick={generate}
                disabled={generateBusy || busy}
                tabIndex={generatorOpen ? undefined : -1}
              >
                {generateBusy ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                {generateBusy ? '生成中' : '生成文案'}
              </button>
            </div>
            <div className="growth-copy-brief-chips" aria-label="常用卖点快捷填充">
              {COPY_BRIEF_CHIPS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => appendBriefChip(item)}
                  tabIndex={generatorOpen ? undefined : -1}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="growth-copy-production-grid">
              <div className="growth-copy-production-panel">
                <div className="growth-copy-production-panel__head">
                  <span>
                    <Package size={14} />
                    启用产品库
                  </span>
                  {contextBusy ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <span>{selectedProducts.length} 已选</span>
                  )}
                </div>
                <input
                  className="input"
                  value={productionQuery}
                  onChange={(event) => setProductionQuery(event.target.value)}
                  placeholder="搜索启用产品、卖点或内容素材"
                  tabIndex={generatorOpen ? undefined : -1}
                />
                <div className="growth-copy-pick-list">
                  {productionContext.products.slice(0, 6).map((item) => {
                    const checked = selectedProducts.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`growth-copy-pick ${checked ? 'growth-copy-pick--active' : ''}`}
                        onClick={() => toggleProductSelection(item)}
                        tabIndex={generatorOpen ? undefined : -1}
                      >
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.meta || '产品事实'}</small>
                        </span>
                        <span
                          className={item.verified ? 'badge badge-success' : 'badge badge-warning'}
                        >
                          {item.verified ? '已校验' : '待校验'}
                        </span>
                      </button>
                    );
                  })}
                  {!contextBusy && !productionContext.products.length ? (
                    <span className="growth-copy-empty">
                      {generateForm.brandSlug
                        ? `当前品牌 ${activeBrandLabel} 暂无启用产品，可切换品牌或查看产品库发布状态`
                        : '暂无启用产品，请先在产品库启用并发布产品'}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="growth-copy-production-panel">
                <div className="growth-copy-production-panel__head">
                  <span>
                    <CheckCircle2 size={14} />
                    卖点证据
                  </span>
                  <span>{selectedSellingPoints.length} 已选</span>
                </div>
                <div className="growth-copy-pick-list">
                  {productionContext.sellingPoints.slice(0, 7).map((item) => {
                    const checked = selectedSellingPoints.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`growth-copy-pick ${checked ? 'growth-copy-pick--active' : ''}`}
                        onClick={() => toggleSelection(item.id, setSelectedSellingPoints)}
                        tabIndex={generatorOpen ? undefined : -1}
                      >
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.meta || '卖点'}</small>
                        </span>
                        <span
                          className={item.verified ? 'badge badge-success' : 'badge badge-warning'}
                        >
                          {item.verified ? '可外宣' : '需补证据'}
                        </span>
                      </button>
                    );
                  })}
                  {!contextBusy && !productionContext.sellingPoints.length ? (
                    <span className="growth-copy-empty">暂无可选卖点</span>
                  ) : null}
                </div>
              </div>
              <div className="growth-copy-production-panel">
                <div className="growth-copy-production-panel__head">
                  <span>
                    <FileImage size={14} />
                    内容素材库
                  </span>
                  <label className="btn btn-outline btn-sm growth-copy-upload-btn">
                    {uploadBusy ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Upload size={13} />
                    )}
                    上传
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) => uploadProductionImage(event.target.files?.[0], 'body')}
                      tabIndex={generatorOpen ? undefined : -1}
                    />
                  </label>
                </div>
                <div className="growth-copy-material-list">
                  {productionContext.materials.slice(0, 8).map((item) => {
                    const checked =
                      selectedMaterials.includes(item.id) ||
                      Boolean(
                        item.fileArtifactId && selectedMaterials.includes(item.fileArtifactId)
                      );
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`growth-copy-material ${checked ? 'growth-copy-material--active' : ''}`}
                        onClick={() => toggleSelection(item.id, setSelectedMaterials)}
                        tabIndex={generatorOpen ? undefined : -1}
                      >
                        <span className="growth-copy-material__thumb">
                          {item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt="" loading="lazy" />
                          ) : (
                            <FileImage size={16} />
                          )}
                        </span>
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.meta || item.type || '素材'}</small>
                        </span>
                      </button>
                    );
                  })}
                  {!contextBusy && !productionContext.materials.length ? (
                    <span className="growth-copy-empty">
                      暂无内容素材，请到素材库上传或在此上传后入库
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <details className="growth-copy-advanced-prompt">
              <summary>细化设置</summary>
              <div className="growth-copy-settings-row">
                <label>
                  <span className="t-label">产品/主题</span>
                  <input
                    className="input"
                    value={briefForm.productFocus}
                    onChange={(event) => patchBriefForm({ productFocus: event.target.value })}
                    placeholder="热水与舒适系统"
                    tabIndex={generatorOpen ? undefined : -1}
                  />
                </label>
                <label>
                  <span className="t-label">营销目标</span>
                  <select
                    className="input"
                    value={briefForm.objective}
                    onChange={(event) => patchBriefForm({ objective: event.target.value })}
                    tabIndex={generatorOpen ? undefined : -1}
                  >
                    {COPY_OBJECTIVES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="t-label">目标人群</span>
                  <select
                    className="input"
                    value={briefForm.audience}
                    onChange={(event) => patchBriefForm({ audience: event.target.value })}
                    tabIndex={generatorOpen ? undefined : -1}
                  >
                    {COPY_AUDIENCES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="t-label">表达语气</span>
                  <select
                    className="input"
                    value={briefForm.tone}
                    onChange={(event) => patchBriefForm({ tone: event.target.value })}
                    tabIndex={generatorOpen ? undefined : -1}
                  >
                    {COPY_TONES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="growth-copy-settings-row growth-copy-settings-row--wide">
                <label>
                  <span className="t-label">合规边界</span>
                  <input
                    className="input"
                    value={briefForm.complianceFocus}
                    onChange={(event) => patchBriefForm({ complianceFocus: event.target.value })}
                    tabIndex={generatorOpen ? undefined : -1}
                  />
                </label>
                <label>
                  <span className="t-label">提示词蓄水池</span>
                  <select
                    className="input"
                    value={generateForm.promptTemplateId}
                    onChange={(event) => selectPromptTemplate(event.target.value)}
                    tabIndex={generatorOpen ? undefined : -1}
                  >
                    <option value="">本次手工填写</option>
                    {promptTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ·{' '}
                        {PROMPT_EVIDENCE[template.evidenceState]?.label || '待验证'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <textarea
                className="input mt-2 resize-y"
                rows={2}
                value={generateForm.prompt}
                onChange={(event) =>
                  patchGenerateForm({ prompt: event.target.value, promptTemplateId: '' })
                }
                placeholder="高级：仅在需要完全覆盖上方 brief 时填写；留空则自动按运营 brief 生成"
                tabIndex={generatorOpen ? undefined : -1}
              />
            </details>
            <div className="flex min-h-0 flex-wrap items-center gap-2">
              {message && <span className="badge badge-success">{message}</span>}
              {error && <span className="badge badge-warning">{error}</span>}
            </div>
          </div>
        </div>
        {!generatorOpen && (message || error) ? (
          <div className="flex flex-wrap gap-2">
            {message && <span className="badge badge-success">{message}</span>}
            {error && <span className="badge badge-warning">{error}</span>}
          </div>
        ) : null}
      </div>

      <div className="growth-copy-filterbar">
        <div className="growth-copy-filterbar__search">
          <Search size={16} className="text-muted-foreground/70" />
          <input
            className="input"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索提示词或文案内容"
          />
        </div>
        <select
          className="input w-[150px]"
          value={channelFilter}
          onChange={(event) => {
            setChannelFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">全部渠道</option>
          {CHANNELS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          className="input w-[140px]"
          value={brandFilter}
          onChange={(event) => {
            setBrandFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">全部品牌</option>
          {brandOptions.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.label}
            </option>
          ))}
          <option value="">未指定品牌</option>
        </select>
        <select
          className="input w-[140px]"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">全部状态</option>
          <option value="draft">草稿</option>
          <option value="approved">已审核</option>
          <option value="rejected">已拒绝</option>
          <option value="published">已发布</option>
        </select>
      </div>

      {selectedIds.length > 0 && (
        <div role="status" className="growth-copy-bulkbar">
          <strong>
            已选 {selectedIds.length} 条文案，{selectedDraftCount} 条可进入审核动作
          </strong>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-success btn-sm"
              onClick={bulkApprove}
              disabled={bulkBusy || busy}
            >
              <CheckCircle2 size={13} />
              批量通过
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={bulkReject}
              disabled={bulkBusy || busy}
            >
              <XCircle size={13} />
              批量拒绝
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>
              取消选择
            </button>
          </div>
        </div>
      )}

      <div className="table-shell growth-copy-table-shell">
        <table className="table growth-copy-table">
          <thead>
            <tr>
              <th>
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={!visibleIds.length || busy}
                  onChange={(event) => toggleVisible(event.target.checked)}
                  aria-label="选择当前页全部文案"
                />
              </th>
              <th>文案摘要</th>
              <th>
                <button
                  onClick={() => toggleSort('channel')}
                  aria-label="按发布对象排序"
                  className={`inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 whitespace-nowrap [font:inherit] ${
                    sortBy === 'channel' || sortBy === 'brandSlug' ? 'text-primary' : 'text-inherit'
                  }`}
                >
                  发布对象
                  {sortBy === 'channel' || sortBy === 'brandSlug'
                    ? sortIcon(sortBy)
                    : sortIcon('channel')}
                </button>
              </th>
              <th>
                <button
                  onClick={() => toggleSort('status')}
                  aria-label="按审核状态排序"
                  className={`inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 whitespace-nowrap [font:inherit] ${
                    sortBy === 'status' ? 'text-primary' : 'text-inherit'
                  }`}
                >
                  审核状态{sortIcon('status')}
                </button>
              </th>
              <th>
                <button
                  onClick={() => toggleSort('createdAt')}
                  aria-label="按创建时间排序"
                  className={`inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 whitespace-nowrap [font:inherit] ${
                    sortBy === 'createdAt' ? 'text-primary' : 'text-inherit'
                  }`}
                >
                  创建时间{sortIcon('createdAt')}
                </button>
              </th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const hasCompliance = Boolean(item.complianceFlags?.length);
              const selected = selectedIds.includes(item.id);
              const openPreview = () => openCopyWorkbench(item);
              const actionLabel =
                item.status === 'draft' ? (hasCompliance ? '处理' : '审核') : '查看';
              const actionClassName =
                item.status === 'draft' && !hasCompliance
                  ? 'btn btn-brand btn-sm growth-copy-row-action'
                  : hasCompliance
                    ? 'btn btn-warning btn-sm growth-copy-row-action'
                    : 'btn btn-outline btn-sm growth-copy-row-action';
              return (
                <tr key={item.id} className={selected ? 'bg-[var(--brand-50)]' : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) =>
                        setSelectedIds((current) =>
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id)
                        )
                      }
                      aria-label={`选择${truncate(copyText(item), 20)}`}
                    />
                  </td>
                  <td>
                    <div className="growth-copy-table__summary">
                      <strong>{truncate(copyText(item) || item.prompt, 120)}</strong>
                      <span>
                        {!item.draft
                          ? '草稿为空，显示提示词'
                          : `审核人：${item.reviewer || '未分配'}`}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="growth-copy-table__target">
                      <span className="badge badge-info">{channelLabel(item.channel)}</span>
                      <span>{displayBrand(item.brandSlug)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="growth-copy-table__review-state">
                      {statusBadge(item.status)}
                      {hasCompliance ? (
                        <span
                          className="badge badge-danger growth-copy-table__compliance"
                          title={item.complianceFlags.join('、')}
                        >
                          {item.complianceFlags.length} 项合规命中
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    <div className="growth-copy-table__actions">
                      <button
                        className={actionClassName}
                        onClick={openPreview}
                        disabled={busy}
                        aria-label={`${actionLabel}这条文案`}
                      >
                        <PenLine size={13} />
                        {actionLabel}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!busy && !items.length && (
              <tr>
                <td colSpan={6} className="p-7 text-center text-muted-foreground">
                  暂无文案，请先生成一条草稿。
                </td>
              </tr>
            )}
            {busy && (
              <tr>
                <td colSpan={6} className="p-7 text-center">
                  <Loader2 size={18} className="animate-spin align-middle text-primary" />
                  <span className="ml-2">加载中</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <WorkbenchPaginationFooter
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={sorted.length}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        onPageChange={busy ? undefined : setPage}
        onPrevious={busy || currentPage <= 1 ? undefined : () => setPage(currentPage - 1)}
        onNext={busy || currentPage >= totalPages ? undefined : () => setPage(currentPage + 1)}
      />

      {workbenchOpen && (
        <div className="growth-copy-modal" onClick={closeCopyWorkbench}>
          <div
            onClick={(event) => event.stopPropagation()}
            className="card-elevated growth-copy-draft-workbench"
            role="dialog"
            aria-modal="true"
            aria-labelledby="growth-copy-workbench-title"
          >
            <div className="growth-copy-draft-workbench__header">
              <div>
                <p className="t-label">{'AI \u6587\u6848\u751f\u6210\u5de5\u4f5c\u53f0'}</p>
                <h3 id="growth-copy-workbench-title">
                  {previewItem
                    ? '\u6587\u6848\u7f16\u8f91\u4e0e\u5ba1\u6838'
                    : '\u6b63\u5728\u751f\u6210\u6587\u6848'}
                </h3>
                <div className="growth-copy-draft-workbench__badges">
                  {previewItem ? (
                    statusBadge(previewItem.status)
                  ) : (
                    <span className="badge badge-info">{'\u751f\u6210\u4e2d'}</span>
                  )}
                  <span className="badge badge-info">
                    {previewItem ? channelLabel(previewItem.channel) : activeChannelLabel}
                  </span>
                  <span className="badge badge-grey">
                    {previewItem?.brandSlug
                      ? displayBrand(previewItem.brandSlug)
                      : activeBrandLabel}
                  </span>
                  {previewDirty ? (
                    <span className="badge badge-warning">
                      {'\u6709\u672a\u4fdd\u5b58\u4fee\u6539'}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm icon-only"
                onClick={closeCopyWorkbench}
                disabled={generateBusy}
                aria-label={'\u5173\u95ed\u751f\u6210\u5de5\u4f5c\u53f0'}
              >
                <X size={18} />
              </button>
            </div>

            <div className="growth-copy-generation-steps" aria-label={'\u751f\u6210\u8fdb\u5ea6'}>
              {generationSteps.map((step, index) => {
                const done = Boolean(previewItem) || generationStage > index;
                const active = generateBusy && generationStage === index;
                return (
                  <div
                    key={step}
                    className={`growth-copy-generation-step ${done ? 'growth-copy-generation-step--done' : ''} ${active ? 'growth-copy-generation-step--active' : ''}`}
                  >
                    <span>
                      {done ? (
                        <CheckCircle2 size={13} />
                      ) : active ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <strong>{step}</strong>
                  </div>
                );
              })}
            </div>

            <div className="growth-copy-draft-workbench__grid">
              <div className="growth-copy-draft-workbench__main">
                {!previewItem ? (
                  <div className="growth-copy-stream-placeholder" role="status">
                    <Loader2 size={22} className="animate-spin" />
                    <strong>{'AI \u6b63\u5728\u751f\u6210\u6e20\u9053\u8349\u7a3f'}</strong>
                    <span>
                      {
                        '\u5df2\u8bfb\u53d6\u5f53\u524d\u54c1\u724c\u3001\u4ea7\u54c1\u3001\u7d20\u6750\u548c\u5408\u89c4\u8fb9\u754c\uff0c\u751f\u6210\u5b8c\u6210\u540e\u4f1a\u76f4\u63a5\u5728\u8fd9\u91cc\u5c55\u793a\u5e76\u53ef\u7f16\u8f91\u3002'
                      }
                    </span>
                    <div className="growth-copy-stream-lines" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="growth-copy-draft-workbench__section-head">
                      <span>
                        <PenLine size={14} />
                        {previewTitle || '\u6587\u6848\u6b63\u6587'}
                      </span>
                      <small>
                        {previewDraft.trim().length} {'\u5b57'}
                      </small>
                    </div>
                    {previewSections.length ? (
                      <div
                        className="growth-copy-draft-preview"
                        aria-label={'\u7ed3\u6784\u5316\u6587\u6848\u9884\u89c8'}
                      >
                        {previewSections.slice(0, 6).map((section) => (
                          <section key={`${section.title}-${section.body.slice(0, 12)}`}>
                            <span>{section.title}</span>
                            <p>{section.body}</p>
                          </section>
                        ))}
                      </div>
                    ) : null}
                    <textarea
                      className="input growth-copy-draft-editor"
                      value={previewDraft}
                      onChange={(event) => setPreviewDraft(event.target.value)}
                      readOnly={!previewCanEdit}
                      aria-label={'\u6587\u6848\u6b63\u6587\u7f16\u8f91\u5668'}
                      rows={14}
                    />
                    <p className="growth-copy-draft-workbench__hint">
                      {previewCanEdit
                        ? '\u4fee\u6539\u540e\u8bf7\u5148\u4fdd\u5b58\uff1b\u5ba1\u6838\u901a\u8fc7\u548c\u63d0\u4ea4\u516c\u4f17\u53f7\u5ba1\u6838\u4f1a\u81ea\u52a8\u4fdd\u5b58\u6700\u65b0\u6b63\u6587\u5e76\u91cd\u65b0\u6821\u9a8c\u5408\u89c4\u3002'
                        : '\u5df2\u62d2\u7edd\u6587\u6848\u4e0d\u53ef\u518d\u7f16\u8f91\uff0c\u53ef\u5220\u9664\u540e\u91cd\u65b0\u751f\u6210\u3002'}
                    </p>
                  </>
                )}
              </div>

              <aside
                className="growth-copy-draft-workbench__side"
                aria-label={'\u751f\u6210\u4f9d\u636e\u4e0e\u5408\u89c4\u72b6\u6001'}
              >
                <section>
                  <div className="growth-copy-draft-workbench__section-head">
                    <span>
                      <Package size={14} />
                      {'\u751f\u6210\u4e0a\u4e0b\u6587'}
                    </span>
                  </div>
                  <div className="growth-copy-context-summary">
                    <span>
                      <strong>{'\u6e20\u9053'}</strong>
                      {previewItem ? channelLabel(previewItem.channel) : activeChannelLabel}
                    </span>
                    <span>
                      <strong>{'\u54c1\u724c'}</strong>
                      {previewItem?.brandSlug
                        ? displayBrand(previewItem.brandSlug)
                        : activeBrandLabel}
                    </span>
                    <span>
                      <strong>{'\u4ea7\u54c1'}</strong>
                      {selectedProductItems.length
                        ? selectedProductItems.map((item) => item.label).join('\u3001')
                        : '\u672a\u624b\u52a8\u9009\u62e9'}
                    </span>
                    <span>
                      <strong>{'\u7d20\u6750'}</strong>
                      {selectedMaterialItems.length
                        ? selectedMaterialItems.map((item) => item.label).join('\u3001')
                        : '\u672a\u9009\u62e9\u7d20\u6750'}
                    </span>
                    <span>
                      <strong>{'\u4eba\u7fa4'}</strong>
                      {briefForm.audience}
                    </span>
                  </div>
                </section>
                <section>
                  <div className="growth-copy-draft-workbench__section-head">
                    <span>
                      <AlertCircle size={14} />
                      {'\u5408\u89c4\u521d\u7b5b'}
                    </span>
                  </div>
                  <div
                    className={`growth-copy-compliance-card ${previewItem?.complianceFlags?.length ? 'growth-copy-compliance-card--danger' : 'growth-copy-compliance-card--ok'}`}
                  >
                    <strong>{previewStatusText}</strong>
                    {previewItem?.complianceFlags?.length ? (
                      <p>
                        {'\u547d\u4e2d\u8bcd\uff1a'}
                        {previewItem.complianceFlags.join('\u3001')}
                      </p>
                    ) : (
                      <p>
                        {previewItem
                          ? '\u5f53\u524d\u8349\u7a3f\u672a\u547d\u4e2d\u7cfb\u7edf\u5408\u89c4\u8bcd\uff0c\u53ef\u4fdd\u5b58\u540e\u8fdb\u5165\u5ba1\u6838\u3002'
                          : '\u751f\u6210\u5b8c\u6210\u540e\u4f1a\u81ea\u52a8\u663e\u793a\u5408\u89c4\u547d\u4e2d\u7ed3\u679c\u3002'}
                      </p>
                    )}
                  </div>
                </section>
                {/* GEO 可抽取性（生成时评估，迁移 112）：形态启发式——分低≠不能发，
                    是提示"AI 引擎摘不动这个形态"；通过≠必被引用（还取决于站点权威度）。 */}
                {previewItem?.extractability &&
                typeof previewItem.extractability.score === 'number' ? (
                  <section>
                    <div className="growth-copy-draft-workbench__section-head">
                      <span>
                        <Sparkles size={14} />
                        GEO 可抽取性
                      </span>
                    </div>
                    <div
                      className={`growth-copy-compliance-card ${previewItem.extractability.passed ? 'growth-copy-compliance-card--ok' : 'growth-copy-compliance-card--danger'}`}
                    >
                      <strong>
                        {previewItem.extractability.score}/100 ·{' '}
                        {previewItem.extractability.passed
                          ? '形态达标（可被 AI 抽取引用的结构）'
                          : '形态偏弱——引擎摘要难以直接引用'}
                      </strong>
                      {(previewItem.extractability.hints?.length ?? 0) > 0 ? (
                        <ul className="mt-1 list-disc pl-4">
                          {previewItem.extractability.hints!.slice(0, 4).map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>答案先行 / 直接回答句 / 可切分 / 结构化 / 事实密度 五项全过。</p>
                      )}
                      <p className="opacity-70">
                        启发式形态检查：通过≠必被引用；分低不拦发布，由审核人权衡。
                      </p>
                    </div>
                  </section>
                ) : null}
                <section>
                  <div className="growth-copy-draft-workbench__section-head">
                    <span>
                      <Factory size={14} />
                      {'\u4e0b\u4e00\u6b65'}
                    </span>
                  </div>
                  <div className="growth-copy-next-steps">
                    <span className={previewItem ? 'badge badge-success' : 'badge badge-grey'}>
                      {'1 \u8349\u7a3f\u751f\u6210'}
                    </span>
                    <span
                      className={
                        previewItem && !previewItem.complianceFlags.length
                          ? 'badge badge-success'
                          : 'badge badge-warning'
                      }
                    >
                      {'2 \u5408\u89c4\u5904\u7406'}
                    </span>
                    <span className="badge badge-info">
                      {'3 \u5165\u5e93\u6216\u63d0\u4ea4\u5ba1\u6838'}
                    </span>
                  </div>
                </section>
              </aside>
            </div>

            {wechatSubmitOpen && previewItem && (
              <div className="inset growth-copy-wechat-submit-panel">
                <div className="flex items-center justify-between gap-2.5">
                  <span className="t-label">
                    {'\u5fae\u4fe1\u516c\u4f17\u53f7\u5ba1\u6838\u76ee\u6807'}
                  </span>
                  {wechatBusy ? <Loader2 size={14} className="animate-spin text-primary" /> : null}
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
                  <label className="grid gap-1.5">
                    <span className="t-label">{'\u54c1\u724c'}</span>
                    <select
                      className="input"
                      value={wechatForm.brandId}
                      onChange={(event) => {
                        const brandId = event.target.value;
                        setWechatForm({ ...wechatForm, brandId, accountIds: [] });
                        loadWechatAccounts(brandId);
                      }}
                    >
                      {brandOptions.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="t-label">{'\u539f\u6587\u94fe\u63a5'}</span>
                    <input
                      className="input"
                      value={wechatForm.sourceUrl}
                      onChange={(event) =>
                        setWechatForm({ ...wechatForm, sourceUrl: event.target.value })
                      }
                      placeholder={'\u53ef\u9009'}
                    />
                  </label>
                </div>
                <div className="growth-copy-cover-picker">
                  <div className="growth-copy-production-panel__head">
                    <span>
                      <FileImage size={14} />
                      {'\u516c\u4f17\u53f7\u5c01\u9762'}
                    </span>
                    <label className="btn btn-outline btn-sm growth-copy-upload-btn">
                      {uploadBusy ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Upload size={13} />
                      )}
                      {'\u4e0a\u4f20\u5c01\u9762'}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(event) =>
                          uploadProductionImage(event.target.files?.[0], 'cover')
                        }
                      />
                    </label>
                  </div>
                  <div className="growth-copy-material-list growth-copy-material-list--cover">
                    {productionContext.materials
                      .filter((item) => item.fileArtifactId || item.thumbnailUrl)
                      .slice(0, 10)
                      .map((item) => {
                        const assetId = item.fileArtifactId || item.id;
                        const checked = wechatForm.coverAssetId === assetId;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`growth-copy-material ${checked ? 'growth-copy-material--active' : ''}`}
                            onClick={() => {
                              setWechatForm({ ...wechatForm, coverAssetId: assetId });
                              setSelectedMaterials((current) =>
                                Array.from(new Set([...current, item.id]))
                              );
                            }}
                          >
                            <span className="growth-copy-material__thumb">
                              {item.thumbnailUrl ? (
                                <img src={item.thumbnailUrl} alt="" loading="lazy" />
                              ) : (
                                <FileImage size={16} />
                              )}
                            </span>
                            <span>
                              <strong>{item.label}</strong>
                              <small>{item.type || item.meta || '\u5c01\u9762\u56fe'}</small>
                            </span>
                          </button>
                        );
                      })}
                    {!productionContext.materials.length ? (
                      <span className="growth-copy-empty">
                        {
                          '\u8bf7\u4ece\u5185\u5bb9\u7d20\u6750\u5e93\u9009\u62e9\uff0c\u6216\u4e0a\u4f20\u5c01\u9762\u56fe\u540e\u81ea\u52a8\u5165\u5e93'
                        }
                      </span>
                    ) : null}
                  </div>
                  {selectedCoverMaterial ? (
                    <span className="badge badge-success">
                      {'\u5df2\u9009\u5c01\u9762\uff1a'}
                      {selectedCoverMaterial.label}
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {
                        '\u8be5\u54c1\u724c\u4e0b\u53ef\u7528\u516c\u4f17\u53f7\uff0c\u652f\u6301\u5355\u9009\u6216\u5168\u9009'
                      }
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={!wechatAccounts.length}
                      onClick={() =>
                        setWechatForm({
                          ...wechatForm,
                          accountIds:
                            wechatForm.accountIds.length === wechatAccounts.length
                              ? []
                              : wechatAccounts.map((account) => account.id),
                        })
                      }
                    >
                      {wechatForm.accountIds.length === wechatAccounts.length &&
                      wechatAccounts.length
                        ? '\u53d6\u6d88\u5168\u9009'
                        : '\u5168\u9009'}
                    </button>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2">
                    {wechatAccounts.map((account) => {
                      const checked = wechatForm.accountIds.includes(account.id);
                      return (
                        <label
                          key={account.id}
                          className={`inset flex items-center gap-2.5 p-2.5 ${
                            checked ? 'border-[var(--brand)]' : 'border-[var(--border)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setWechatForm({
                                ...wechatForm,
                                accountIds: event.target.checked
                                  ? Array.from(new Set([...wechatForm.accountIds, account.id]))
                                  : wechatForm.accountIds.filter((id) => id !== account.id),
                              })
                            }
                          />
                          <span className="grid gap-0.5">
                            <strong className="text-[13px]">{account.displayName}</strong>
                            <span className="text-[11px] text-muted-foreground/70">
                              {account.appIdMasked}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                    {!wechatBusy && !wechatAccounts.length ? (
                      <div className="inset p-2.5 text-xs text-destructive">
                        {
                          '\u5f53\u524d\u54c1\u724c\u6ca1\u6709\u5df2\u542f\u7528\u4e14\u8fde\u63a5\u6b63\u5e38\u7684\u516c\u4f17\u53f7\uff0c\u8bf7\u5148\u5230\u201c\u53d1\u5e03\u8d26\u53f7\u914d\u7f6e\u201d\u5b8c\u6210\u6d4b\u8bd5\u5e76\u542f\u7528\u3002'
                        }
                      </div>
                    ) : null}
                  </div>
                </div>
                <textarea
                  className="input"
                  rows={2}
                  value={wechatForm.digest}
                  onChange={(event) => setWechatForm({ ...wechatForm, digest: event.target.value })}
                  placeholder={'\u516c\u4f17\u53f7\u6458\u8981'}
                />
                {wechatTasks.length ? (
                  <div className="growth-copy-wechat-tasks">
                    <span className="t-label">{'\u6700\u8fd1\u8349\u7a3f\u7bb1\u540c\u6b65'}</span>
                    {wechatTasks.map((task: any) => (
                      <div key={task.id} className="growth-copy-wechat-task">
                        <strong>
                          {task.accountName ||
                            task.accountDisplayName ||
                            task.accountId ||
                            '\u516c\u4f17\u53f7'}
                        </strong>
                        <span
                          className={`badge ${task.status === 'succeeded' ? 'badge-success' : task.status === 'failed' ? 'badge-danger' : 'badge-info'}`}
                        >
                          {task.status === 'succeeded'
                            ? '\u5df2\u63a8\u9001\u8349\u7a3f\u7bb1'
                            : task.status === 'failed'
                              ? '\u63a8\u9001\u5931\u8d25'
                              : task.status || '\u5904\u7406\u4e2d'}
                        </span>
                        <small>
                          {task.wechatDraftId
                            ? `\u8349\u7a3f\u7f16\u53f7\uff1a${task.wechatDraftId}`
                            : task.errorSummary ||
                              '\u7b49\u5f85\u516c\u4f17\u53f7\u8fd4\u56de\u8349\u7a3f\u7ed3\u679c'}
                        </small>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={
                      wechatSubmitMissingReason(wechatForm)
                        ? 'badge badge-warning'
                        : 'badge badge-success'
                    }
                  >
                    {wechatSubmitMissingReason(wechatForm) ||
                      `\u5c06\u63d0\u4ea4\u5230 ${wechatForm.accountIds.length} \u4e2a\u516c\u4f17\u53f7\u5ba1\u6838`}
                  </span>
                  <button
                    className="btn btn-brand btn-sm"
                    onClick={submitWechatReview}
                    disabled={wechatBusy || Boolean(wechatSubmitMissingReason(wechatForm))}
                    title={wechatSubmitMissingReason(wechatForm) || undefined}
                  >
                    <Send size={14} />
                    {'\u786e\u8ba4\u63d0\u4ea4\u5ba1\u6838'}
                  </button>
                </div>
              </div>
            )}

            <div className="growth-copy-draft-workbench__footer">
              <div className="growth-copy-draft-workbench__footer-status">
                {generateBusy ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {'\u6b63\u5728\u751f\u6210\uff0c\u8bf7\u7a0d\u5019'}
                  </>
                ) : (
                  <>{previewStatusText}</>
                )}
              </div>
              <div className="growth-copy-draft-workbench__actions">
                {generateBusy ? (
                  <button className="btn btn-outline btn-sm" disabled>
                    <Loader2 size={14} className="animate-spin" />
                    {'\u751f\u6210\u4e2d'}
                  </button>
                ) : null}
                {previewItem ? (
                  <button
                    className="btn btn-brand btn-sm"
                    onClick={sendPreviewToContentFactory}
                    disabled={factoryBusy || busy || !previewCanEdit}
                  >
                    {factoryBusy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Factory size={14} />
                    )}
                    {factoryBusy ? '\u9001\u5165\u4e2d' : '\u9001\u5165\u5185\u5bb9\u5de5\u5382'}
                  </button>
                ) : null}
                {previewItem ? (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={savePromptFromPreview}
                    disabled={
                      promptBusy ||
                      busy ||
                      Boolean(previewItem.promptTemplateId) ||
                      previewItem.status === 'rejected'
                    }
                    title={
                      previewItem.promptTemplateId
                        ? '\u8be5\u63d0\u793a\u8bcd\u5df2\u5728\u84c4\u6c34\u6c60\u4e2d'
                        : '\u5b58\u5165\u63d0\u793a\u8bcd\u84c4\u6c34\u6c60'
                    }
                  >
                    {promptBusy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <BookmarkPlus size={14} />
                    )}
                    {previewItem.promptTemplateId
                      ? '\u5df2\u5165\u63d0\u793a\u8bcd\u6c60'
                      : '\u5b58\u5165\u63d0\u793a\u8bcd\u6c60'}
                  </button>
                ) : null}
                {previewItem ? (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={savePreview}
                    disabled={saveBusy || busy || !previewCanEdit || !previewDirty}
                  >
                    {saveBusy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saveBusy ? '\u4fdd\u5b58\u4e2d' : '\u4fdd\u5b58\u4fee\u6539'}
                  </button>
                ) : null}
                {previewItem?.status === 'draft' ? (
                  <button
                    className="btn btn-brand btn-sm"
                    onClick={approvePreview}
                    disabled={busy || (!previewDirty && previewItem.complianceFlags.length > 0)}
                    title={
                      !previewDirty && previewItem.complianceFlags.length > 0
                        ? '\u5408\u89c4\u8bcd\u547d\u4e2d\uff0c\u4fee\u6539\u4fdd\u5b58\u540e\u624d\u80fd\u6838\u51c6'
                        : undefined
                    }
                  >
                    <CheckCircle2 size={14} />
                    {'\u4fdd\u5b58\u5e76\u5ba1\u6838\u901a\u8fc7'}
                  </button>
                ) : null}
                {previewItem ? (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={openWechatSubmit}
                    disabled={busy || wechatBusy || !previewCanEdit}
                  >
                    <Send size={14} />
                    {'\u63d0\u4ea4\u516c\u4f17\u53f7\u5ba1\u6838'}
                  </button>
                ) : null}
                {previewItem?.status === 'draft' ? (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => reject(previewItem.id).then(closeCopyWorkbench)}
                    disabled={busy}
                  >
                    <XCircle size={14} />
                    {'\u62d2\u7edd'}
                  </button>
                ) : null}
                {previewItem?.status === 'rejected' ? (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => removeRejected(previewItem.id).then(closeCopyWorkbench)}
                    disabled={busy}
                  >
                    <Trash2 size={14} />
                    {'\u5220\u9664'}
                  </button>
                ) : null}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={closeCopyWorkbench}
                  disabled={generateBusy}
                >
                  {'\u5173\u95ed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
