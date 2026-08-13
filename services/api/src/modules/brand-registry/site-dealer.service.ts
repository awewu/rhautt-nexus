import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { AuditLogEntity } from '../governance/governance.entity';
import { BrandSiteEntity, SiteDealerEntity } from './brand-site.entity';
import { normalizeSiteCode, resolvePublicSiteTenant } from './site-product-assignment.service';

type DealerStatus = 'active' | 'inactive';

export interface SiteDealerInput {
  name?: string;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  addr?: string | null;
  phone?: string | null;
  tel?: string | null;
  dealerType?: string | null;
  type?: string | null;
  services?: unknown;
  certifications?: unknown;
  cert?: unknown;
  latitude?: number | string | null;
  lat?: number | string | null;
  longitude?: number | string | null;
  lng?: number | string | null;
  sortOrder?: number | string;
  status?: DealerStatus;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUS_VALUES = new Set<DealerStatus>(['active', 'inactive']);

function text(value: unknown, max = 500): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, max);
}

function textArray(value: unknown, maxItem = 80): string[] {
  if (Array.isArray(value))
    return [...new Set(value.map((item) => text(item, maxItem)).filter(Boolean))];
  const raw = text(value, 1000);
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[,，、\n]/)
        .map((item) => text(item, maxItem))
        .filter(Boolean)
    ),
  ];
}

function numberValue(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new BadRequestException('经纬度超出有效范围');
  }
  return number;
}

export function siteDealerView(row: SiteDealerEntity) {
  const latitude = row.latitude === null ? null : Number(row.latitude);
  const longitude = row.longitude === null ? null : Number(row.longitude);
  return {
    id: row.id,
    siteCode: row.siteCode,
    name: row.name,
    province: row.province || '',
    city: row.city || '',
    district: row.district || '',
    address: row.address || '',
    addr: row.address || '',
    phone: row.phone || '',
    tel: row.phone || '',
    dealerType: row.dealerType || '',
    type: row.dealerType || '',
    services: Array.isArray(row.services) ? row.services : [],
    certifications: Array.isArray(row.certifications) ? row.certifications : [],
    cert: Array.isArray(row.certifications) ? row.certifications : [],
    latitude,
    longitude,
    lat: latitude,
    lng: longitude,
    sortOrder: row.sortOrder,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class SiteDealerService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  list(user: JwtPayload, siteCode: string, query: Record<string, unknown> = {}) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, user.tenantId, siteCode);
        const qb = this.filteredQuery(em, user.tenantId, site.id, query);
        const page = Math.max(Number(query.page) || 1, 1);
        const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 100);
        const [rows, total] = await qb
          .skip((page - 1) * pageSize)
          .take(pageSize)
          .getManyAndCount();
        return {
          items: rows.map(siteDealerView),
          total,
          page,
          pageSize,
          pages: Math.max(Math.ceil(total / pageSize), 1),
        };
      },
      this.scope(user)
    );
  }

  get(user: JwtPayload, siteCode: string, id: string) {
    return withRlsTransaction(
      this.ds,
      async (em) => siteDealerView(await this.findDealer(em, user.tenantId, siteCode, id)),
      this.scope(user)
    );
  }

  create(user: JwtPayload, siteCode: string, input: SiteDealerInput) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, user.tenantId, siteCode);
        const repo = em.getRepository(SiteDealerEntity);
        const saved = await repo.save(
          repo.create({
            tenantId: user.tenantId,
            siteId: site.id,
            siteCode: site.code,
            ...this.patch(input, true),
            createdBy: user.userId,
            updatedBy: user.userId,
          })
        );
        await this.audit(em, user, 'site-dealer.create', saved.id, null, { ...saved });
        return siteDealerView(saved);
      },
      this.scope(user)
    );
  }

  update(user: JwtPayload, siteCode: string, id: string, input: SiteDealerInput) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const row = await this.findDealer(em, user.tenantId, siteCode, id);
        const before = { ...row };
        Object.assign(row, this.patch(input, false), { updatedBy: user.userId });
        const saved = await em.getRepository(SiteDealerEntity).save(row);
        await this.audit(em, user, 'site-dealer.update', saved.id, before, { ...saved });
        return siteDealerView(saved);
      },
      this.scope(user)
    );
  }

  archive(user: JwtPayload, siteCode: string, id: string) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const row = await this.findDealer(em, user.tenantId, siteCode, id);
        const before = { ...row };
        row.deletedAt = new Date();
        row.deletedBy = user.userId;
        row.updatedBy = user.userId;
        await em.getRepository(SiteDealerEntity).save(row);
        await this.audit(em, user, 'site-dealer.archive', row.id, before, { ...row });
        return { ok: true, id };
      },
      this.scope(user)
    );
  }

  publicList(siteCodeInput: string, query: Record<string, unknown> = {}) {
    const siteCode = normalizeSiteCode(siteCodeInput);
    const tenantId = resolvePublicSiteTenant(siteCode);
    if (!tenantId || !UUID_RE.test(tenantId)) throw new NotFoundException('网站未配置公开租户');
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, tenantId, siteCode);
        const qb = this.filteredQuery(em, tenantId, site.id, { ...query, status: 'active' });
        const page = Math.max(Number(query.page) || 1, 1);
        const pageSize = Math.min(Math.max(Number(query.pageSize || query.limit) || 50, 1), 200);
        const [rows, total] = await qb
          .skip((page - 1) * pageSize)
          .take(pageSize)
          .getManyAndCount();
        return {
          success: true,
          data: {
            items: rows.map(siteDealerView),
            total,
            page,
            pageSize,
            pages: Math.max(Math.ceil(total / pageSize), 1),
          },
        };
      },
      { tenantId }
    );
  }

  private filteredQuery(
    em: EntityManager,
    tenantId: string,
    siteId: string,
    query: Record<string, unknown>
  ) {
    const qb = em
      .getRepository(SiteDealerEntity)
      .createQueryBuilder('dealer')
      .where('dealer.tenantId = :tenantId', { tenantId })
      .andWhere('dealer.siteId = :siteId', { siteId })
      .andWhere('dealer.deletedAt IS NULL');
    const status = text(query.status, 20);
    if (status && status !== 'all') qb.andWhere('dealer.status = :status', { status });
    const province = text(query.province, 80);
    if (province) qb.andWhere('dealer.province = :province', { province });
    const service = text(query.service, 80);
    if (service)
      qb.andWhere('dealer.services @> :service::jsonb', { service: JSON.stringify([service]) });
    const keyword = text(query.q || query.keyword, 100).toLowerCase();
    if (keyword) {
      qb.andWhere(
        `(
          lower(dealer.name) LIKE :keyword OR
          lower(coalesce(dealer.province, '')) LIKE :keyword OR
          lower(coalesce(dealer.city, '')) LIKE :keyword OR
          lower(coalesce(dealer.district, '')) LIKE :keyword OR
          lower(coalesce(dealer.address, '')) LIKE :keyword OR
          lower(coalesce(dealer.phone, '')) LIKE :keyword OR
          lower(coalesce(dealer.dealerType, '')) LIKE :keyword
        )`,
        { keyword: `%${keyword}%` }
      );
    }
    return qb
      .orderBy('dealer.sortOrder', 'ASC')
      .addOrderBy('dealer.updatedAt', 'DESC')
      .addOrderBy('dealer.createdAt', 'DESC');
  }

  private patch(input: SiteDealerInput, creating: boolean): Partial<SiteDealerEntity> {
    const patch: Partial<SiteDealerEntity> = {};
    if (creating || input.name !== undefined) {
      const name = text(input.name, 200);
      if (!name) throw new BadRequestException('服务网点名称不能为空');
      patch.name = name;
    }
    if (creating || input.province !== undefined) patch.province = text(input.province, 80) || null;
    if (creating || input.city !== undefined) patch.city = text(input.city, 80) || null;
    if (creating || input.district !== undefined) patch.district = text(input.district, 80) || null;
    if (creating || input.address !== undefined || input.addr !== undefined) {
      patch.address = text(input.address ?? input.addr, 500) || null;
    }
    if (creating || input.phone !== undefined || input.tel !== undefined) {
      patch.phone = text(input.phone ?? input.tel, 40) || null;
    }
    if (creating || input.dealerType !== undefined || input.type !== undefined) {
      patch.dealerType = text(input.dealerType ?? input.type, 80) || null;
    }
    if (creating || input.services !== undefined) patch.services = textArray(input.services);
    if (creating || input.certifications !== undefined || input.cert !== undefined) {
      patch.certifications = textArray(input.certifications ?? input.cert);
    }
    if (creating || input.latitude !== undefined || input.lat !== undefined) {
      patch.latitude = numberValue(input.latitude ?? input.lat, -90, 90);
    }
    if (creating || input.longitude !== undefined || input.lng !== undefined) {
      patch.longitude = numberValue(input.longitude ?? input.lng, -180, 180);
    }
    if (creating || input.sortOrder !== undefined) {
      const order = Number(input.sortOrder ?? 0);
      if (!Number.isInteger(order) || order < 0 || order > 999999) {
        throw new BadRequestException('排序必须是非负整数');
      }
      patch.sortOrder = order;
    }
    if (creating || input.status !== undefined) {
      const status = (input.status || 'active') as DealerStatus;
      if (!STATUS_VALUES.has(status)) throw new BadRequestException('服务网点状态无效');
      patch.status = status;
    }
    return patch;
  }

  private async findSite(em: EntityManager, tenantId: string, siteCode: string) {
    const site = await em.getRepository(BrandSiteEntity).findOneBy({
      tenantId,
      code: normalizeSiteCode(siteCode),
      status: 'active',
      deletedAt: null,
    } as any);
    if (!site) throw new NotFoundException('网站不存在或未启用');
    return site;
  }

  private async findDealer(em: EntityManager, tenantId: string, siteCode: string, id: string) {
    const site = await this.findSite(em, tenantId, siteCode);
    const row = await em.getRepository(SiteDealerEntity).findOneBy({
      id,
      tenantId,
      siteId: site.id,
      deletedAt: null,
    } as any);
    if (!row) throw new NotFoundException('服务网点不存在或已归档');
    return row;
  }

  private scope(user: JwtPayload) {
    return { tenantId: user.tenantId, actorId: user.userId, role: user.role };
  }

  private async audit(
    em: EntityManager,
    user: JwtPayload,
    action: string,
    id: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown>
  ) {
    const repo = em.getRepository(AuditLogEntity);
    await repo.save(
      repo.create({
        tenantId: user.tenantId,
        actorUserId: user.userId,
        action,
        resourceType: 'site-dealer',
        resourceId: id,
        beforeState: before,
        afterState: after,
        requestId: null,
        traceId: null,
        ipHash: null,
      })
    );
  }
}
