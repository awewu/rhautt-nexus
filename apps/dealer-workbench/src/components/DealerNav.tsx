'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, UserCog, UserRound } from 'lucide-react';
import { clearToken } from '@rhautt/shared-auth';
import { WORKBENCH_NAV, canSeeNavItem, navItemForPath } from '../lib/workbench-navigation';
import type { WorkbenchChild } from '../lib/workbench-navigation';
import { adminUsers, auth, brandSites } from '../lib/api';
import NotificationBell from './NotificationBell';

type BrandSiteNavItem = {
  id: string;
  code: string;
  nameCn: string;
  nameEn: string;
  sortOrder: number;
  status: string;
  deletedAt: string | null;
};

type AccountProfile = {
  id?: string;
  userId?: string;
  tenantId?: string;
  name?: string;
  email?: string;
  phone?: string;
  identifier?: string;
  identifierMasked?: string;
  identifierKind?: 'email' | 'phone' | 'unknown';
  role?: string;
  roles?: string[];
  permissions?: string[];
};

const ROLE_LABEL: Record<string, string> = {
  brand_admin: '品牌管理员',
  platform_admin: '平台超管',
  hq_admin: '总部管理员',
  regional_manager: '区域经理',
  dealer_admin: '经销商管理员',
  store_manager: '门店经理',
  designer: '设计师',
  sales: '销售',
  engineer: '工程师',
  installer: '安装工',
  customer: '客户',
};

function readCachedProfile(): AccountProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem('user');
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function cleanAccountValue(value?: string | null) {
  const text = String(value || '').trim();
  if (!text || text === '***') return '';
  return text;
}

function isRoleLikeAccountName(value?: string | null) {
  const text = cleanAccountValue(value);
  if (!text) return false;
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  const roleNames = new Set([
    ...Object.keys(ROLE_LABEL).map((role) => role.toLowerCase()),
    ...Object.values(ROLE_LABEL).map((role) => role.replace(/\s+/g, '').toLowerCase()),
    '超级管理员',
    '平台超级管理员',
    '系统管理员',
  ]);
  return roleNames.has(normalized);
}

function mergeProfile(base: AccountProfile | null, next: AccountProfile): AccountProfile {
  const nextName = cleanAccountValue(next.name);
  const baseName = cleanAccountValue(base?.name);
  return {
    ...(base || {}),
    ...next,
    name:
      (!isRoleLikeAccountName(nextName) && nextName) ||
      (!isRoleLikeAccountName(baseName) && baseName) ||
      undefined,
    email: cleanAccountValue(next.email) || cleanAccountValue(base?.email) || undefined,
    phone: cleanAccountValue(next.phone) || cleanAccountValue(base?.phone) || undefined,
    identifier:
      cleanAccountValue(next.identifier) || cleanAccountValue(base?.identifier) || undefined,
    identifierMasked:
      cleanAccountValue(next.identifierMasked) ||
      cleanAccountValue(base?.identifierMasked) ||
      undefined,
  };
}

function accountInitials(profile: AccountProfile | null) {
  const source =
    cleanAccountValue(profile?.name) ||
    cleanAccountValue(profile?.identifierMasked) ||
    cleanAccountValue(profile?.phone) ||
    cleanAccountValue(profile?.email) ||
    cleanAccountValue(profile?.identifier);
  if (!source) return '账';
  if (/^\d+$/.test(source)) return source.slice(-1);
  const compact = source.includes('@') ? source.split('@')[0] : source;
  return compact.slice(0, 1).toUpperCase();
}

function canReadAccountDirectory(profile: AccountProfile) {
  const permissions = profile.permissions || [];
  return (
    profile.role === 'platform_admin' ||
    profile.role === 'hq_admin' ||
    permissions.includes('*') ||
    permissions.includes('admin.users.read')
  );
}

async function enrichProfileFromAccountDirectory(profile: AccountProfile): Promise<AccountProfile> {
  if (cleanAccountValue(profile.name) && !isRoleLikeAccountName(profile.name)) return profile;
  if (!canReadAccountDirectory(profile)) return profile;
  const currentId = cleanAccountValue(profile.id || profile.userId);
  if (!currentId) return profile;

  const result = await adminUsers.list();
  const users = Array.isArray(result?.users) ? result.users : [];
  const currentUser = users.find(
    (user: AccountProfile) => cleanAccountValue(user.id || user.userId) === currentId
  );
  if (!currentUser) return profile;

  return mergeProfile(profile, {
    id: currentUser.id,
    userId: currentUser.userId,
    name: currentUser.name,
    role: currentUser.role || profile.role,
    identifierMasked: currentUser.identifierMasked || profile.identifierMasked,
    identifierKind: currentUser.identifierKind || profile.identifierKind,
  });
}

export default function DealerNav() {
  const path = usePathname();
  const [search, setSearch] = useState('');
  const [siteNavItems, setSiteNavItems] = useState<BrandSiteNavItem[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const activeItem = navItemForPath(path);
  const visibleNav = WORKBENCH_NAV.filter((item) =>
    canSeeNavItem(item, profile?.permissions || [], profile?.role)
  );
  const currentHref = `${path || ''}${search}`;

  useEffect(() => {
    setSearch(window.location.search);
  }, [path]);

  useEffect(() => {
    const cached = readCachedProfile();
    if (cached) setProfile(cached);

    let cancelled = false;
    auth
      .me()
      .then(async (me) => {
        if (cancelled) return;
        const fromMe = mergeProfile(cached, me);
        const enriched = await enrichProfileFromAccountDirectory(fromMe).catch(() => fromMe);
        if (cancelled) return;
        setProfile((current) => {
          const merged = mergeProfile(current || cached, enriched);
          localStorage.setItem('user', JSON.stringify(merged));
          return merged;
        });
      })
      .catch(() => {
        if (!cancelled && !cached) setProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const close = (event: MouseEvent) => {
      if (!(event.target as Element | null)?.closest('.account-menu-wrap')) setAccountOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [accountOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadBrandSiteNav() {
      try {
        const result = await brandSites.list();
        if (cancelled) return;
        const items = ((result.items || []) as BrandSiteNavItem[])
          .filter((site) => site.status === 'active' && !site.deletedAt)
          .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
        setSiteNavItems(items);
      } catch {
        if (!cancelled) setSiteNavItems([]);
      }
    }

    if (activeItem.key !== 'brand-sites') {
      setSiteNavItems([]);
      return;
    }

    loadBrandSiteNav();
    window.addEventListener('rhautt-brand-sites-updated', loadBrandSiteNav);
    return () => {
      cancelled = true;
      window.removeEventListener('rhautt-brand-sites-updated', loadBrandSiteNav);
    };
  }, [activeItem.key]);

  if (path === '/') return null;

  // 静态配置里的 site-* 子项按 code 建索引：动态站点复用各自图标（此前全部退化成同一个地球）
  const staticSiteChildren = activeItem.children.filter((c) => c.key.startsWith('site-'));
  const staticSiteByCode = new Map(staticSiteChildren.map((c) => [c.key.replace(/^site-/, ''), c]));
  const nonSiteTail = activeItem.children.filter(
    (c, i) => i > 0 && !c.key.startsWith('site-')
  );
  const activeChildren: WorkbenchChild[] =
    activeItem.key === 'brand-sites'
      ? [
          activeItem.children[0],
          ...(siteNavItems.length
            ? siteNavItems.map((site) => ({
                key: `site-${site.code}`,
                label: `${site.nameCn || site.nameEn} ${site.nameEn || ''}`.trim(),
                href: `/comfort/sites/${encodeURIComponent(site.code)}`,
                icon: staticSiteByCode.get(site.code)?.icon ?? activeItem.children[0].icon,
              }))
            : staticSiteChildren),
          ...nonSiteTail,
        ]
      : activeItem.children;

  function isChildSelected(href: string) {
    const childPath = href.split('?')[0];
    if (childPath === '/products' && path === '/products') {
      const childModule =
        new URLSearchParams(href.split('?')[1] || '').get('module') || 'dashboard';
      return (new URLSearchParams(search).get('module') || 'dashboard') === childModule;
    }
    if (childPath === '/accounts' && path === '/accounts') {
      const childModule = new URLSearchParams(href.split('?')[1] || '').get('module') || 'users';
      return (new URLSearchParams(search).get('module') || 'users') === childModule;
    }
    if (href.includes('?')) return currentHref === href;
    if (path === childPath) return true;
    if (!path?.startsWith(`${childPath}/`)) return false;
    return !activeChildren.some((child) => {
      const candidatePath = child.href.split('?')[0];
      return (
        candidatePath !== childPath &&
        (path === candidatePath || path.startsWith(`${candidatePath}/`))
      );
    });
  }

  function rememberChildSearch(href: string) {
    if (typeof window === 'undefined') return;
    setSearch(new URL(href, window.location.href).search);
  }

  async function logout() {
    await auth.logout().catch(() => {});
    await fetch('/api/session/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    clearToken();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  }

  const loginIdentifier =
    cleanAccountValue(profile?.identifierMasked) ||
    cleanAccountValue(profile?.email) ||
    cleanAccountValue(profile?.phone) ||
    cleanAccountValue(profile?.identifier);
  const profileName = cleanAccountValue(profile?.name);
  const displayAccountName =
    profileName || (loginIdentifier ? `账号 ${loginIdentifier}` : '账号信息待完善');
  const displayAccountContact = loginIdentifier
    ? `登录账号：${loginIdentifier}`
    : '登录账号：未绑定手机号/邮箱';
  const displayContactStatus = loginIdentifier
    ? `联系方式：${profile?.identifierKind === 'email' ? '邮箱已绑定' : profile?.identifierKind === 'phone' ? '手机号已绑定' : '已绑定'}`
    : '联系方式：待绑定';
  const displayRoleLabel =
    (profile?.role && ROLE_LABEL[profile.role]) || profile?.role || '未分配角色';
  const displayInitials = accountInitials(profile);

  return (
    <>
      <aside className="sidebar items-center">
        <div className="h-[3px] w-full shrink-0 bg-primary" />
        {/* 文字 logo（2026-08 去白底）：logo 图是红+黑字，深色侧栏上只能垫白盒；
            改为门户同款文字标——红 Rha + 白 utt.，黑字位用白替代，品牌红锚点保留 */}
        <div
          className="mx-auto mt-2.5 mb-2 flex h-7 shrink-0 items-center justify-center text-[14px] leading-none font-extrabold tracking-tight select-none"
          aria-label="Rhautt Comfort"
        >
          <span className="text-[color:var(--brand-400)]">Rha</span>
          <span className="text-white">utt.</span>
        </div>
        <div className="mx-auto mb-2 h-px w-8 bg-white/[0.08]" />

        <nav className="w-full flex-1 overflow-x-hidden overflow-y-auto py-1" aria-label="营销控制台主导航">
          {visibleNav.map((item, index) => {
            const active = item.key === activeItem.key;
            const Icon = item.icon;
            const previous = visibleNav[index - 1];
            return (
              <div key={item.key}>
                {previous && previous.group !== item.group && (
                  <div className="mx-3 my-1.5 h-px bg-white/[0.08]" />
                )}
                <Link
                  href={item.href}
                  title={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={`relative mx-auto my-px flex min-h-11 w-[54px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg no-underline transition-all duration-100 ${
                    active ? 'bg-primary/20 text-white' : 'text-white/50'
                  }`}
                >
                  {active && (
                    <span className="absolute top-1/2 -left-1 h-[18px] w-[3px] -translate-y-1/2 rounded-xs bg-primary" />
                  )}
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                  <span
                    className={`max-w-[52px] truncate text-[9px] leading-[1.1] ${active ? 'font-bold' : 'font-medium'}`}
                  >
                    {item.shortLabel}
                  </span>
                </Link>
              </div>
            );
          })}
        </nav>

        <NotificationBell />

        <div className="account-menu-wrap">
          {accountOpen && (
            <div className="account-menu" role="menu" aria-label="账户菜单">
              <div className="account-menu-profile">
                <div className="account-menu-name">{displayAccountName}</div>
                <div className="account-menu-contact">{displayAccountContact}</div>
                <div className="account-menu-contact">{displayContactStatus}</div>
                <div className="account-menu-role">当前角色：{displayRoleLabel}</div>
              </div>
              <div className="account-menu-actions">
                <Link href="/accounts" role="menuitem" onClick={() => setAccountOpen(false)}>
                  <UserCog size={15} />
                  <span>账号管理</span>
                </Link>
                <button type="button" role="menuitem" onClick={logout}>
                  <LogOut size={15} />
                  <span>退出登录</span>
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            className="account-trigger"
            aria-label="展开账户菜单"
            aria-expanded={accountOpen}
            onClick={(event) => {
              event.stopPropagation();
              setAccountOpen((open) => !open);
            }}
          >
            {profile ? displayInitials : <UserRound size={17} />}
          </button>
          <div className="account-version">v2</div>
        </div>
      </aside>

      {/* 二级菜单：横向 tab 栏（仅当有多个子视图时显示），置于内容区顶部，一级菜单直接占满工作区 */}
      {activeChildren.length > 1 && (
        <nav className="workbench-tabbar" aria-label={`${activeItem.label}二级菜单`}>
          {activeChildren.map((child) => {
            const ChildIcon = child.icon;
            const selected = isChildSelected(child.href);
            return (
              <Link
                key={child.key}
                href={child.href}
                title={child.label}
                className={selected ? 'is-active' : undefined}
                onClick={() => rememberChildSearch(child.href)}
              >
                <ChildIcon size={15} strokeWidth={selected ? 2.3 : 1.8} />
                <span>{child.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      <nav
        className="mobile-nav fixed right-0 bottom-0 left-0 z-50 hidden overflow-x-auto border-t bg-white/90 py-1.5 backdrop-blur-lg"
        // 列数依导航项数动态计算：内联样式的合法例外
        style={{ gridTemplateColumns: `repeat(${Math.max(visibleNav.length, 1)}, minmax(58px, 1fr))` }}
        aria-label="移动端营销导航"
      >
        {visibleNav.map((item) => {
          const active = item.key === activeItem.key;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-[3px] py-1 text-[10px] no-underline ${
                active ? 'font-bold text-primary' : 'font-medium text-muted-foreground/70'
              }`}
            >
              <Icon size={18} />
              {item.shortLabel}
            </Link>
          );
        })}
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .sidebar { display: none !important; }
          .workbench-subnav { display: none !important; }
          .mobile-nav { display: grid !important; }
        }
        .sidebar nav a:hover {
          background: rgba(255,255,255,0.08) !important;
          color: rgba(255,255,255,0.85) !important;
        }
        .sidebar nav a[aria-current="page"]:hover {
          background: rgba(200,32,44,0.26) !important;
          color: #fff !important;
        }
      `}</style>
    </>
  );
}
