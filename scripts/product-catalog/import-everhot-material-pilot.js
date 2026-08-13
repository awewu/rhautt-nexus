#!/usr/bin/env node
const path = require('node:path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const xlsx = require('xlsx');

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_PATH = path.join(
  ROOT,
  'docs',
  'dev',
  'everhot-product-library-field-extraction-0725.xlsx'
);
const SOURCE_SHEET = '恒热候选数据';
const API_BASE = process.env.EVERHOT_PILOT_API_BASE || 'http://localhost:5500/api/v2';
const TENANT_ID = 'e5e40000-0000-4000-8000-000000000001';
const ACTOR_ID = '00000000-0000-4000-8000-000000000001';
const BATCH_CODE = 'everhot-material-0725-pilot-20260810';
const SOURCE_ROWS = Object.freeze([3, 45, 59, 101, 51, 214, 52, 130, 260, 262]);
const APPLY = process.argv.includes('--apply');

const CATEGORY_BY_NAME = Object.freeze({
  储水式电热水器: { code: 'electric-water-heater', nameEn: 'Storage Electric Water Heater' },
  热泵热水器: { code: 'air-source-water-heater', nameEn: 'Heat Pump Water Heater' },
  燃气容积式热水器: { code: 'storage-gas-water-heater', nameEn: 'Storage Gas Water Heater' },
  壁挂炉: { code: 'wall-hung-boiler', nameEn: 'Wall-hung Boiler' },
});

const TECHNICAL_FIELDS = Object.freeze([
  '毛重',
  '毛重单位',
  '长',
  '宽',
  '高',
  '净重',
  '电击防护类型',
  '防水等级',
  '额定功率',
  '额定电压/频率',
  '加热管输入功率',
  '燃气类别',
  '低压侧/高压侧最大允许压力',
  '吸气侧允许工作压力',
  '水箱工作允许过压',
  '最高出水温度',
  '制冷剂/充注量',
  '工作条件',
  '执行标准',
]);

dotenv.config({ path: path.join(ROOT, '.env.nestjs'), quiet: true });
dotenv.config({ path: path.join(ROOT, '.env'), override: false, quiet: true });

function clean(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function normalizeModel(value) {
  return clean(value)
    .toUpperCase()
    .replace(/[\s_-]+/g, '');
}

function readPilotRows(sourcePath = SOURCE_PATH) {
  const workbook = xlsx.readFile(sourcePath);
  const sheet = workbook.Sheets[SOURCE_SHEET];
  if (!sheet) throw new Error(`缺少工作表：${SOURCE_SHEET}`);
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  const bySourceRow = new Map(rows.map((row) => [Number(row['源Excel行']), row]));
  return SOURCE_ROWS.map((sourceRow) => {
    const row = bySourceRow.get(sourceRow);
    if (!row) throw new Error(`找不到源 Excel 第 ${sourceRow} 行`);
    if (clean(row['导入候选']) !== '是') throw new Error(`源 Excel 第 ${sourceRow} 行不是导入候选`);
    if (clean(row.brandCode).toLowerCase() !== 'everhot')
      throw new Error(`源 Excel 第 ${sourceRow} 行不是恒热产品`);
    return row;
  });
}

function readinessFor(row) {
  const hasIdentity = Boolean(clean(row.brandCode) && clean(row.model));
  const hasTaxonomy = Boolean(CATEGORY_BY_NAME[clean(row['主分类候选'])]);
  const hasSku = Boolean(clean(row.skuCode) && clean(row['来源物料编码']));
  const hasTechnical = TECHNICAL_FIELDS.some((field) => clean(row[field]));
  const isExportPending = clean(row['人工复核项']).includes('出口产品');
  const result = {
    identity: { status: hasIdentity ? 'ready' : 'incomplete' },
    taxonomy: { status: hasTaxonomy ? 'ready' : 'incomplete' },
    sku: { status: hasSku ? 'ready' : 'incomplete' },
    technical: {
      status: hasTechnical && clean(row['执行标准']) ? 'ready' : 'incomplete',
      note: hasTechnical ? '已有部分参数，仍缺执行标准或品类必填参数核验' : '缺少技术参数',
    },
    compliance: { status: clean(row['执行标准']) ? 'ready' : 'incomplete' },
    content: { status: 'incomplete', note: '缺少完整卖点、详情、FAQ 与 SEO/GEO 输入' },
    assets: { status: 'incomplete', note: '缺少主图、图库和说明书等素材' },
    market: {
      status: isExportPending ? 'incomplete' : 'ready',
      note: isExportPending ? '出口产品是否纳入 CN 市场待确认' : undefined,
    },
  };
  return Object.fromEntries(
    Object.entries(result).map(([key, value]) => [
      key,
      Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)),
    ])
  );
}

function technicalSpec(row) {
  const spec = {
    officialModel: clean(row.model),
    model: clean(row.model),
    materialCode: clean(row.skuCode),
    materialCategory: clean(row['主分类候选']),
    productLine: clean(row['产品线参考']),
    salesUnit: clean(row['销售单位']),
    grossWeight: clean(row['毛重']),
    grossWeightUnit: clean(row['毛重单位']),
    length: clean(row['长']),
    width: clean(row['宽']),
    height: clean(row['高']),
    netWeight: clean(row['净重']),
    electricShockProtectionClass: clean(row['电击防护类型']),
    ingressProtectionRating: clean(row['防水等级']),
    ratedPower: clean(row['额定功率']),
    ratedVoltageFrequency: clean(row['额定电压/频率']),
    heatingElementInputPower: clean(row['加热管输入功率']),
    gasCategory: clean(row['燃气类别']),
    maxAllowablePressure: clean(row['低压侧/高压侧最大允许压力']),
    suctionWorkingPressure: clean(row['吸气侧允许工作压力']),
    tankAllowableOverpressure: clean(row['水箱工作允许过压']),
    maxOutletWaterTemperature: clean(row['最高出水温度']),
    refrigerantCharge: clean(row['制冷剂/充注量']),
    workingConditions: clean(row['工作条件']),
    executionStandard: clean(row['执行标准']),
  };
  return Object.fromEntries(Object.entries(spec).filter(([, value]) => value !== ''));
}

function buildDto(row, category) {
  const model = clean(row.model);
  const sku = clean(row.skuCode);
  const sourceCategory = clean(row['主分类候选']);
  const productLine = clean(row['产品线参考']);
  const marketScope = clean(row['人工复核项']).includes('出口产品') ? 'pending_review' : 'CN';
  return {
    tenantId: TENANT_ID,
    sku,
    name: clean(row['产品名称候选']) || clean(row['物料简称']) || clean(row['物料原名称']) || model,
    brand: 'everhot',
    category: CATEGORY_BY_NAME[sourceCategory].code,
    categoryId: category.id,
    listPrice: 0,
    currency: 'CNY',
    status: 'inactive',
    published: false,
    spec: technicalSpec(row),
    meta: {
      everhot: {
        model,
        series: clean(row['系列候选']),
        en: clean(row['英文名称']),
        websiteCategory: sourceCategory,
        websiteMenuCategory: productLine.startsWith('家用') ? '家用' : '商用',
      },
      productLibrary: {
        pilot: true,
        batchCode: BATCH_CODE,
        sourceWorkbook: path.basename(SOURCE_PATH),
        sourceSheet: SOURCE_SHEET,
        sourceRow: Number(row['源Excel行']),
        sourceSystem: 'material-master-0725',
        brandCode: 'everhot',
        model,
        normalizedModel: normalizeModel(model),
        skuCode: sku,
        series: clean(row['系列候选']),
        sourceCategory,
        productLine,
        sourceEnabledStatus: clean(row['源启用状态']),
        salesChannels: clean(row['销售渠道']).split(',').map(clean).filter(Boolean),
        b2bSellable: clean(row['B2B可售']) === '是',
        marketScope,
        dataReadinessStatus: 'needs_completion',
        readinessDimensions: readinessFor(row),
        reviewNotes: clean(row['人工复核项']) ? [clean(row['人工复核项'])] : [],
        autoPublish: false,
        importedAt: new Date().toISOString(),
      },
    },
  };
}

function assertSafeExisting(existing, sku) {
  if (!existing) return;
  const batch = existing?.meta?.productLibrary?.batchCode;
  if (batch !== BATCH_CODE) {
    throw new Error(`SKU ${sku} 已存在且不属于本试导入批次，禁止覆盖`);
  }
}

function makeToken() {
  if (!process.env.JWT_SECRET) throw new Error('缺少 JWT_SECRET，无法调用受保护 API');
  return jwt.sign(
    { userId: ACTOR_ID, tenantId: TENANT_ID, role: 'platform_admin' },
    process.env.JWT_SECRET,
    { expiresIn: '20m' }
  );
}

async function apiRequest(pathname, token, options = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.text();
  let payload;
  try {
    payload = body ? JSON.parse(body) : null;
  } catch {
    payload = { raw: body.slice(0, 500) };
  }
  if (!response.ok)
    throw new Error(
      `${options.method || 'GET'} ${pathname} -> ${response.status}: ${JSON.stringify(payload)}`
    );
  return payload;
}

function responseItems(payload) {
  return payload?.data?.items || payload?.data || payload?.items || [];
}

async function ensureCategories(token, rows, apply) {
  const payload = await apiRequest(
    '/brand-product-categories?brandCode=everhot&metrics=false',
    token
  );
  const existing = responseItems(payload);
  const roots = new Map(existing.filter((item) => !item.parentId).map((item) => [item.code, item]));
  const required = new Map();
  for (const row of rows) {
    const rootCode = clean(row['产品线参考']).startsWith('家用') ? 'home' : 'commercial';
    const category = CATEGORY_BY_NAME[clean(row['主分类候选'])];
    if (!category) throw new Error(`未配置分类映射：${clean(row['主分类候选'])}`);
    required.set(`${rootCode}:${category.code}`, {
      rootCode,
      sourceName: clean(row['主分类候选']),
      ...category,
    });
  }

  const resolved = new Map();
  for (const [key, item] of required) {
    const root = roots.get(item.rootCode);
    if (!root) throw new Error(`缺少恒热一级分类：${item.rootCode}`);
    let category = existing.find(
      (candidate) => candidate.parentId === root.id && candidate.code === item.code
    );
    if (!category && !apply) {
      category = {
        id: `dry-run:${key}`,
        parentId: root.id,
        code: item.code,
        nameCn: item.sourceName,
        showOnWebsite: false,
      };
    }
    if (!category && apply) {
      const created = await apiRequest('/brand-product-categories', token, {
        method: 'POST',
        body: JSON.stringify({
          brandCode: 'everhot',
          parentId: root.id,
          code: item.code,
          slug: item.code,
          nameCn: item.sourceName,
          nameEn: item.nameEn,
          sortOrder: 100,
          status: 'active',
          showOnWebsite: false,
          description: '恒热物料试导入所需分类；试验阶段不进入官网公开目录。',
        }),
      });
      category = created.data;
    }
    resolved.set(key, category);
  }
  return resolved;
}

async function main() {
  const rows = readPilotRows();
  const token = makeToken();
  const productsPayload = await apiRequest(
    `/product-catalog/devices?tenantId=${TENANT_ID}&brand=everhot&page=1&pageSize=500`,
    token
  );
  const existingBySku = new Map(responseItems(productsPayload).map((item) => [item.sku, item]));
  rows.forEach((row) =>
    assertSafeExisting(existingBySku.get(clean(row.skuCode)), clean(row.skuCode))
  );
  const categories = await ensureCategories(token, rows, APPLY);
  const plan = rows.map((row) => {
    const rootCode = clean(row['产品线参考']).startsWith('家用') ? 'home' : 'commercial';
    const categoryCode = CATEGORY_BY_NAME[clean(row['主分类候选'])].code;
    return buildDto(row, categories.get(`${rootCode}:${categoryCode}`));
  });

  console.table(
    plan.map((item) => ({
      sku: item.sku,
      model: item.spec.officialModel,
      category: item.category,
      status: item.status,
      published: item.published,
    }))
  );
  if (!APPLY) {
    console.log(
      `Dry-run: ${plan.length} products. Pass --apply to import through the protected NestJS API.`
    );
    return;
  }

  let created = 0;
  let updated = 0;
  for (const dto of plan) {
    const existed = existingBySku.has(dto.sku);
    await apiRequest('/product-catalog/devices', token, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    if (existed) updated += 1;
    else created += 1;
  }

  const verifiedPayload = await apiRequest(
    `/product-catalog/devices?tenantId=${TENANT_ID}&brand=everhot&status=inactive&page=1&pageSize=500`,
    token
  );
  const verified = responseItems(verifiedPayload).filter(
    (item) => item?.meta?.productLibrary?.batchCode === BATCH_CODE
  );
  const unsafe = verified.filter(
    (item) =>
      item.status !== 'inactive' ||
      item.published !== false ||
      item?.meta?.productLibrary?.autoPublish !== false
  );
  if (verified.length !== SOURCE_ROWS.length || unsafe.length) {
    throw new Error(
      `导入后校验失败：找到 ${verified.length}/${SOURCE_ROWS.length} 条，非安全状态 ${unsafe.length} 条`
    );
  }
  console.log(
    JSON.stringify(
      { batchCode: BATCH_CODE, created, updated, verified: verified.length, published: 0 },
      null,
      2
    )
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  BATCH_CODE,
  CATEGORY_BY_NAME,
  SOURCE_ROWS,
  TENANT_ID,
  assertSafeExisting,
  buildDto,
  normalizeModel,
  readPilotRows,
  readinessFor,
  technicalSpec,
};
