'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Ban,
  Check,
  ClipboardList,
  KeyRound,
  LockKeyhole,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCog,
  UsersRound,
} from 'lucide-react';
import { adminRbac, adminUsers, auditLogs, auth } from '../../lib/api';
import {
  StatusPill,
  WorkbenchFilterToolbar,
  WorkbenchPaginationFooter,
  WorkbenchSectionHeader,
  WorkbenchTableShell,
  WorkbenchTableState,
} from '../../components/WorkbenchCore';
import { AdminUser, PermissionItem, RoleItem, AuditLogRow, AccountsTab, AUDIT_MODULE_FILTER_OPTIONS, AUDIT_ACTION_FILTER_OPTIONS, AUDIT_PAGE_SIZE_OPTIONS, ACCOUNT_PAGE_SIZE_OPTIONS, STATUS_TONE, labelForRole, displayRoleName, displayRoleDescription, displayAuditModule, displayAuditAction, displayAuditResource, displayContact, displayStatus, can } from './helpers';
import { CreateUserModal, CreateRoleModal, AssignRolesModal, RolePermissionsModal, ResetModal, AuditDetailModal, TabButton, Metric, Banner, Center, tdClass } from './modals';

export default function AccountsPage() {
  return (
    <Suspense
      fallback={
        <Center>
          <WorkbenchTableState type="loading" title="正在加载账号权限" />
        </Center>
      }
    >
      <AccountsPageContent />
    </Suspense>
  );
}



function AccountsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleParam = searchParams.get('module') || 'users';
  const [meRole, setMeRole] = useState<string | null>(null);
  const [mePermissions, setMePermissions] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authed, setAuthed] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [tab, setTab] = useState<AccountsTab>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [auditRows, setAuditRows] = useState<AuditLogRow[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditModule, setAuditModule] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditStatus, setAuditStatus] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [rolesPage, setRolesPage] = useState(1);
  const [rolesPageSize, setRolesPageSize] = useState(10);
  const [auditDetail, setAuditDetail] = useState<AuditLogRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [fRole, setFRole] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [assignFor, setAssignFor] = useState<AdminUser | null>(null);
  const [editRoleFor, setEditRoleFor] = useState<RoleItem | null>(null);

  const canViewUsers = can(mePermissions, 'admin.users.view', meRole);
  const canReadUsers = can(mePermissions, 'admin.users.read', meRole);
  const canCreateUser = can(mePermissions, 'admin.users.create', meRole);
  const canUpdateUser = can(mePermissions, 'admin.users.update', meRole);
  const canDeleteUser = can(mePermissions, 'admin.users.delete', meRole);
  const canResetPassword = can(mePermissions, 'admin.users.reset_password', meRole);
  const canAssignRoles = can(mePermissions, 'admin.users.assign_roles', meRole);
  const canViewRoles = can(mePermissions, 'admin.roles.view', meRole);
  const canReadRoles = can(mePermissions, 'admin.roles.read', meRole);
  const canReadPermissions = can(mePermissions, 'admin.permissions.read', meRole);
  const canCreateRole = can(mePermissions, 'admin.roles.create', meRole);
  const canUpdateRole = can(mePermissions, 'admin.roles.update', meRole);
  const canAssignPermissions = can(mePermissions, 'admin.roles.assign_permissions', meRole);
  const canReadAudit = can(mePermissions, 'system.audit.read', meRole);
  const canUseUsersTab = canViewUsers && canReadUsers;
  const canUseRolesTab = canViewRoles && canReadRoles && canReadPermissions;
  const canUseAuditTab = canReadAudit;
  const auditTotalPages = Math.max(Math.ceil(auditTotal / auditPageSize), 1);
  const usersTotalPages = Math.max(Math.ceil(users.length / usersPageSize), 1);
  const rolesTotalPages = Math.max(Math.ceil(roles.length / rolesPageSize), 1);

  const activeRoles = useMemo(() => roles.filter((role) => role.status === 'active'), [roles]);
  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * usersPageSize;
    return users.slice(start, start + usersPageSize);
  }, [users, usersPage, usersPageSize]);
  const paginatedRoles = useMemo(() => {
    const start = (rolesPage - 1) * rolesPageSize;
    return roles.slice(start, start + rolesPageSize);
  }, [roles, rolesPage, rolesPageSize]);

  const selectTab = useCallback(
    (nextTab: AccountsTab) => {
      setTab(nextTab);
      const nextParams = new URLSearchParams(searchParams.toString());
      if (nextTab === 'users') nextParams.delete('module');
      else nextParams.set('module', nextTab);
      const query = nextParams.toString();
      router.replace(query ? `/accounts?${query}` : '/accounts', { scroll: false });
    },
    [router, searchParams]
  );

  const loadAuditRows = useCallback(async () => {
    if (!canReadAudit) {
      setAuditRows([]);
      setAuditTotal(0);
      return;
    }
    setAuditLoading(true);
    try {
      const q: Record<string, string> = { page: String(auditPage), limit: String(auditPageSize) };
      if (auditModule) q.module = auditModule;
      if (auditAction) q.action = auditAction;
      if (auditStatus) q.status = auditStatus;
      if (auditSearch) q.search = auditSearch;
      const res = await auditLogs.list(q);
      setAuditRows(res.logs || []);
      setAuditTotal(res.total || 0);
    } finally {
      setAuditLoading(false);
    }
  }, [auditAction, auditModule, auditPage, auditPageSize, auditSearch, auditStatus, canReadAudit]);

  const loadUsers = useCallback(async () => {
    if (!canReadUsers) {
      setUsers([]);
      return;
    }
    const q: Record<string, string> = {};
    if (search) q.search = search;
    if (fRole) q.role = fRole;
    if (fStatus) q.status = fStatus;
    const res = await adminUsers.list(q);
    setUsers(res.users || []);
  }, [canReadUsers, search, fRole, fStatus]);

  const loadRbac = useCallback(async () => {
    const [roleRes, permissionRes] = await Promise.all([
      canReadRoles ? adminRbac.roles() : Promise.resolve({ roles: [] }),
      canReadPermissions ? adminRbac.permissions() : Promise.resolve({ permissions: [] }),
    ]);
    setRoles(roleRes.roles || []);
    setPermissions(permissionRes.permissions || []);
  }, [canReadPermissions, canReadRoles]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      if (!canReadUsers) setUsers([]);
      if (!canReadRoles && !canReadPermissions) {
        setRoles([]);
        setPermissions([]);
      }
      await Promise.all([
        canReadUsers ? loadUsers() : Promise.resolve(),
        canReadRoles || canReadPermissions ? loadRbac() : Promise.resolve(),
        canReadAudit && tab === 'audit' ? loadAuditRows() : Promise.resolve(),
      ]);
    } catch (error) {
      setErr((error as Error).message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [
    canReadAudit,
    canReadPermissions,
    canReadRoles,
    canReadUsers,
    loadAuditRows,
    loadRbac,
    loadUsers,
    tab,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      let role: string | null = null;
      let effectivePermissions: string[] = [];
      try {
        const me = await auth.me();
        if (cancelled) return;
        role = me.role || null;
        effectivePermissions = me.permissions || [];
        setMeRole(role);
        setMePermissions(effectivePermissions);
        setCurrentUserId(me.id || me.userId || null);
      } catch {
        if (!cancelled) window.location.href = '/?returnUrl=' + encodeURIComponent('/accounts');
        return;
      }

      if (
        !can(effectivePermissions, 'admin.users.view', role) &&
        !can(effectivePermissions, 'admin.roles.view', role) &&
        !can(effectivePermissions, 'system.audit.read', role)
      ) {
        setAuthed('denied');
        setLoading(false);
        return;
      }

      setAuthed('ok');
      try {
        const canLoadUsers = can(effectivePermissions, 'admin.users.read', role);
        const canLoadRoles = can(effectivePermissions, 'admin.roles.read', role);
        const canLoadPermissions = can(effectivePermissions, 'admin.permissions.read', role);
        const canLoadAudit = can(effectivePermissions, 'system.audit.read', role);
        const q: Record<string, string> = {};
        if (search) q.search = search;
        if (fRole) q.role = fRole;
        if (fStatus) q.status = fStatus;
        const shouldLoadAudit = moduleParam === 'audit' && canLoadAudit;
        const [userRes, roleRes, permissionRes, auditRes] = await Promise.all([
          canLoadUsers ? adminUsers.list(q) : Promise.resolve({ users: [] }),
          canLoadRoles ? adminRbac.roles() : Promise.resolve({ roles: [] }),
          canLoadPermissions ? adminRbac.permissions() : Promise.resolve({ permissions: [] }),
          shouldLoadAudit
            ? auditLogs.list({ page: '1', limit: String(auditPageSize) })
            : Promise.resolve({ logs: [], total: 0 }),
        ]);
        if (cancelled) return;
        setUsers(userRes.users || []);
        setRoles(roleRes.roles || []);
        setPermissions(permissionRes.permissions || []);
        setAuditRows(auditRes.logs || []);
        setAuditTotal(auditRes.total || 0);
        if (moduleParam === 'audit' && canLoadAudit) setTab('audit');
        else if (moduleParam === 'roles' && canLoadRoles && canLoadPermissions) setTab('roles');
        else if (canLoadUsers) setTab('users');
      } catch (error) {
        if (!cancelled) setErr((error as Error).message || '账号权限数据加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [auditPageSize, fRole, fStatus, moduleParam, search]);

  useEffect(() => {
    if (authed !== 'ok') return;
    if (moduleParam === 'audit' && canUseAuditTab && tab !== 'audit') setTab('audit');
    if (moduleParam === 'roles' && canUseRolesTab && tab !== 'roles') setTab('roles');
    if ((moduleParam === 'users' || !moduleParam) && canUseUsersTab && tab !== 'users')
      setTab('users');
    if (tab === 'users' && !canUseUsersTab && canUseRolesTab) setTab('roles');
    if (tab === 'users' && !canUseUsersTab && !canUseRolesTab && canUseAuditTab) setTab('audit');
    if (tab === 'roles' && !canUseRolesTab && canUseUsersTab) setTab('users');
    if (tab === 'roles' && !canUseRolesTab && !canUseUsersTab && canUseAuditTab) setTab('audit');
    if (tab === 'audit' && !canUseAuditTab && canUseUsersTab) setTab('users');
    if (tab === 'audit' && !canUseAuditTab && !canUseUsersTab && canUseRolesTab) setTab('roles');
  }, [authed, canUseAuditTab, canUseRolesTab, canUseUsersTab, moduleParam, tab]);

  useEffect(() => {
    if (authed !== 'ok' || tab !== 'audit' || !canUseAuditTab) return;
    loadAuditRows().catch((error) => setErr((error as Error).message || '操作日志加载失败'));
  }, [authed, canUseAuditTab, loadAuditRows, tab]);

  useEffect(() => {
    if (tab === 'audit' && auditPage > auditTotalPages) setAuditPage(auditTotalPages);
  }, [auditPage, auditTotalPages, tab]);

  useEffect(() => {
    if (tab === 'users' && usersPage > usersTotalPages) setUsersPage(usersTotalPages);
  }, [tab, usersPage, usersTotalPages]);

  useEffect(() => {
    if (tab === 'roles' && rolesPage > rolesTotalPages) setRolesPage(rolesTotalPages);
  }, [rolesPage, rolesTotalPages, tab]);

  function flash(message: string) {
    setMsg(message);
    window.setTimeout(() => setMsg(''), 2500);
  }

  function reloadAuditFromFirstPage() {
    if (auditPage !== 1) {
      setAuditPage(1);
      return;
    }
    loadAuditRows().catch((error) => setErr((error as Error).message || '操作日志加载失败'));
  }

  async function updateUser(user: AdminUser, patch: Record<string, unknown>) {
    setErr('');
    try {
      await adminUsers.update(user.id, patch);
      flash('账号已更新：' + user.name);
      await loadUsers();
    } catch (error) {
      setErr((error as Error).message || '更新失败');
    }
  }

  async function deleteUser(user: AdminUser) {
    if (user.id === currentUserId) {
      setErr('不能删除当前登录账号');
      return;
    }
    if (!window.confirm(`确认删除账号「${user.name}」？删除后不能在列表中恢复。`)) return;
    setErr('');
    try {
      await adminUsers.remove(user.id);
      flash('账号已删除：' + user.name);
      await loadUsers();
    } catch (error) {
      setErr((error as Error).message || '删除失败');
    }
  }

  if (authed === 'denied') {
    return (
      <Center>
        <WorkbenchTableState
          type="error"
          title="当前账号无权访问账号权限管理"
          description="需要账号或角色管理权限后才能维护用户、角色和权限。"
        />
      </Center>
    );
  }

  if (authed === 'ok' && !canUseUsersTab && !canUseRolesTab && !canUseAuditTab) {
    return (
      <Center>
        <WorkbenchTableState
          type="error"
          title="当前账号缺少账号或角色数据读取权限"
          description="页面入口权限只控制是否可见；列表、配置和日志需要对应 read 权限，避免继续请求无权接口。"
        />
      </Center>
    );
  }

  return (
    <div className="page-container grid gap-4.5">
      <WorkbenchSectionHeader
        eyebrow="营销工作台"
        title="账号权限"
        description="动态维护后台角色、页面可见性与 CRUD 操作权限。用户可绑定多个角色，权限叠加生效。"
        actions={
          <div className="flex flex-wrap justify-end gap-2.5">
            <a href="/comfort/sites" className="btn btn-outline btn-sm">
              <ArrowLeft size={14} />
              品牌官网
            </a>
            {canCreateRole && (
              <button onClick={() => setShowCreateRole(true)} className="btn btn-outline btn-sm">
                <ShieldCheck size={14} />
                新建角色
              </button>
            )}
            {canCreateUser && (
              <button onClick={() => setShowCreateUser(true)} className="btn btn-brand btn-sm">
                <Plus size={14} />
                新建账号
              </button>
            )}
          </div>
        }
      />

      <div className="card-elevated inline-flex justify-self-start gap-1 p-1.5">
        {canUseUsersTab && (
          <TabButton
            active={tab === 'users'}
            onClick={() => selectTab('users')}
            icon={<UsersRound size={14} />}
          >
            账号分配
          </TabButton>
        )}
        {canUseRolesTab && (
          <TabButton
            active={tab === 'roles'}
            onClick={() => selectTab('roles')}
            icon={<ShieldCheck size={14} />}
          >
            角色权限
          </TabButton>
        )}
        {canUseAuditTab && (
          <TabButton
            active={tab === 'audit'}
            onClick={() => selectTab('audit')}
            icon={<ClipboardList size={14} />}
          >
            操作日志
          </TabButton>
        )}
      </div>

      {err && <Banner tone="error">{err}</Banner>}
      {msg && <Banner tone="success">{msg}</Banner>}

      {tab === 'users' ? (
        <section className="grid gap-3.5">
          <WorkbenchFilterToolbar className="accounts-filter-toolbar">
            <div className="relative min-w-[220px] flex-[1_1_360px]">
              <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground/70" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setUsersPage(1);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    setUsersPage(1);
                    refreshAll();
                  }
                }}
                placeholder="搜索姓名 / 联系方式"
                className="input w-full pl-[34px]"
              />
            </div>
            <select
              value={fRole}
              onChange={(event) => {
                setFRole(event.target.value);
                setUsersPage(1);
              }}
              className="select accounts-filter-toolbar__select"
            >
              <option value="">全部角色</option>
              {roles.map((role) => (
                <option key={role.id} value={role.code}>
                  {displayRoleName(role)}
                </option>
              ))}
            </select>
            <select
              value={fStatus}
              onChange={(event) => {
                setFStatus(event.target.value);
                setUsersPage(1);
              }}
              className="select accounts-filter-toolbar__select"
            >
              <option value="">全部状态</option>
              <option value="active">正常</option>
              <option value="inactive">停用</option>
              <option value="suspended">冻结</option>
            </select>
            <button
              onClick={() => {
                setUsersPage(1);
                refreshAll();
              }}
              className="btn btn-outline btn-sm"
            >
              <Search size={14} />
              查询
            </button>
            <span className="workbench-filter-toolbar__meta">共 {users.length} 个账号</span>
          </WorkbenchFilterToolbar>

          <WorkbenchTableShell>
            <table className="table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>联系方式</th>
                  <th>主角色</th>
                  <th>状态</th>
                  <th>最近登录</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6}>
                      <WorkbenchTableState type="loading" title="正在加载账号" />
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <WorkbenchTableState
                        type="empty"
                        title="暂无账号"
                        description="调整筛选条件后可以重新查询。"
                      />
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => {
                    const canRemoveUser = canDeleteUser && user.id !== currentUserId;
                    const hasUserActions =
                      canUpdateUser || canAssignRoles || canResetPassword || canRemoveUser;

                    return (
                      <tr key={user.id}>
                        <td>
                          {user.name}
                          {user.isLocked && (
                            <span className="badge badge-warning ml-1.5">
                              <LockKeyhole size={12} />
                              锁定
                            </span>
                          )}
                        </td>
                        <td className={`${tdClass} font-mono text-muted-foreground`}>
                          {displayContact(user)}
                        </td>
                        <td>
                          <span className="pill-neutral">
                            <ShieldCheck size={12} />
                            {labelForRole(user.role, roles)}
                          </span>
                        </td>
                        <td>
                          <StatusPill tone={STATUS_TONE[user.status]}>
                            {displayStatus(user.status)}
                          </StatusPill>
                        </td>
                        <td className={`${tdClass} text-[12.5px] text-muted-foreground/80`}>
                          {user.lastLoginAt
                            ? new Date(user.lastLoginAt).toLocaleDateString('zh-CN')
                            : '-'}
                        </td>
                        <td>
                          {hasUserActions ? (
                            <div className="table-row-actions">
                              {canUpdateUser &&
                                (user.status === 'active' ? (
                                  <button
                                    onClick={() => updateUser(user, { status: 'inactive' })}
                                    className="btn btn-outline btn-sm"
                                  >
                                    <Ban size={13} />
                                    停用
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => updateUser(user, { status: 'active' })}
                                    className="btn btn-outline btn-sm"
                                  >
                                    <RotateCcw size={13} />
                                    启用
                                  </button>
                                ))}
                              {canAssignRoles && (
                                <button
                                  onClick={() => setAssignFor(user)}
                                  className="btn btn-outline btn-sm"
                                >
                                  <UserCog size={13} />
                                  分配角色
                                </button>
                              )}
                              {canResetPassword && (
                                <button
                                  onClick={() => setResetFor(user)}
                                  className="btn btn-outline btn-sm"
                                >
                                  <KeyRound size={13} />
                                  重置密码
                                </button>
                              )}
                              {canRemoveUser && (
                                <button
                                  onClick={() => deleteUser(user)}
                                  className="btn btn-danger btn-sm"
                                >
                                  <Trash2 size={13} />
                                  删除
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/70">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </WorkbenchTableShell>
          <WorkbenchPaginationFooter
            currentPage={Math.min(usersPage, usersTotalPages)}
            totalPages={usersTotalPages}
            totalItems={users.length}
            pageSize={usersPageSize}
            pageSizeOptions={ACCOUNT_PAGE_SIZE_OPTIONS}
            onPageSizeChange={(nextPageSize) => {
              setUsersPageSize(nextPageSize);
              setUsersPage(1);
            }}
            onPageChange={setUsersPage}
            onPrevious={
              loading || usersPage <= 1
                ? undefined
                : () => setUsersPage((current) => Math.max(current - 1, 1))
            }
            onNext={
              loading || usersPage >= usersTotalPages
                ? undefined
                : () => setUsersPage((current) => Math.min(current + 1, usersTotalPages))
            }
          />
        </section>
      ) : tab === 'roles' ? (
        <section className="grid gap-3.5">
          <div className="g3 gap-3">
            <Metric label="角色" value={String(roles.length)} hint="动态配置" />
            <Metric label="权限点" value={String(permissions.length)} hint="页面与操作" />
            <Metric label="当前权限" value={String(mePermissions.length)} hint="多角色叠加" />
          </div>

          <WorkbenchTableShell>
            <table className="table">
              <thead>
                <tr>
                  <th>角色</th>
                  <th>状态</th>
                  <th>权限数量</th>
                  <th>账号数量</th>
                  <th>说明</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6}>
                      <WorkbenchTableState type="loading" title="正在加载角色" />
                    </td>
                  </tr>
                ) : roles.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <WorkbenchTableState
                        type="empty"
                        title="暂无角色"
                        description="先创建一个角色，再分配页面和操作权限。"
                      />
                    </td>
                  </tr>
                ) : (
                  paginatedRoles.map((role) => {
                    const canConfigureRole = canUpdateRole || canAssignPermissions;
                    const hasRoleActions = canConfigureRole || canUpdateRole;

                    return (
                      <tr key={role.id}>
                        <td>
                          <div className="grid gap-[3px]">
                            <strong className="text-foreground">
                              {displayRoleName(role)}
                            </strong>
                            <span className="text-xs text-muted-foreground/80">
                              {role.isSystem ? '内置角色' : '自定义角色'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <StatusPill tone={role.status === 'active' ? 'success' : 'neutral'}>
                            {role.status === 'active' ? '启用' : '停用'}
                          </StatusPill>
                        </td>
                        <td className={tdClass}>{role.permissions.length}</td>
                        <td className={tdClass}>{role.userCount ?? 0}</td>
                        <td className={`${tdClass} max-w-[360px] text-muted-foreground`}>
                          {displayRoleDescription(role)}
                        </td>
                        <td>
                          {hasRoleActions ? (
                            <div className="table-row-actions">
                              {canConfigureRole && (
                                <button
                                  onClick={() => setEditRoleFor(role)}
                                  className="btn btn-outline btn-sm"
                                >
                                  <SlidersHorizontal size={13} />
                                  配置权限
                                </button>
                              )}
                              {canUpdateRole && (
                                <button
                                  onClick={() =>
                                    updateRoleStatus(
                                      role,
                                      role.status === 'active' ? 'inactive' : 'active',
                                      setErr,
                                      flash,
                                      refreshAll
                                    )
                                  }
                                  className="btn btn-outline btn-sm"
                                >
                                  {role.status === 'active' ? (
                                    <Ban size={13} />
                                  ) : (
                                    <RotateCcw size={13} />
                                  )}
                                  {role.status === 'active' ? '停用' : '启用'}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/70">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </WorkbenchTableShell>
          <WorkbenchPaginationFooter
            currentPage={Math.min(rolesPage, rolesTotalPages)}
            totalPages={rolesTotalPages}
            totalItems={roles.length}
            pageSize={rolesPageSize}
            pageSizeOptions={ACCOUNT_PAGE_SIZE_OPTIONS}
            onPageSizeChange={(nextPageSize) => {
              setRolesPageSize(nextPageSize);
              setRolesPage(1);
            }}
            onPageChange={setRolesPage}
            onPrevious={
              loading || rolesPage <= 1
                ? undefined
                : () => setRolesPage((current) => Math.max(current - 1, 1))
            }
            onNext={
              loading || rolesPage >= rolesTotalPages
                ? undefined
                : () => setRolesPage((current) => Math.min(current + 1, rolesTotalPages))
            }
          />
        </section>
      ) : (
        <section className="grid gap-3.5">
          <WorkbenchFilterToolbar className="accounts-filter-toolbar">
            <select
              value={auditModule}
              onChange={(event) => {
                setAuditModule(event.target.value);
                setAuditPage(1);
              }}
              className="select accounts-filter-toolbar__select"
            >
              <option value="">全部模块</option>
              {AUDIT_MODULE_FILTER_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={auditAction}
              onChange={(event) => {
                setAuditAction(event.target.value);
                setAuditPage(1);
              }}
              className="select accounts-filter-toolbar__select"
            >
              <option value="">全部动作</option>
              {AUDIT_ACTION_FILTER_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={auditStatus}
              onChange={(event) => {
                setAuditStatus(event.target.value);
                setAuditPage(1);
              }}
              className="select accounts-filter-toolbar__select"
            >
              <option value="">全部结果</option>
              <option value="success">成功</option>
              <option value="failed">失败</option>
            </select>
            <div className="relative min-w-[220px] flex-[1_1_320px]">
              <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground/70" />
              <input
                value={auditSearch}
                onChange={(event) => setAuditSearch(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && reloadAuditFromFirstPage()}
                placeholder="搜索动作 / 对象 / 操作人"
                className="input w-full pl-[34px]"
              />
            </div>
            <button onClick={reloadAuditFromFirstPage} className="btn btn-outline btn-sm">
              <Search size={14} />
              查询
            </button>
            <span className="workbench-filter-toolbar__meta">共 {auditTotal} 条日志</span>
          </WorkbenchFilterToolbar>

          <WorkbenchTableShell>
            <table className="table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>模块</th>
                  <th>动作</th>
                  <th>操作说明</th>
                  <th>操作人</th>
                  <th>结果</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                {loading || auditLoading ? (
                  <tr>
                    <td colSpan={7}>
                      <WorkbenchTableState type="loading" title="正在加载操作日志" />
                    </td>
                  </tr>
                ) : auditRows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <WorkbenchTableState
                        type="empty"
                        title="暂无操作日志"
                        description="产品、资讯、图片、发布、账号权限等写操作会自动进入这里。"
                      />
                    </td>
                  </tr>
                ) : (
                  auditRows.map((row) => {
                    const resource = displayAuditResource(row);
                    return (
                      <tr key={row.id}>
                        <td className={`${tdClass} whitespace-nowrap text-muted-foreground`}>
                          {new Date(row.createdAt).toLocaleString('zh-CN')}
                        </td>
                        <td>
                          <span className="pill-neutral">
                            {displayAuditModule(row.resourceType)}
                          </span>
                        </td>
                        <td className={tdClass}>{displayAuditAction(row.action)}</td>
                        <td className={`${tdClass} max-w-[260px]`}>
                          <div className="grid gap-0.5">
                            <strong title={resource.primary} className="truncate text-foreground">
                              {resource.primary}
                            </strong>
                            <span title={resource.secondary} className="truncate text-xs text-muted-foreground/80">
                              {resource.secondary}
                            </span>
                          </div>
                        </td>
                        <td className={tdClass}>{row.actorName || row.actorUserId || '系统'}</td>
                        <td>
                          <StatusPill tone={row.status === 'failed' ? 'danger' : 'success'}>
                            {row.status === 'failed' ? '失败' : '成功'}
                          </StatusPill>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setAuditDetail(row)}
                          >
                            <ClipboardList size={13} />
                            查看
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </WorkbenchTableShell>
          <WorkbenchPaginationFooter
            currentPage={Math.min(auditPage, auditTotalPages)}
            totalPages={auditTotalPages}
            totalItems={auditTotal}
            pageSize={auditPageSize}
            pageSizeOptions={AUDIT_PAGE_SIZE_OPTIONS}
            onPageSizeChange={(nextPageSize) => {
              setAuditPageSize(nextPageSize);
              setAuditPage(1);
            }}
            onPageChange={setAuditPage}
            onPrevious={
              loading || auditLoading || auditPage <= 1
                ? undefined
                : () => setAuditPage((current) => Math.max(current - 1, 1))
            }
            onNext={
              loading || auditLoading || auditPage >= auditTotalPages
                ? undefined
                : () => setAuditPage((current) => Math.min(current + 1, auditTotalPages))
            }
          />
        </section>
      )}

      {showCreateUser && (
        <CreateUserModal
          roles={activeRoles}
          onClose={() => setShowCreateUser(false)}
          onDone={() => {
            setShowCreateUser(false);
            flash('账号已创建');
            refreshAll();
          }}
          onError={setErr}
        />
      )}
      {showCreateRole && (
        <CreateRoleModal
          permissions={permissions}
          onClose={() => setShowCreateRole(false)}
          onDone={() => {
            setShowCreateRole(false);
            flash('角色已创建');
            refreshAll();
          }}
          onError={setErr}
        />
      )}
      {assignFor && (
        <AssignRolesModal
          user={assignFor}
          roles={activeRoles}
          onClose={() => setAssignFor(null)}
          onDone={() => {
            setAssignFor(null);
            flash('用户角色已更新');
            refreshAll();
          }}
          onError={setErr}
        />
      )}
      {editRoleFor && (
        <RolePermissionsModal
          role={editRoleFor}
          permissions={permissions}
          canEditRole={canUpdateRole}
          canAssignPermissions={canAssignPermissions}
          onClose={() => setEditRoleFor(null)}
          onDone={() => {
            setEditRoleFor(null);
            flash('角色权限已更新');
            refreshAll();
          }}
          onError={setErr}
        />
      )}
      {resetFor && (
        <ResetModal
          user={resetFor}
          onClose={() => setResetFor(null)}
          onDone={() => {
            setResetFor(null);
            flash('密码已重置');
          }}
          onError={setErr}
        />
      )}
      {auditDetail && <AuditDetailModal log={auditDetail} onClose={() => setAuditDetail(null)} />}
    </div>
  );
}

async function updateRoleStatus(
  role: RoleItem,
  status: 'active' | 'inactive',
  onError: (message: string) => void,
  flash: (message: string) => void,
  refresh: () => Promise<void>
) {
  onError('');
  try {
    await adminRbac.updateRole(role.id, { status });
    flash(`角色已${status === 'active' ? '启用' : '停用'}：${displayRoleName(role)}`);
    await refresh();
  } catch (error) {
    onError((error as Error).message || '角色状态更新失败');
  }
}
