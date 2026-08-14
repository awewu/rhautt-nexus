'use client';
// accounts 弹窗簇 + 局部 UI 原语（2026-08 巨页拆分）

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Check, KeyRound, Plus, Save } from 'lucide-react';
import { adminRbac, adminUsers } from '../../lib/api';
import { AdminUser, PermissionItem, RoleItem, EffectiveRole, AuditLogRow, PHONE_PATTERN, ROLE_CODE_PATTERN, displayRoleName, displayRoleDescription, displayPermissionName, displayPermissionDomain, displayPermissionAction, displayAuditModule, displayAuditAction, displayAuditResource, normalizeRoleCode } from './helpers';

export function CreateUserModal({
  roles,
  onClose,
  onDone,
  onError,
}: {
  roles: RoleItem[];
  onClose: () => void;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState(roles[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const selectedRole = roles.find((role) => role.id === roleId);

  async function submit() {
    if (!PHONE_PATTERN.test(phone)) {
      onError('请输入正确的手机号');
      return;
    }
    if (!name.trim()) {
      onError('姓名必填');
      return;
    }
    if (!selectedRole) {
      onError('请选择角色');
      return;
    }
    if (password.length < 8) {
      onError('初始密码至少 8 位');
      return;
    }
    setBusy(true);
    onError('');
    try {
      const created = await adminUsers.create({
        identifier: phone,
        phone,
        name,
        password,
        role: selectedRole.code,
      });
      const userId = created?.user?.id;
      if (userId)
        await adminUsers.setRoles(userId, {
          roleIds: [selectedRole.id],
          primaryRoleId: selectedRole.id,
        });
      onDone();
    } catch (error) {
      onError((error as Error).message || '创建失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <ModalTitle title="新建账号" subtitle="创建后会绑定所选主角色，后续可继续叠加角色。" />
      <Field label="手机号">
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value.trim())}
          placeholder="请输入手机号"
          className="input"
          autoFocus
        />
      </Field>
      <Field label="姓名">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="显示名称"
          className="input"
        />
      </Field>
      <Field label="主角色">
        <select
          value={roleId}
          onChange={(event) => setRoleId(event.target.value)}
          className="select"
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {displayRoleName(role)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="初始密码">
        <input
          type="text"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="至少 8 位"
          className="input"
        />
      </Field>
      <ModalActions onClose={onClose}>
        <button onClick={submit} disabled={busy} className="btn btn-brand btn-sm">
          <Plus size={14} />
          {busy ? '创建中...' : '创建'}
        </button>
      </ModalActions>
    </Overlay>
  );
}

export function CreateRoleModal({
  permissions,
  onClose,
  onDone,
  onError,
}: {
  permissions: PermissionItem[];
  onClose: () => void;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) {
      onError('角色名称必填');
      return;
    }
    const normalizedCode = normalizeRoleCode(code) || `custom_role_${Date.now().toString(36)}`;
    if (!ROLE_CODE_PATTERN.test(normalizedCode)) {
      onError('角色编码只能使用英文小写、数字、下划线、冒号或中横线');
      return;
    }
    setBusy(true);
    onError('');
    try {
      await adminRbac.createRole({
        code: normalizedCode,
        name,
        description,
        permissions: selected,
      });
      onDone();
    } catch (error) {
      onError((error as Error).message || '角色创建失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose} wide>
      <ModalTitle
        title="新建角色"
        subtitle="角色编码保存后作为权限判断稳定 key，建议使用英文小写。"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="角色编码">
          <input
            value={code}
            onChange={(event) => setCode(normalizeRoleCode(event.target.value))}
            placeholder="marketing_operator"
            className="input"
            autoFocus
          />
        </Field>
        <Field label="角色名称">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="营销运营"
            className="input"
          />
        </Field>
      </div>
      <div className="-mt-1 text-xs text-muted-foreground/80">
        角色名称可以是中文；角色编码只能使用英文小写、数字、下划线、冒号或中横线。
      </div>
      <Field label="说明">
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="角色职责说明"
          className="input"
          rows={3}
        />
      </Field>
      <PermissionPicker permissions={permissions} selected={selected} onChange={setSelected} />
      <ModalActions onClose={onClose}>
        <button onClick={submit} disabled={busy} className="btn btn-brand btn-sm">
          <Plus size={14} />
          {busy ? '创建中...' : '创建角色'}
        </button>
      </ModalActions>
    </Overlay>
  );
}

export function AssignRolesModal({
  user,
  roles,
  onClose,
  onDone,
  onError,
}: {
  user: AdminUser;
  roles: RoleItem[];
  onClose: () => void;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [primary, setPrimary] = useState('');
  const [effectiveRoles, setEffectiveRoles] = useState<EffectiveRole[]>([]);
  const [effectivePermissions, setEffectivePermissions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [scopeType, setScopeType] = useState<'group' | 'business_unit'>('group');
  const [scopeDim, setScopeDim] = useState<'brand' | 'category'>('brand');
  const [scopeRef, setScopeRef] = useState('');
  const [bu, setBu] = useState<{
    brands: Array<{ code: string; name: string }>;
    categories: Array<{ id: string; name: string; brandCode: string }>;
  }>({ brands: [], categories: [] });

  useEffect(() => {
    let cancelled = false;
    adminRbac
      .businessUnits()
      .then((res) => {
        if (!cancelled) setBu({ brands: res.brands || [], categories: res.categories || [] });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    adminUsers
      .effectivePermissions(user.id)
      .then((res) => {
        if (cancelled) return;
        const currentRoles: EffectiveRole[] = res.roles || [];
        setEffectiveRoles(currentRoles);
        setEffectivePermissions(res.permissions || []);
        setSelected(currentRoles.map((role) => role.id));
        setPrimary(currentRoles.find((role) => role.isPrimary)?.id || currentRoles[0]?.id || '');
      })
      .catch((error) => onError((error as Error).message || '加载用户权限失败'));
    return () => {
      cancelled = true;
    };
  }, [onError, user.id]);

  function toggle(roleId: string) {
    setSelected((current) => {
      const next = current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [...current, roleId];
      if (!next.includes(primary)) setPrimary(next[0] || '');
      return next;
    });
  }

  async function submit() {
    if (!selected.length) {
      onError('至少选择一个角色');
      return;
    }
    if (scopeType === 'business_unit' && !scopeRef) {
      onError('事业部范围需选择具体品牌/品类');
      return;
    }
    setBusy(true);
    onError('');
    try {
      const scope =
        scopeType === 'group'
          ? { scopeType: 'group' as const }
          : { scopeType: 'business_unit' as const, scopeDimension: scopeDim, scopeRef };
      await adminUsers.setRoles(user.id, {
        roleIds: selected,
        primaryRoleId: primary || selected[0],
        scope,
      });
      onDone();
    } catch (error) {
      onError((error as Error).message || '角色分配失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose} wide>
      <ModalTitle
        title="分配用户角色"
        subtitle={`${user.name} 当前拥有 ${effectiveRoles.length} 个角色，合并 ${effectivePermissions.length} 个权限点。`}
      />
      <div className="grid max-h-[360px] gap-2 overflow-auto pr-1">
        {roles.map((role) => {
          const checked = selected.includes(role.id);
          return (
            <label key={role.id} className={`surface-interactive ${choiceClass(checked)}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(role.id)} />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <strong className="text-foreground">{displayRoleName(role)}</strong>
                <span className="text-xs text-muted-foreground/80">
                  {role.permissions.length} 个权限点
                </span>
              </span>
              <button
                type="button"
                disabled={!checked}
                onClick={(event) => {
                  event.preventDefault();
                  setPrimary(role.id);
                }}
                className={primary === role.id ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'}
              >
                <Check size={13} />
                主角色
              </button>
            </label>
          );
        })}
      </div>
      <div className="mt-3 grid gap-2 border-t pt-3">
        <strong className="text-[13px] text-foreground">授权范围（scope）</strong>
        <div className="flex gap-4">
          <label className="flex items-center gap-1 text-[13px]">
            <input
              type="radio"
              checked={scopeType === 'group'}
              onChange={() => setScopeType('group')}
            />{' '}
            集团
          </label>
          <label className="flex items-center gap-1 text-[13px]">
            <input
              type="radio"
              checked={scopeType === 'business_unit'}
              onChange={() => setScopeType('business_unit')}
            />{' '}
            事业部
          </label>
        </div>
        {scopeType === 'business_unit' && (
          <div className="flex gap-2">
            <select
              value={scopeDim}
              onChange={(e) => {
                setScopeDim(e.target.value as 'brand' | 'category');
                setScopeRef('');
              }}
            >
              <option value="brand">品牌事业部</option>
              <option value="category">品类事业部</option>
            </select>
            <select
              value={scopeRef}
              onChange={(e) => setScopeRef(e.target.value)}
              className="flex-1"
            >
              <option value="">请选择…</option>
              {scopeDim === 'brand'
                ? bu.brands.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))
                : bu.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.brandCode} · {c.name}
                    </option>
                  ))}
            </select>
          </div>
        )}
      </div>
      <ModalActions onClose={onClose}>
        <button onClick={submit} disabled={busy} className="btn btn-brand btn-sm">
          <Save size={14} />
          {busy ? '保存中...' : '保存分配'}
        </button>
      </ModalActions>
    </Overlay>
  );
}

export function RolePermissionsModal({
  role,
  permissions,
  canEditRole,
  canAssignPermissions,
  onClose,
  onDone,
  onError,
}: {
  role: RoleItem;
  permissions: PermissionItem[];
  canEditRole: boolean;
  canAssignPermissions: boolean;
  onClose: () => void;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(displayRoleName(role));
  const [description, setDescription] = useState(
    displayRoleDescription(role) === '-' ? '' : displayRoleDescription(role)
  );
  const [selected, setSelected] = useState<string[]>(role.permissions);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    onError('');
    try {
      if (canEditRole) await adminRbac.updateRole(role.id, { name, description });
      if (canAssignPermissions) await adminRbac.setRolePermissions(role.id, selected);
      onDone();
    } catch (error) {
      onError((error as Error).message || '角色权限保存失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose} wide>
      <ModalTitle
        title="配置角色权限"
        subtitle={`${displayRoleName(role)} · 当前 ${selected.length} 个权限点`}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="角色名称">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={!canEditRole}
            className="input"
          />
        </Field>
        <Field label="状态">
          <input value={role.status === 'active' ? '启用' : '停用'} disabled className="input" />
        </Field>
      </div>
      <Field label="说明">
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={!canEditRole}
          className="input"
          rows={3}
        />
      </Field>
      <PermissionPicker
        permissions={permissions}
        selected={selected}
        onChange={setSelected}
        disabled={!canAssignPermissions}
      />
      <ModalActions onClose={onClose}>
        <button
          onClick={submit}
          disabled={busy || (!canEditRole && !canAssignPermissions)}
          className="btn btn-brand btn-sm"
        >
          <Save size={14} />
          {busy ? '保存中...' : '保存'}
        </button>
      </ModalActions>
    </Overlay>
  );
}

export function PermissionPicker({
  permissions,
  selected,
  onChange,
  disabled = false,
}: {
  permissions: PermissionItem[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const groups = useMemo(() => {
    const byDomain = new Map<string, PermissionItem[]>();
    for (const permission of permissions) {
      const list = byDomain.get(permission.domain) || [];
      list.push(permission);
      byDomain.set(permission.domain, list);
    }
    return [...byDomain.entries()];
  }, [permissions]);

  function toggle(code: string) {
    if (disabled) return;
    onChange(
      selected.includes(code) ? selected.filter((item) => item !== code) : [...selected, code]
    );
  }

  return (
    <div className="grid gap-2.5">
      <div
        className="flex items-center justify-between gap-3"
      >
        <label className="text-[12.5px] font-bold text-muted-foreground">
          权限点
        </label>
        <span className="badge badge-info">
          {selected.length} / {permissions.length}
        </span>
      </div>
      <div className="grid max-h-[420px] gap-2.5 overflow-auto pr-1">
        {groups.map(([domain, items]) => (
          <div key={domain} className="card-elevated p-3 shadow-xs">
            <div className="mb-2 text-xs text-muted-foreground">
              {displayPermissionDomain(domain)}
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2">
              {items.map((permission) => {
                const checked = selected.includes(permission.code);
                return (
                  <label
                    key={permission.code}
                    className={`surface-interactive ${choiceClass(checked, disabled)}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(permission.code)}
                    />
                    <span className="grid min-w-0 gap-0.5">
                      <strong className="text-foreground">
                        {displayPermissionName(permission)}
                      </strong>
                      <span className="text-xs text-muted-foreground/80">
                        {displayPermissionAction(permission.action)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResetModal({
  user,
  onClose,
  onDone,
  onError,
}: {
  user: AdminUser;
  onClose: () => void;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (pwd.length < 8) {
      onError('新密码至少 8 位');
      return;
    }
    setBusy(true);
    onError('');
    try {
      await adminUsers.resetPassword(user.id, pwd);
      onDone();
    } catch (error) {
      onError((error as Error).message || '重置失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <ModalTitle title="重置密码" subtitle={`为「${user.name}」设置新密码。`} />
      <Field label="新密码">
        <input
          type="text"
          value={pwd}
          onChange={(event) => setPwd(event.target.value)}
          placeholder="至少 8 位"
          className="input"
          autoFocus
        />
      </Field>
      <ModalActions onClose={onClose}>
        <button onClick={submit} disabled={busy} className="btn btn-brand btn-sm">
          <KeyRound size={14} />
          {busy ? '重置中...' : '确认重置'}
        </button>
      </ModalActions>
    </Overlay>
  );
}

export function AuditDetailModal({ log, onClose }: { log: AuditLogRow; onClose: () => void }) {
  const resource = displayAuditResource(log);
  return (
    <Overlay onClose={onClose} wide>
      <ModalTitle
        title="操作日志详情"
        subtitle={`${displayAuditModule(log.resourceType)} · ${displayAuditAction(log.action)}`}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="操作时间">
          <input
            value={new Date(log.createdAt).toLocaleString('zh-CN')}
            disabled
            className="input"
          />
        </Field>
        <Field label="操作人">
          <input value={log.actorName || log.actorUserId || '系统'} disabled className="input" />
        </Field>
        <Field label="对象类型">
          <input value={displayAuditModule(log.resourceType)} disabled className="input" />
        </Field>
        <Field label="操作说明">
          <input value={resource.primary} disabled className="input" />
        </Field>
        <Field label="动作">
          <input value={displayAuditAction(log.action)} disabled className="input" />
        </Field>
        <Field label="结果">
          <input value={log.status === 'failed' ? '失败' : '成功'} disabled className="input" />
        </Field>
      </div>
      {resource.secondary ? (
        <Field label="补充信息">
          <input value={resource.secondary} disabled className="input" />
        </Field>
      ) : null}
      {log.resourceId && resource.primary !== log.resourceId ? (
        <Field label="对象 ID">
          <input value={log.resourceId} disabled className="input" />
        </Field>
      ) : null}
      <Field label="操作前 / 请求上下文">
        <pre className={auditJsonClass}>{stringifyAuditState(log.beforeState)}</pre>
      </Field>
      <Field label="操作后 / 执行结果">
        <pre className={auditJsonClass}>{stringifyAuditState(log.afterState)}</pre>
      </Field>
      <ModalActions onClose={onClose} />
    </Overlay>
  );
}

export function stringifyAuditState(value: unknown) {
  if (!value || typeof value !== 'object') return '{}';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? 'btn btn-brand btn-sm' : 'btn btn-ghost btn-sm'}
    >
      {icon}
      {children}
    </button>
  );
}

export function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card-elevated p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-[28px] leading-none font-extrabold tabular-nums">{value}</div>
      <div className="mt-1.5 text-xs text-muted-foreground/80">{hint}</div>
    </div>
  );
}

export function Overlay({
  children,
  onClose,
  wide = false,
}: {
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-5"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={`card-elevated max-h-[min(92vh,820px)] overflow-auto p-6 shadow-2xl ${
          wide ? 'w-[min(100%,860px)]' : 'w-[min(100%,420px)]'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="m-0 text-[17px] font-extrabold">{title}</h3>
      {subtitle ? <p className="mt-1 mb-0 text-[13px] text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

export function ModalActions({ children, onClose }: { children?: ReactNode; onClose: () => void }) {
  return (
    <div className="mt-4.5 flex justify-end gap-2.5">
      <button onClick={onClose} className="btn btn-ghost btn-sm">
        取消
      </button>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-[12.5px] font-bold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function Banner({ children, tone }: { children: ReactNode; tone: 'success' | 'error' }) {
  return (
    <div
      className={`${tone === 'success' ? 'badge badge-success' : 'badge badge-danger'} justify-start px-3.5 py-2.5 break-words whitespace-normal`}
    >
      {children}
    </div>
  );
}

export function Center({ children }: { children: ReactNode }) {
  return (
    <div className="page-container flex min-h-[60vh] items-center justify-center">{children}</div>
  );
}

/** 选择项样式（原 choiceStyle 内联对象 → Tailwind 类） */
export function choiceClass(checked: boolean, disabled = false): string {
  return [
    'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors duration-150',
    checked ? 'border-primary bg-primary/5' : 'border-border bg-background',
    disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
  ].join(' ');
}

export const tdClass = 'px-4 py-[11px] align-middle';
export const auditJsonClass =
  'm-0 max-h-64 overflow-auto rounded-lg border bg-secondary p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground';
