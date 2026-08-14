-- 111 · GEO 问题库增加产品维度（产品级 GEO 评价的前提）
--
-- 动机：问题库此前只到「品牌 × 品类」，无法回答"给某个型号做 GEO 评价"。
--   探测记录已有 question_id 外链，故只需在问题上挂 product_id，
--   产品归因即可沿 question.product_id → probe.question_id 贯通，探测表无需再加列。
--
-- 用途（与主销声明联动，见迁移 110 / focus-gate.ts）：
--   过闸的主销产品 → 派生产品级选题（型号名 + 带证据的卖点）→ 探测 → 产品级可见度。
--   product_id 为空 = 品类级问题（既有数据全部兼容，不回填不臆造归属）。
--
-- sku 冗余留痕：产品改名/下架后，问题仍可追溯当时针对的型号。
SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.growth_geo_question
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS sku varchar;

CREATE INDEX IF NOT EXISTS growth_geo_question_product_idx
  ON rhautt_nexus.growth_geo_question (tenant_id, product_id)
  WHERE product_id IS NOT NULL;
