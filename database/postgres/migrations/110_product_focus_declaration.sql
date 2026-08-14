-- 110 · 主销产品声明（品牌 × 品类 × 时间窗）
--
-- 性质界定（重要）：这是**品牌方策略声明**，不是对市场的事实断言。
--   "哪个型号好卖"需要销量/需求数据，当前不具备（成交未挂产品、无外部需求源）；
--   因此本表记录的是"总部决定推哪些型号"，并**强制过三道闸**避免自伤：
--     ① 毛利闸（基座3）：毛利率须达下限，否则推得越狠亏得越多；
--     ② 生命周期闸：eol 停产品不得主销，否则引流来了无货可交；
--     ③ 卖点证据闸（基座4）：须有带 evidenceRef 的卖点，否则 GEO 内容只能编造。
--   过闸快照落 gate_snapshot，便于事后复算"当时凭什么判它合格"。
--
-- 粒度：品牌 × 品类 × 时间窗。暖通季节性强（采暖季/热水季），故主销必须带生效期，
--   过期自然失效而非永久有效。
--
-- 后验校验（后续）：声明的主销 vs 渠道实际报价 BOM 的分歧，是给总部的镜子；
--   本表只存声明，不得据此宣称该型号真的好卖。
SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.product_focus_declaration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),

  -- 焦点范围
  brand_slug varchar NOT NULL,
  category varchar NOT NULL,
  product_id uuid,                                  -- 关联产品事实基座（D2）
  sku varchar,                                      -- 冗余留痕：产品改名/下架后仍可追溯当时声明的型号

  -- 生效窗口（含首含尾；暖通季节性所需）
  period_start date NOT NULL,
  period_end date NOT NULL,
  CONSTRAINT product_focus_period_valid CHECK (period_end >= period_start),

  -- 声明状态：active=生效中 / revoked=已撤销（不物理删除，保留决策痕迹）
  status varchar NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','revoked')),

  -- 为什么推它（策略理由，人工填写；这是政策而非数据推导，必须留下理由）
  rationale text NOT NULL,

  -- 过闸快照：{eligible, checks:[{id,passed,reason,detail}], marginFloor}
  gate_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  declared_by varchar,
  declared_at timestamptz NOT NULL DEFAULT now(),
  revoked_by varchar,
  revoked_at timestamptz,
  revoke_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 查询主路径：某品牌某品类当前生效的主销清单
CREATE INDEX IF NOT EXISTS product_focus_scope_idx
  ON rhautt_nexus.product_focus_declaration (tenant_id, brand_slug, category, status, period_end DESC);

CREATE INDEX IF NOT EXISTS product_focus_product_idx
  ON rhautt_nexus.product_focus_declaration (tenant_id, product_id);

-- 同一产品在同一品牌/品类下不得有多条生效中的声明（防重复声明导致优先级冲突）
CREATE UNIQUE INDEX IF NOT EXISTS product_focus_active_uniq
  ON rhautt_nexus.product_focus_declaration (tenant_id, brand_slug, category, product_id)
  WHERE status = 'active' AND product_id IS NOT NULL;

ALTER TABLE rhautt_nexus.product_focus_declaration ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.product_focus_declaration FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_focus_tenant_isolation ON rhautt_nexus.product_focus_declaration;
CREATE POLICY product_focus_tenant_isolation ON rhautt_nexus.product_focus_declaration
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON rhautt_nexus.product_focus_declaration TO rhautt_app;
