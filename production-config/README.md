# Production Config

## Rhautt Nexus SSO OIDC

Production SSO values are documented in
`docs/dev/rhautt-nexus-sso-oidc-config.md`.

Use `https://gtm.rhautt.com/api/v2/auth/sso/callback` as the OIDC callback
URL. `/cockpit` is the Nexus business landing page after login succeeds.

For first launch, run `node scripts/db/seed-nestjs-auth.js` with migration/ops
database credentials to create the `DEFAULT` tenant. Production SSO
auto-provisioning can then use `OIDC_AUTO_PROVISION_TENANT_CODE=DEFAULT`.

Do not commit `OIDC_CLIENT_SECRET`. Inject it through `.env.production`,
`.env.nestjs`, Docker/PM2 runtime configuration, or the production secret
manager. Rotate any OIDC client secret that was shared outside the intended
secret-management channel before production launch.

## 命令

启动所有进程：
```
pm2 start production-config/ecosystem.config.js
```

停止所有进程：
```
pm2 stop all
```

查看日志：
```
pm2 logs
```

重载 Nginx 配置：
```
nginx -s reload
```

初始化管理员账号：
```
node scripts/seed-admin.js
```

初始化演示账号：
```
node scripts/seed-demo-accounts.js
```
