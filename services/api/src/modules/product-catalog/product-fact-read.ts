/**
 * D2 产品事实基座 —— 下游只读 facade。
 *
 * 依据 docs/D2-PRODUCT-FACT-BASE-BLUEPRINT.md §4/§8：product-catalog 是产品事实
 * 的单一事实源，下游模块不得直接 import ProductEntity / product-catalog.entity。
 * 需要读取产品事实的模块（如 content 内容工厂）一律经本 facade 取只读投影，
 * 写入闸仍唯一收敛在 product-catalog 自身。
 */
import type { EntityManager, Repository } from 'typeorm';
import { ProductEntity } from './product-catalog.entity';

/** 下游可见的产品事实只读视图（结构与实体一致，但语义上仅供读取）。 */
export type ProductFactView = ProductEntity;

/** 供模块装配（TypeOrmModule.forFeature / boot-smoke stub）使用的实体引用，不暴露实体名。 */
export const productFactEntity = ProductEntity;

/** 产品事实是否已核实（可作为内容生产的 verified 事实源）。 */
export function productFactReady(product: ProductFactView) {
  return (
    Boolean(product.factsVerifiedAt) ||
    product.dataReadinessStatus === 'fact_verified' ||
    product.dataReadinessStatus === 'ready'
  );
}

/** 产品是否处于对下游可用状态（active + published + 未删除）。 */
export function productEnabled(product: ProductFactView) {
  return (
    product.status === 'active' &&
    product.recordStatus === 'active' &&
    product.published === true &&
    !product.deletedAt
  );
}

/** 在既有 RLS 事务的 EntityManager 上取产品事实只读仓储。 */
export function productFactRepo(em: EntityManager): Repository<ProductFactView> {
  return em.getRepository(ProductEntity);
}
