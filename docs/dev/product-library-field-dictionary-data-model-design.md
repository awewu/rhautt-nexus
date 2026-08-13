# 产品库字段字典与数据模型设计

## 0. 文档状态

- 状态：`revised-draft-for-review`
- 日期：2026-08-10
- 适用阶段：恒热产品数据库完善阶段
- 目标：定义公共产品基座字段、数据模型、导入规则和核验边界
- 关联 PRD：`docs/dev/product-library-single-source-multichannel-publishing-prd.md`

## 1. 总体设计原则

产品库采用公共产品基座模型：

```text
公共产品事实 Product
├─ SKU / 物料 / 配置 ProductSku
├─ 品牌绑定 ProductBrandBinding
├─ 内容与素材 ProductContent / AssetRef
├─ 分类、系列、参数、合规、资料
└─ 站点/渠道投影 SiteProjection / WebsitePricing
```

核心原则：

1. `products` 是公共产品事实主表。
2. `products.brand_code` 只作为兼容字段或主品牌提示，不作为正式产品归属源。
3. 正式品牌关系进入 `product_brand_bindings`。
4. 多品牌产品只创建一条产品主记录。
5. 同一产品下可以有多个 SKU。
6. `tenant_id` 是公共产品库实例门牌，不是设备品牌分区。
7. `brandCode` 是品牌绑定和筛选维度，不是 tenant。
8. 官网价格、官网文案、排序、推荐和上下架属于投影层，不属于产品事实。
9. 导入不得静默覆盖人工维护或已核验字段。
10. 本期不得改变任何官网或经销商可见数据。

## 2. 字段分层

| 分层      | 保存内容                                       | 不保存内容                   |
| --------- | ---------------------------------------------- | ---------------------------- |
| 产品核心  | 型号、名称、类型、生命周期、公共分类、事实状态 | 官网排序、实时库存、经销商价 |
| SKU       | 物料编码、销售单位、配置差异、包装             | 产品公共营销文案             |
| 品牌绑定  | 品牌编码、品牌型号、品牌展示名、绑定状态       | 产品完整事实副本             |
| 内容层    | 正式文案、详情、SEO/GEO 输入                   | 官网货架状态                 |
| 参数层    | 技术参数、单位、来源、核验状态                 | 自由 HTML 参数表             |
| 素材/资料 | 图片、说明书、证书、BIM 等引用                 | 二进制文件本体               |
| 合规层    | 认证、标准、证据、有效期                       | 无来源的口头说明             |
| 导入治理  | 批次、源行、冲突、缺失项、决议                 | 线下不可追溯清单             |
| 站点投影  | 官网售价、展示开关、排序、推荐、slug           | 产品事实主来源               |

## 3. 关键状态

### 3.1 产品数据就绪状态

| 状态               | 含义                             |
| ------------------ | -------------------------------- |
| `imported_draft`   | 已导入或录入，尚未完成完整性检查 |
| `needs_completion` | 已检查但存在缺失、冲突或阻断问题 |
| `fact_verified`    | 指定事实版本已核验               |

`fact_verified` 只代表产品事实已核验，不代表官网可见、经销商可见、已发布或可售。

### 3.2 记录状态

| 状态        | 含义                        |
| ----------- | --------------------------- |
| `active`    | 有效                        |
| `withdrawn` | 停售/退出市场，但历史可追溯 |
| `archived`  | 归档，不再作为有效候选      |

## 4. `products` 公共产品主表

定位：保存公共产品事实主记录。

| 字段                               | 类型        | 必填  | 说明                                                           |
| ---------------------------------- | ----------- | ----- | -------------------------------------------------------------- |
| `id`                               | uuid        | 是    | 产品主键                                                       |
| `tenant_id`                        | text/uuid   | 是    | 公共产品库实例门牌；生产应为固定 UUID                          |
| `sku`                              | text        | 是    | 兼容字段，默认第一 SKU 或历史 SKU                              |
| `name`                             | text        | 是    | 工作名称或默认中文名                                           |
| `brand`                            | text        | 否    | 兼容字段，主品牌提示                                           |
| `brand_code`                       | text        | 否    | 兼容字段，主品牌提示；正式关系看绑定表                         |
| `model`                            | text        | 是    | 产品型号                                                       |
| `normalized_model`                 | text        | 是    | 规范化型号，用于匹配                                           |
| `working_name`                     | text        | 否    | 内部识别名称                                                   |
| `category`                         | text        | 否    | 兼容分类编码                                                   |
| `spec`                             | jsonb       | 是    | 兼容规格对象；结构化参数应进入参数层                           |
| `positioning`                      | jsonb       | 是    | 产品定位                                                       |
| `asset_refs`                       | jsonb       | 是    | 素材引用                                                       |
| `product_key`                      | text        | 否    | 公共产品稳定键，建议 `common:{normalizedModel}` 或后续 MDM key |
| `list_price`                       | numeric     | 否    | 产品库基础价/参考价，不等于官网售价                            |
| `cost_price`                       | numeric     | 否    | 内部成本价，不得公开                                           |
| `currency`                         | text        | 是    | 默认 `CNY`                                                     |
| `status`                           | text        | 是    | UI 状态                                                        |
| `record_status`                    | text        | 是    | 记录状态                                                       |
| `data_readiness_status`            | text        | 是    | 数据就绪状态                                                   |
| `source_system`                    | text        | 否    | 来源系统                                                       |
| `source_record_key`                | text        | 否    | 来源记录键                                                     |
| `lifecycle_stage`                  | text        | 是    | 生命周期阶段                                                   |
| `published`                        | boolean     | 是    | 历史兼容字段；本期不得用它驱动官网                             |
| `meta`                             | jsonb       | 是    | 兼容扩展；不得成为事实唯一来源                                 |
| `created_at/updated_at/deleted_at` | timestamptz | 是/否 | 审计字段                                                       |

约束：

- `tenant_id + normalized_model` 可作为公共产品候选去重辅助，但不能替代品牌绑定唯一性。
- 不允许因为多品牌选择而复制多条 `products`。
- `cost_price` 不得进入官网、经销商或公开 API。

## 5. `product_skus` SKU 表

定位：保存同一产品下的物料、销售配置或 SKU。

| 字段                               | 类型        | 必填  | 说明               |
| ---------------------------------- | ----------- | ----- | ------------------ |
| `id`                               | uuid        | 是    | SKU 主键           |
| `tenant_id`                        | text/uuid   | 是    | 公共产品库实例门牌 |
| `product_id`                       | uuid        | 是    | 关联产品           |
| `sku_code`                         | text        | 是    | SKU 编码           |
| `normalized_sku_code`              | text        | 是    | 规范化 SKU 编码    |
| `material_code`                    | text        | 否    | ERP 物料编码       |
| `gtin`                             | text        | 否    | 全球贸易项目代码   |
| `mpn`                              | text        | 否    | 制造商零件号       |
| `record_status`                    | text        | 是    | `active/archived`  |
| `source_system`                    | text        | 否    | 来源系统           |
| `source_record_key`                | text        | 否    | 来源记录键         |
| `created_by/updated_by`            | text        | 否    | 操作者             |
| `created_at/updated_at/deleted_at` | timestamptz | 是/否 | 审计字段           |

约束：

- `tenant_id + normalized_sku_code` 在未删除记录中唯一。
- SKU 已绑定到其他产品时，新增/导入必须阻断。
- 已发布或被引用过的 SKU 不物理删除，只能归档。

## 6. `product_brand_bindings` 品牌绑定表

定位：保存公共产品与设备品牌的关系。

| 字段                               | 类型        | 必填  | 说明                                       |
| ---------------------------------- | ----------- | ----- | ------------------------------------------ |
| `id`                               | uuid        | 是    | 绑定主键                                   |
| `tenant_id`                        | text/uuid   | 是    | 公共产品库实例门牌                         |
| `product_id`                       | uuid        | 是    | 关联公共产品                               |
| `brand_code`                       | text        | 是    | 设备品牌，如 `everhot/rheem/ruud/lithnova` |
| `brand_model`                      | text        | 是    | 品牌口径型号                               |
| `normalized_model`                 | text        | 是    | 品牌口径规范型号                           |
| `brand_display_name`               | text        | 否    | 品牌展示名                                 |
| `status`                           | text        | 是    | `active/archived`                          |
| `created_by/updated_by`            | text        | 否    | 操作者                                     |
| `created_at/updated_at/deleted_at` | timestamptz | 是/否 | 审计字段                                   |

唯一键：

```text
tenant_id + brand_code + normalized_model
```

规则：

- 该表是品牌关系的事实源。
- 一个 `product_id` 可以有多个品牌绑定。
- 一个品牌下同一规范型号只能绑定到一个有效产品。
- 绑定冲突时不能自动覆盖或自动合并。

## 7. `product_website_pricing` 官网价格投影

定位：保存官网/站点价格展示，不是产品事实价格。

| 字段                               | 类型        | 必填  | 说明               |
| ---------------------------------- | ----------- | ----- | ------------------ |
| `id`                               | uuid        | 是    | 主键               |
| `tenant_id`                        | text/uuid   | 是    | 公共产品库实例门牌 |
| `product_id`                       | uuid        | 是    | 产品               |
| `brand_code`                       | text        | 是    | 品牌维度           |
| `site_code`                        | text        | 是    | 站点，如 `everhot` |
| `locale`                           | text        | 是    | 默认 `zh-CN`       |
| `price_display_mode`               | text        | 是    | 展示方式           |
| `website_price`                    | numeric     | 否    | 官网单价           |
| `website_price_min`                | numeric     | 否    | 区间最低价         |
| `website_price_max`                | numeric     | 否    | 区间最高价         |
| `promo_price`                      | numeric     | 否    | 促销价             |
| `currency`                         | text        | 是    | 默认 `CNY`         |
| `price_unit`                       | text        | 否    | 单位，如 台/套     |
| `price_label`                      | text        | 否    | 价格标签           |
| `price_note`                       | text        | 否    | 价格说明           |
| `tax_included`                     | boolean     | 是    | 是否含税           |
| `valid_from/valid_to`              | timestamptz | 否    | 生效时间           |
| `status`                           | text        | 是    | `active/archived`  |
| `created_by/updated_by`            | text        | 否    | 操作者             |
| `created_at/updated_at/deleted_at` | timestamptz | 是/否 | 审计字段           |

唯一键：

```text
tenant_id + product_id + brand_code + site_code + locale
```

展示方式：

- `show_price`
- `price_range`
- `inquiry`
- `contact_dealer`
- `not_shown`

规则：

- 官网售价可以与产品库基础价不同。
- 同一公共产品在不同品牌站可有不同价格展示。
- 本期允许入库，但不得驱动官网展示。

## 8. `product_content` 内容表

定位：保存产品内容、官网详情、SEO/GEO 输入。

关键字段：

| 字段                        | 说明                               |
| --------------------------- | ---------------------------------- |
| `tenant_id`                 | 公共产品库实例门牌                 |
| `product_id`                | 产品                               |
| `locale`                    | 语言                               |
| `name`                      | 正式名称                           |
| `seo`                       | SEO/GEO 输入                       |
| `marketing`                 | 营销文案结构                       |
| `official_detail_html`      | 官网详情 HTML，需安全净化          |
| `status`                    | `draft/review/scheduled/published` |
| `published_at/scheduled_at` | 发布时间                           |

规则：

- 官网详情可以默认使用产品库文案。
- 如未来需要站点差异化文案，应进入站点投影或内容覆盖层。
- 不允许官网手写产品参数作为事实来源。

## 9. 分类模型

产品库应使用公共品类树，不把品牌、系列、产品或 SKU 当作分类节点。

建议表：

- `product_categories`：公共品类。
- `brand_category_availability`：品牌可经营哪些公共品类。
- `brand_category_presentations`：品牌口径分类展示名称、说明、封面等。
- `product_category_bindings`：产品与公共品类关系。

规则：

- 产品必须有一个主品类。
- 产品可以有多个辅助品类。
- 品牌不是分类节点。
- 官网分类展示属于站点/品牌投影，不应复制产品事实。
- 本期分类字段先服务产品数据库完整度，不驱动官网展示。

## 10. 参数模型

参数应结构化保存，不依赖自由文本。

建议表：

- `product_attribute_definitions`
- `product_attribute_units`
- `product_attribute_values`
- `category_attribute_rules`

关键要求：

- 参数定义归属公共品类。
- 参数值绑定产品修订或 SKU。
- 保存原始值、原始单位、归一化值、归一化单位。
- 无法可靠转换时创建数据问题，不猜测。
- 参数需要记录来源和核验状态。

## 11. 素材与资料

素材和资料只保存引用，不在产品表内保存二进制文件。

建议字段：

- `artifact_id`
- `artifact_type`
- `usage`
- `locale`
- `market_code`
- `sort_order`
- `source_ref`
- `valid_from/valid_to`

常见类型：

- 主图
- 详情图
- 参数表图片
- 说明书 PDF
- 安装手册
- 认证文件
- BIM/图纸

资料文件可设置有效期；到期后提醒替换，不自动删除。

## 12. 合规与证书

证书指产品合规、认证、检测报告、能效等级、安全标准等证据文件，不是 HTTPS 证书。

建议字段：

- `compliance_type`
- `standard_code`
- `standard_name`
- `level`
- `edition`
- `software_check`
- `certificate_number`
- `issuer`
- `market_code`
- `effective_from/effective_to`
- `document_id`
- `verification_status`

规则：

- 证书必须有来源文件或证据。
- 到期证书应提醒替换。
- 缺少强制证据时，不能进入 `fact_verified`。

## 13. 导入治理

### 13.1 `product_import_batches`

保存导入批次：

- `id`
- `tenant_id`
- `template_version`
- `source_file_name`
- `source_file_hash`
- `brand_code`
- `status`
- `precheck_summary`
- `submitted_by/at`

### 13.2 `product_import_rows`

保存导入源行：

- `batch_id`
- `sheet_name`
- `row_number`
- `raw_payload`
- `parsed_payload`
- `detected_action`
- `target_product_id`
- `target_sku_id`
- `status`
- `error_message`

### 13.3 `product_data_issues`

保存缺失项和质量问题：

- `product_id`
- `sku_id`
- `dimension`
- `field_code`
- `severity`
- `message`
- `source_ref`
- `owner`
- `status`
- `resolution`

### 13.4 `product_field_conflicts`

保存导入冲突：

- `product_id`
- `field_code`
- `current_value`
- `incoming_value`
- `source_ref`
- `resolution`
- `resolved_by/at`

覆盖规则：

1. 系统生成字段可以重算。
2. ERP 权威字段可按来源规则覆盖。
3. 人工维护字段默认不被导入静默覆盖。
4. 已核验字段发生差异时进入冲突。
5. 清空字段必须显式表达，不能用空白误覆盖。

## 14. 恒热物料字段映射

恒热首批导入以物料表为来源。

核心映射：

| 源字段   | 目标字段                                                | 说明               |
| -------- | ------------------------------------------------------- | ------------------ |
| 物料品牌 | `brandCodes=["everhot"]`                                | 本期只允许恒热导入 |
| 型号     | `products.model` / `product_brand_bindings.brand_model` | 判断产品与品牌绑定 |
| 物料编码 | `product_skus.sku_code/material_code`                   | 判断 SKU           |
| 物料名称 | `products.name` / `working_name`                        | 可作为初始名称     |
| 物料分类 | 主品类候选                                              | 需映射到公共品类   |
| 启用状态 | 记录状态候选                                            | 作废规则优先       |
| 价格字段 | `list_price` 或 `product_website_pricing` 候选          | 需确认字段语义     |

作废规则：

- 带 `-T` 且名称含“作废”的物料进入排除清单。
- 即使 ERP 状态为启用，也不得作为有效 SKU 导入。

## 15. API 契约

新增/编辑产品应支持：

```json
{
  "tenantId": "<PRODUCT_LIBRARY_TENANT_ID>",
  "brandCode": "everhot",
  "brandCodes": ["everhot"],
  "model": "RGS-A",
  "materialCode": "MAT-001",
  "name": "恒热 RGS-A",
  "category": "gas-water-heater",
  "listPrice": 12000,
  "websitePricing": {
    "brandCode": "everhot",
    "siteCode": "everhot",
    "locale": "zh-CN",
    "priceDisplayMode": "show_price",
    "websitePrice": 11800,
    "currency": "CNY",
    "priceUnit": "台"
  }
}
```

重复产品返回：

```json
{
  "code": "PRODUCT_MODEL_EXISTS",
  "message": "产品型号已存在，请确认是否更新该公共产品并追加/更新 SKU。",
  "data": {
    "resolution": {
      "confirmField": "confirmExistingProduct",
      "confirmValue": true
    }
  }
}
```

SKU 冲突返回：

```json
{
  "code": "SKU_ALREADY_BOUND_TO_ANOTHER_PRODUCT"
}
```

## 16. 统一读取契约

后续统一产品事实接口建议：

```text
/api/v2/product-facts
```

列表支持：

- `brandCode`
- `siteCode`
- `categoryCode`
- `marketCode`
- `updatedAfter`
- `cursor`

返回应包含：

- `schemaVersion`
- `productId`
- `productKey`
- `brandBindings`
- `model`
- `skus`
- `category`
- `attributes`
- `content`
- `assets`
- `compliance`
- `readinessStatus`

消费者只能读取统一契约，不得直接依赖内部表结构。

## 17. RLS 与权限

要求：

- 新表启用 PostgreSQL RLS。
- 应用连接使用非超级用户 `rhautt_app`。
- 公共产品库使用固定实例 `tenant_id`。
- `brandCode` 不能作为 tenant 隔离替代。
- 写操作必须经过产品库权限。
- 官网和经销商端只读。

环境变量建议：

```text
PRODUCT_LIBRARY_TENANT_ID=<Rhautt Comfort 产品库实例 UUID>
RHAUTT_COMFORT_TENANT_ID=<Rhautt Comfort 实例 UUID>
```

## 18. 本期验收标准

### 18.1 模型验收

- [ ] `products` 与 `product_skus` 分离。
- [ ] `product_brand_bindings` 成为品牌关系事实源。
- [ ] `product_website_pricing` 支持 `brand_code + site_code`。
- [ ] 多品牌产品只创建一条产品主记录。
- [ ] `brandCode + normalizedModel` 唯一性落在绑定层。
- [ ] `skuCode/materialCode` 唯一规则明确。

### 18.2 导入验收

- [ ] 恒热导入模板字段映射明确。
- [ ] 预检不写产品事实。
- [ ] 提交按产品原子写入。
- [ ] 重复导入不重复建档。
- [ ] 作废物料被排除。
- [ ] 冲突和缺失项可追溯。

### 18.3 官网不变验收

- [ ] 本期不修改 `published`。
- [ ] 本期不修改 `currentReleaseId`。
- [ ] 本期不修改 `site_product_assignments`。
- [ ] 本期不改变恒热官网展示。
- [ ] 本期不改变其他品牌官网展示。

## 19. 后续待决问题

后续进入官网/渠道接入阶段前，需要单独确认：

1. 官网是否继续浏览器运行时 API 渲染，还是引入 SSR/静态化。
2. `/api/v2/sites/:siteCode/products` 的正式返回结构。
3. 官网 URL、重定向、slug 和历史页面兼容方案。
4. 官网文案覆盖字段的边界。
5. 经销商 API 对产品事实、价格和授权的读取范围。
6. GEO 抓取验收标准。

## 20. 最终口径

产品库是 Rhautt Comfort 的公共产品事实基座。恒热只是第一批导入和验收品牌，不代表要建设恒热独立字段体系，也不代表未来为每个品牌复制一份产品库。

本期完成后，应能够支撑：

- 产品一次录入。
- SKU 正确归并。
- 品牌正确绑定。
- 字段来源可追溯。
- 缺失项可修复。
- 产品事实可核验。
- 官网和经销商后续可从统一基座读取。

但本期不自动发布官网，不改变任何现有官网展示。
