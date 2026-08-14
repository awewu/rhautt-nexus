'use client';

/**
 * 登录页（2026-08 全页 UX 重构 · Tailwind 化）。
 * 结构不变：左品牌栏（Mission/Vision/支柱）+ 右登录表单（两道门）；
 * 61 处内联样式收敛为 Tailwind 类，移动端隐藏左栏由 <style> 标签改为 max-md:hidden。
 */

import { useEffect, useState } from 'react';
import { BrainCircuit, Briefcase, Droplet, Leaf, UserRound, Wind } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { auth } from '../lib/api';
import { setToken } from '@rhautt/shared-auth';

const HUB_BRAND = process.env.NEXT_PUBLIC_TENANT_BRAND || 'Rhautt Comfort';
const PLATFORM_TAG = process.env.NEXT_PUBLIC_PLATFORM_TAG || 'Powered by Rysnova AI';

// 品牌价值支柱（呼应「水与空气 · 低碳可持续」使命愿景）— 用 lucide 图标（DESIGN.md：禁 emoji）
const PILLARS: { Icon: LucideIcon; label: string; desc: string }[] = [
  { Icon: Droplet, label: '水', desc: '净水 · 中央热水' },
  { Icon: Wind, label: '空气', desc: '空调 · 新风 · 采暖' },
  { Icon: Leaf, label: '低碳', desc: '高效节能技术' },
  { Icon: BrainCircuit, label: '数字化', desc: 'AI 问诊 → 设计 → 交付' },
];

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  // SSO 错误提示在客户端挂载后读取（避免在 useState 初始化里读 window 造成 SSR/水合不一致）。
  const [error, setError] = useState('');
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ssoError');
    if (!code) return;
    const messages: Record<string, string> = {
      missing_session: '登录状态已失效，请重新登录。',
      sso_unavailable: '单点登录暂不可用，请联系支持或使用账号密码登录。',
      sso_callback_failed: '单点登录未完成，请重试或联系支持。',
      unauthorized: '当前账号尚未获得 Nexus 访问授权，请联系管理员。',
    };
    setError(messages[code] || '单点登录未完成，请联系支持。');
  }, []);
  const [loading, setLoading] = useState(false);
  // 两道门：choose 选择入口 · staff 员工(牛马搭子SSO/内部账号) · customer 客户(手机验证码)
  const [mode, setMode] = useState<'choose' | 'staff' | 'customer'>('choose');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [smsSent, setSmsSent] = useState(false);

  async function handleSendSms() {
    setError('');
    try {
      await auth.sendSms(phone);
      setSmsSent(true);
    } catch (err: unknown) {
      setError((err as Error).message || '验证码发送失败');
    }
  }

  async function handleCustomerLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await auth.loginSms(phone, smsCode);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      setToken(res.token);
      window.location.href = '/cockpit';
    } catch (err: unknown) {
      setError((err as Error).message || '登录失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await auth.login(phone, password);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      setToken(res.token);
      await fetch('/api/session/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: res.token }),
      }).catch(() => {});
      // returnUrl 在提交时从 URL 读取，避免 useSearchParams 需 Suspense 边界导致的客户端水合中断。
      const returnUrl =
        (typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('returnUrl')
          : null) || '/cockpit';
      window.location.href = decodeURIComponent(returnUrl);
    } catch (err: unknown) {
      setError((err as Error).message || '登录失败');
    } finally {
      setLoading(false);
    }
  }

  function handleSsoLogin() {
    window.location.href = '/api/v2/auth/sso/login?redirect=/cockpit';
  }

  // Local development shortcut: use the seeded admin account so protected pages can load real API data.
  async function handleDevGuest() {
    setLoading(true);
    setError('');
    try {
      const res = await auth.login('admin@rhautt.local', 'Test1234!');
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      setToken(res.token);
      await fetch('/api/session/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: res.token }),
      }).catch(() => {});
      const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') || '/cockpit';
      window.location.href = decodeURIComponent(returnUrl);
    } catch (err: unknown) {
      setError((err as Error).message || '开发直进失败');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── 左栏：品牌可持续底板（Mission / Vision · 水与空气 · 低碳）──── */}
      <div className="login-brand-panel relative flex shrink-0 basis-[48%] flex-col overflow-hidden p-12 text-white max-md:hidden">
        {/* DESIGN.md：禁渐变主色块 / 禁装饰过度 —— 纯深色底 + 一条品牌红顶栏点缀 */}
        <div className="absolute top-0 right-0 left-0 h-[3px] bg-primary" />

        {/* Logo：Rhautt 红字标 + 生态徽章 */}
        <div className="relative z-1 mb-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[22px] font-extrabold tracking-tight">
              <span className="text-primary">Rh</span>
              <span className="text-white">autt.</span>
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-2 py-[3px] text-[10px] font-semibold text-white/70">
              {PLATFORM_TAG}
            </span>
          </div>
          <span className="flex h-[46px] w-[46px] flex-col items-center justify-center rounded-full border border-white/40 text-center text-[7.5px] leading-tight font-bold tracking-wide text-white/75">
            EARTH
            <br />
            COMFORT
          </span>
        </div>

        {/* MISSION */}
        <div className="relative z-1 mb-8">
          <div className="mb-2.5 flex items-center gap-2.5">
            <span className="text-[15px] font-extrabold tracking-widest text-primary">MISSION</span>
            <span className="text-[15px] font-bold text-white">我们的使命</span>
          </div>
          <p className="m-0 text-[15px] leading-relaxed text-white/80">
            以创新高效低碳技术与数字化服务为核心，
            <br />
            为每一个空间赋予更舒适、高效、可持续的生活环境。
          </p>
        </div>

        {/* VISION */}
        <div className="relative z-1 mb-9">
          <div className="mb-2.5 flex items-center gap-2.5">
            <span className="text-[15px] font-extrabold tracking-widest text-primary">VISION</span>
            <span className="text-[15px] font-bold text-white">我们的愿景</span>
          </div>
          <p className="m-0 text-[15px] leading-relaxed text-white/80">
            成为受人尊重的水和空气产品及解决方案、
            <br />
            可持续发展的引领者。
          </p>
        </div>

        {/* 价值支柱 */}
        <div className="relative z-1 grid max-w-[420px] grid-cols-2 gap-3">
          {PILLARS.map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-3 rounded-[10px] border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-[2px]"
            >
              <f.Icon size={18} strokeWidth={1.75} className="shrink-0 text-white/85" />
              <div>
                <div className="text-[13px] font-bold text-white">{f.label}</div>
                <div className="text-[11px] text-white/50">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 底部水印 */}
        <div className="relative z-1 mt-auto pt-8">
          <div className="text-[11px] tracking-wide text-white/30">
            © 2026 瑞合瑞德暖通科技集团 · {HUB_BRAND} · 一次登录，按角色进入所有应用
          </div>
        </div>
      </div>

      {/* ── 右栏：登录表单 ──────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center bg-secondary/60 px-10 py-12">
        <div className="animate-fade-in w-full max-w-[380px]">
          <div className="mb-7">
            <h2 className="mb-1.5 text-2xl font-bold tracking-tight">
              {mode === 'customer' ? '客户入口' : mode === 'staff' ? '员工入口' : '选择入口'}
            </h2>
            <p className="text-sm text-muted-foreground">AI GTM Nexus · 瑞合数智枢纽营销中枢</p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-md border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive"
            >
              {error}
            </div>
          )}

          {/* 两道门：员工 / 客户 */}
          {mode === 'choose' && (
            <div className="flex flex-col gap-3.5">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode('staff');
                }}
                className="btn login-gate-staff w-full justify-start gap-3.5 rounded-xl p-4.5 text-left"
              >
                <Briefcase size={22} strokeWidth={1.75} className="shrink-0" />
                <span className="flex flex-col">
                  <span className="text-base font-bold">员工入口</span>
                  <span className="text-xs opacity-70">从 Tandem 账户单点登录</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSmsSent(false);
                  setMode('customer');
                }}
                className="btn btn-outline w-full justify-start gap-3.5 rounded-xl p-4.5 text-left"
              >
                <UserRound size={22} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                <span className="flex flex-col">
                  <span className="text-base font-bold">客户入口</span>
                  <span className="text-xs text-muted-foreground">手机号验证码登录</span>
                </span>
              </button>
              {process.env.NODE_ENV !== 'production' && (
                <button
                  type="button"
                  onClick={handleDevGuest}
                  className="btn btn-outline w-full justify-center gap-2 rounded-xl border-dashed p-3 text-[13px] text-muted-foreground"
                >
                  开发直进（自动登录 · 进入驾驶舱）
                </button>
              )}
            </div>
          )}

          {/* 员工入口：Tandem SSO 直通（+ 内部账号密码备用） */}
          {mode === 'staff' && (
            <div className="flex flex-col gap-3.5">
              <button
                type="button"
                onClick={handleSsoLogin}
                className="btn login-gate-staff w-full justify-center rounded-xl p-[13px] text-[15px]"
              >
                从 Tandem 单点登录
              </button>
              <p className="m-0 text-center text-xs text-muted-foreground">
                已登录 Tandem？一键进入，无需重新登录。
              </p>

              {!showStaffPassword ? (
                <button
                  type="button"
                  onClick={() => setShowStaffPassword(true)}
                  className="cursor-pointer border-0 bg-transparent text-xs text-muted-foreground underline"
                >
                  内部账号密码登录（备用）
                </button>
              ) : (
                <form onSubmit={handleLogin} className="mt-1.5 flex flex-col gap-3.5">
                  <input
                    className="input px-3.5 py-[11px] text-[15px]"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="邮箱 / 手机号"
                    type="text"
                    required
                    autoFocus
                  />
                  <input
                    className="input px-3.5 py-[11px] text-[15px]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    type="password"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-brand w-full justify-center rounded-xl p-[13px] text-[15px]"
                  >
                    {loading ? '登录中…' : '登录'}
                  </button>
                </form>
              )}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode('choose');
                }}
                className="cursor-pointer border-0 bg-transparent text-[13px] text-muted-foreground"
              >
                ← 返回选择入口
              </button>
            </div>
          )}

          {/* 客户入口：手机验证码 */}
          {mode === 'customer' && (
            <form onSubmit={handleCustomerLogin} className="flex flex-col gap-3.5">
              <input
                className="input px-3.5 py-[11px] text-[15px]"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="手机号"
                type="tel"
                required
                autoFocus
              />
              <div className="flex gap-2.5">
                <input
                  className="input flex-1 px-3.5 py-[11px] text-[15px]"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value)}
                  placeholder="验证码"
                  type="text"
                  required
                />
                <button
                  type="button"
                  onClick={handleSendSms}
                  disabled={!phone}
                  className="btn btn-outline px-3.5 py-[11px] whitespace-nowrap"
                >
                  {smsSent ? '重新发送' : '获取验证码'}
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-brand w-full justify-center rounded-xl p-[13px] text-[15px]"
              >
                {loading ? '登录中…' : '登录'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode('choose');
                }}
                className="cursor-pointer border-0 bg-transparent text-[13px] text-muted-foreground"
              >
                ← 返回选择入口
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
