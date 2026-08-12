# 产品库多官网展示配置 PRD

## 0. 文档状态

- 状态：`draft-for-review`
- 日期：2026-08-11
- 产品：Rhautt Nexus / 瑞合数智枢纽
- 客户/集团实例：Rhautt Comfort / 瑞合瑞德暖通科技集团
- 主维护入口：`apps/dealer-workbench` 产品库 `/products`
- 关联基础资料入口：`基础资料 / 产品分类 / 官网目录管理`
- 主后端模块：`services/api/src/modules/product-catalog`、`services/api/src/modules/brand-registry`
- 依据文档：`docs/dev/product-library-single-source-multichannel-publishing-prd.md`、`docs/dev/product-library-field-dictionary-data-model-design.md`

## 1. 需求结论

产品库中的一个产品可以发布或挂载到多个官网。每个官网拥有独立的官网展示配置，包括官网目录、官网系列、公开路径、排序、推荐、展示文案、标签、图片等。

官网目录和官网系列必须通过选择获取，不允许运营在产品官网展示区手工输入目录文本。系统应根据产品库分类、产品系列、品牌绑定等信息给出默认映射；即使映射结果与产品库字段一致，也要在界面上明确显示“当前使用产品库默认值”。运营可以针对某个官网单独修改覆盖。

官网目录管理页只维护目录树 CRUD。真正消费官网目录的是产品库中的“官网展示配置”。

## 2. 背景与问题

当前产品编辑中的“官网展示”区域仍偏向单官网手工表单，存在以下问题：

1. 一个产品看起来只能维护一组官网展示信息，无法清晰表达“同一产品挂载多个官网”。
2. 官网目录、系列、公开路径、排序、标签等字段混在一个普通表单里，运营无法判断哪些来自产品库默认，哪些是官网覆盖。
3. 官网目录本应来自基础资料中的官网目录树，当前仍存在手填或弱约束倾向。
4. “是否推荐”“URL slug”“官网文案”等属于产品在某个官网的发布配置，不应该出现在官网目录管理页。
5. 5011 恒热官网后续需要读取产品库发布配置，而不是继续依赖静态或手工散落字段。

## 3. 产品目标

本 PRD 的目标是建立“公共产品基座 + 多官网展示配置”的产品发布模型。

要达到：

- 一个产品只维护一份公共产品事实。
- 一个产品可挂载到多个官网。
- 每个官网有独立展示配置。
- 官网目录、官网系列通过选择器读取基础资料。
- 默认展示值来自产品库，减少重复填写。
- 运营可以看到默认值来源，并可按官网覆盖。
- 官网目录管理页只做目录 CRUD，不做产品绑定。
- 5011 恒热官网后续可消费该配置展示产品。

## 4. 非目标

本阶段不做：

- 不在官网目录管理页绑定产品。
- 不在官网目录管理页维护 URL slug、编码、推荐、官网文案、官网售价、图片。
- 不复制多份产品主数据。
- 不按官网或品牌复制产品库。
- 不让官网前台直接修改产品数据。
- 不立即强制切换所有品牌官网展示；先支持恒热官网配置闭环。
- 不把“已配置官网展示”直接等同于“已发布上线”，仍需发布状态控制。

## 5. 核心概念

### 5.1 公共产品主记录

公共产品主记录保存产品稳定事实，例如：

- 品牌绑定
- 型号
- 产品名称
- 公共产品分类
- SKU / 配置
- 参数
- 卖点
- 应用场景
- 图片 / 素材
- 证书 / 资料
- 价格基础字段

公共产品主记录不直接等同于官网展示。

### 5.2 官网目录

官网目录是某个官网前台产品导航和列表使用的目录树。

来源：

```text
site_product_categories
```

维护入口：

```text
基础资料 / 产品分类 / 官网目录管理
```

职责：

- 目录名称
- 上下级关系
- 排序
- 启用 / 停用
- 是否官网显示
- 运营备注

不负责：

- 产品归属
- 产品推荐
- 产品 URL
- 产品文案
- 产品图片
- 产品价格

### 5.3 官网系列

官网系列是某个官网下用于产品展示、分组或筛选的系列维度。

建议新增站点级系列基础资料：

```text
site_product_series
```

它可以独立于公共产品系列，也可以映射公共产品系列。

### 5.4 官网展示配置

官网展示配置表达：

> 某个产品如何在某个官网上展示。

它是产品与官网之间的发布投影。

建议复用并增强：

```text
site_product_assignments
```

一个产品可以拥有多条官网展示配置。

```text
Product
├─ Everhot 官网展示配置
├─ Rheem 官网展示配置
└─ Ruud 官网展示配置
```

## 6. 数据模型方案

### 6.1 `site_product_assignments` 增强

当前 `site_product_assignments` 可继续作为产品与官网的挂载关系表，但需要从“文本分类”升级为“选择目录 + 快照”。

建议字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 官网展示配置 ID |
| `tenant_id` | uuid | RLS 租户 |
| `site_id` | uuid | 官网 ID |
| `product_tenant_id` | uuid/string | 产品所属数据平面 |
| `product_id` | uuid/string | 产品 ID |
| `website_category_id` | uuid | 官网目录 ID |
| `website_category_path` | text | 官网目录路径快照，如 `家用 / 采暖系统 / 壁挂炉` |
| `website_series_id` | uuid | 官网系列 ID |
| `website_series_name` | text | 官网系列名称快照 |
| `public_slug` | text | 产品在该官网的公开路径 |
| `display_order` | integer | 产品在该官网的排序 |
| `is_featured` | boolean | 是否在该官网推荐 |
| `status` | draft/published/hidden | 官网发布状态 |
| `site_title` | text | 官网展示名称覆盖值 |
| `site_summary` | text | 官网摘要/标语覆盖值 |
| `site_tags` | jsonb | 官网标签覆盖值 |
| `site_images` | jsonb | 官网图片覆盖值 |
| `site_meta` | jsonb | 官网扩展展示配置 |

兼容字段：

- `website_category` 可暂时保留为目录路径文本快照。
- `menu_group` 可逐步废弃，不在新前端中暴露。

### 6.2 `site_product_series` 新增

建议新增：

```text
site_product_series
```

字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 系列 ID |
| `tenant_id` | uuid | RLS 租户 |
| `site_id` | uuid | 官网 ID |
| `category_id` | uuid nullable | 可选，归属某个官网目录 |
| `name` | text | 系列名称 |
| `code` | text | 系列编码，系统生成或后台维护 |
| `sort_order` | integer | 排序 |
| `status` | active/inactive | 启用状态 |
| `description` | text | 运营备注 |

### 6.3 默认值与覆盖值

前端不应只显示最终值，而应显示：

- 默认值
- 当前使用值
- 来源：产品库默认 / 官网覆盖
- 恢复默认操作

示例：

```json
{
  "field": "siteTitle",
  "defaultValue": "壁挂炉",
  "value": "恒热高效壁挂炉",
  "source": "site_override"
}
```

## 7. 映射规则

系统需要根据产品库资料给出官网展示建议。

### 7.1 官网目录映射

建议优先级：

1. 产品已有该官网的 `website_category_id`。
2. 产品公共分类与官网目录存在映射关系。
3. 产品品牌、系统、品类关键词匹配官网目录。
4. 无匹配时显示“未匹配，需要选择”。

即使系统自动匹配成功，也要显示：

```text
官网目录：家用 / 采暖系统 / 壁挂炉
来源：根据产品分类自动匹配，可修改
```

### 7.2 官网系列映射

建议优先级：

1. 产品已有该官网 `website_series_id`。
2. 产品公共系列名称与官网系列名称一致。
3. 产品型号、产品类型、系统字段匹配官网系列。
4. 无匹配时显示“未匹配，需要选择”。

### 7.3 展示字段默认值

| 官网展示字段 | 默认来源 |
|---|---|
| 展示名称 | 产品名称 |
| 英文名 | 产品英文名 / 品牌英文 |
| 标语 | 产品卖点 / tagline |
| 摘要 | 产品简介 / 产品卖点 |
| 标签 | 产品标签 / 卖点关键词 |
| 图片 | 产品主图 |
| slug | 型号 / SKU 自动生成 |
| 排序 | 默认 0 |
| 是否推荐 | 默认否 |

## 8. 前端方案

### 8.1 产品编辑页“官网展示”区域

当前单一表单改成“多官网展示配置卡片”。

结构：

```text
官网展示

[+ 添加官网展示]

已配置官网
------------------------------------------------
恒热官网 Everhot                         草稿
目录：家用 / 采暖系统 / 壁挂炉
系列：壁挂炉系列
映射：根据产品库分类自动匹配，可修改

公开路径：bg-a
排序：0
推荐：否

展示名称：壁挂炉              来源：产品库默认
标语：未填写                  来源：产品库默认
标签：新品、高端              来源：官网覆盖

[编辑] [移除该官网]
------------------------------------------------
```

### 8.2 添加官网展示流程

点击“添加官网展示”：

```text
1. 选择官网
2. 系统加载该官网目录树和系列
3. 系统给出默认映射
4. 运营确认或修改目录/系列
5. 运营确认 slug、排序、推荐、展示字段
6. 保存为该官网的展示配置
```

官网选择要求：

- 已配置过的官网仍可显示，但不应重复创建同一个官网配置。
- 如果业务允许一个产品在同一官网多个目录出现，需要明确做成“一个官网配置多目录”，不建议创建多条重复官网配置。

### 8.3 官网目录选择器

目录选择器读取：

```text
GET /api/v2/brand-sites/:siteCode/product-categories
```

交互：

- 树形展示。
- 支持展开/收起。
- 只显示启用目录。
- 已停用目录如果历史已绑定，需要可回显但提示“已停用”。

### 8.4 官网系列选择器

系列选择器读取：

```text
GET /api/v2/brand-sites/:siteCode/product-series
```

交互：

- 可按官网目录过滤。
- 可显示“推荐匹配”。
- 已停用系列历史绑定可回显但不可新选。

### 8.5 默认/覆盖字段组件

建议抽象组件：

```text
DefaultOverrideField
```

展示：

- 字段名
- 当前值
- 默认值来源
- 是否覆盖
- 恢复默认

示例：

```text
展示名称
[壁挂炉]
来源：产品库默认

展示名称
[恒热高效壁挂炉]
来源：官网覆盖
[恢复产品库默认]
```

## 9. 后端 API 方案

### 9.1 获取产品多官网展示配置

```http
GET /api/v2/product-catalog/devices/:productId/site-publishing
```

返回：

```json
{
  "items": [
    {
      "id": "assignment-id",
      "siteCode": "everhot",
      "siteName": "恒热 Everhot",
      "categoryId": "category-id",
      "categoryPath": "家用 / 采暖系统 / 壁挂炉",
      "seriesId": "series-id",
      "seriesName": "壁挂炉系列",
      "publicSlug": "bg-a",
      "displayOrder": 0,
      "isFeatured": false,
      "status": "draft",
      "resolvedTitle": "壁挂炉",
      "resolvedTitleSource": "product_default",
      "siteTitle": null,
      "siteSummary": null,
      "siteTags": [],
      "siteImages": []
    }
  ]
}
```

### 9.2 获取某官网映射建议

```http
GET /api/v2/product-catalog/devices/:productId/site-publishing/suggestions?siteCode=everhot
```

返回：

```json
{
  "siteCode": "everhot",
  "suggestedCategory": {
    "id": "category-id",
    "path": "家用 / 采暖系统 / 壁挂炉",
    "source": "product_category_mapping",
    "confidence": 0.9
  },
  "suggestedSeries": {
    "id": "series-id",
    "name": "壁挂炉系列",
    "source": "series_name_match",
    "confidence": 0.8
  },
  "defaults": {
    "siteTitle": {
      "value": "壁挂炉",
      "source": "product.name"
    },
    "publicSlug": {
      "value": "bg-a-001",
      "source": "product.model"
    }
  }
}
```

### 9.3 新增官网展示配置

```http
POST /api/v2/product-catalog/devices/:productId/site-publishing
```

请求：

```json
{
  "siteCode": "everhot",
  "categoryId": "category-id",
  "seriesId": "series-id",
  "publicSlug": "bg-a",
  "displayOrder": 0,
  "isFeatured": false,
  "status": "draft",
  "siteTitle": null,
  "siteSummary": null,
  "siteTags": [],
  "siteImages": []
}
```

### 9.4 修改官网展示配置

```http
PATCH /api/v2/product-catalog/devices/:productId/site-publishing/:assignmentId
```

### 9.5 移除官网展示配置

```http
DELETE /api/v2/product-catalog/devices/:productId/site-publishing/:assignmentId
```

约束：

- 已发布状态删除需二次确认。
- 删除只移除该产品在该官网的展示配置，不删除产品主记录。

### 9.6 官网系列 API

```http
GET /api/v2/brand-sites/:siteCode/product-series
POST /api/v2/brand-sites/:siteCode/product-series
PATCH /api/v2/brand-sites/:siteCode/product-series/:id
DELETE /api/v2/brand-sites/:siteCode/product-series/:id
```

## 10. 5011 恒热官网消费方案

5011 恒热官网不直接消费产品编辑表单字段，而是消费站点发布投影。

建议接口：

```http
GET /api/v2/sites/everhot/products
GET /api/v2/sites/everhot/products/:publicSlug
GET /api/v2/sites/everhot/product-categories
```

其中：

- 产品列表只返回 `status = published` 的产品。
- 产品目录来自 `site_product_categories`。
- 产品归属来自 `site_product_assignments.website_category_id`。
- 展示字段按“官网覆盖优先，产品库默认兜底”解析。

解析优先级：

```text
官网覆盖值 > 产品库默认值 > 空状态占位
```

## 11. 权限与校验

### 11.1 权限

- 查看官网展示配置：`brand.library.read`
- 新增官网展示配置：`brand.library.create`
- 修改官网展示配置：`brand.library.update`
- 发布/下架：`brand.library.publish`
- 删除官网展示配置：`brand.library.delete`

### 11.2 校验

必须校验：

- 同一产品同一官网默认只能有一条展示配置。
- `siteCode` 必须存在且启用。
- `categoryId` 必须属于当前 `siteCode`。
- `seriesId` 必须属于当前 `siteCode`。
- `publicSlug` 在同一官网下唯一。
- 已停用目录不可新选，但历史绑定可回显。
- 已停用系列不可新选，但历史绑定可回显。

## 12. 前后端职责边界

| 模块 | 职责 |
|---|---|
| 官网目录管理页 | 只维护官网目录树 CRUD |
| 官网系列管理 | 维护官网系列基础资料 |
| 产品库编辑页 | 维护产品挂载到哪些官网及各官网展示配置 |
| 5011 官网 | 读取已发布投影展示，不反写产品库 |
| 后端 API | 负责映射建议、字段解析、权限、唯一性校验 |

## 13. 实施阶段

### Phase 1：产品编辑页多官网配置 UI

- 将单一“官网展示”表单改为多官网配置卡片。
- 支持添加、编辑、移除某个官网配置。
- 先复用现有 `site_product_assignments`。
- 前端显示默认值与覆盖值来源。

### Phase 2：官网目录选择接入

- 产品编辑页选择官网后加载官网目录树。
- 不再手填官网目录。
- 支持目录自动映射建议。
- 官网目录管理页保持只做目录 CRUD。

### Phase 3：官网系列基础资料

- 新增 `site_product_series`。
- 产品编辑页选择官网系列。
- 支持系列自动映射建议。

### Phase 4：5011 官网消费

- 恒热官网产品列表和详情读取发布投影。
- 目录导航读取官网目录树。
- 展示字段按覆盖/默认解析。

## 14. 验收标准

### 14.1 产品编辑页

- 一个产品可以添加多个官网展示配置。
- 每个官网配置独立保存。
- 官网目录通过树形选择器选择。
- 官网系列通过选择器选择。
- 已映射字段即使与产品库一致，也能显示来源。
- 用户可以修改官网覆盖值。
- 用户可以恢复产品库默认值。
- 删除某官网配置不删除产品主记录。

### 14.2 官网目录管理页

- 只显示目录名称、上级目录、排序、启停、官网显示、备注。
- 不显示 URL slug、编码、推荐、产品绑定、官网文案、官网图片、官网售价。
- 支持目录树展开/收起。
- 支持一级、二级、三级目录 CRUD。

### 14.3 后端

- 同一产品可挂多个官网。
- 同一产品同一官网默认不可重复配置。
- 目录和系列必须属于对应官网。
- slug 在同一官网唯一。
- 返回 resolved 字段，表达最终展示值和来源。

### 14.4 5011 官网

- 只展示已发布产品。
- 产品目录来自官网目录树。
- 产品展示字段按官网覆盖优先。
- 未覆盖字段回退产品库默认。

## 15. 待确认问题

1. 是否允许“同一产品在同一官网多个目录出现”？
   - 建议默认不允许，后续如需要可扩展为一个配置支持多目录。
2. 官网系列是否需要独立管理页？
   - 建议需要，避免产品库里手填系列。
3. 推荐字段是否按官网独立？
   - 建议独立，因为恒热推荐不等于 Rheem 推荐。
4. slug 是否允许系统自动生成后人工修改？
   - 建议允许，但同站唯一。
5. 5011 官网切换是否分阶段？
   - 建议先只接恒热产品页/列表页，不影响其他官网。
