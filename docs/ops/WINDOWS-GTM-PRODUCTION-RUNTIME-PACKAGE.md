# Windows GTM production runtime package

This runbook records the production packaging method used for `gtm.rhautt.com`.
It targets a Windows host, Nginx reverse proxy, frontend on `127.0.0.1:5000`,
backend on `127.0.0.1:4500`, and deploy root `E:\dev\gtm_rhautt`.

## Why this package shape

Do not ship the full development workspace or full dev `node_modules`.

Do not ship pnpm's default symlinked workspace layout as the runtime package.
Windows `tar` extraction can break pnpm symlink/virtual-store references, which
causes production errors such as:

```text
Cannot find module 'reflect-metadata'
Cannot find module 'next'
```

The production runtime package must use a flat, self-contained dependency
layout:

```text
node-linker=hoisted
package-import-method=copy
```

This keeps the archive smaller than the full dev workspace and avoids broken
symlinks after extraction.

## Build on the packaging machine

Run from the repository root:

```powershell
cd D:\Project\Red\rhautt-GOT
```

Build the production artifacts:

```powershell
pnpm install --frozen-lockfile
pnpm --filter @rhautt/services-api build
pnpm --filter dealer-workbench build
```

Create a clean runtime directory:

```powershell
$releaseRoot = "D:\Project\Red\rhautt-GOT\release-runtime"
$runtime = Join-Path $releaseRoot "gtm_rhautt_flat"

New-Item -ItemType Directory -Force $releaseRoot | Out-Null
if (Test-Path $runtime) { Remove-Item $runtime -Recurse -Force }
New-Item -ItemType Directory -Force $runtime | Out-Null
New-Item -ItemType Directory -Force "$runtime\backend","$runtime\frontend","$runtime\logs","$runtime\storage" | Out-Null
```

Copy backend runtime files:

```powershell
Copy-Item dist "$runtime\backend\dist" -Recurse
Copy-Item brand-registry.json "$runtime\backend\brand-registry.json"
Copy-Item .env.nestjs "$runtime\backend\.env.nestjs"
```

Copy frontend standalone build files:

```powershell
New-Item -ItemType Directory -Force "$runtime\frontend\apps\dealer-workbench" | Out-Null
Copy-Item apps\dealer-workbench\.next\standalone\* "$runtime\frontend" -Recurse
Copy-Item apps\dealer-workbench\.next\static "$runtime\frontend\apps\dealer-workbench\.next\static" -Recurse
Copy-Item apps\dealer-workbench\public "$runtime\frontend\apps\dealer-workbench\public" -Recurse
```

Copy shared packages needed by runtime code:

```powershell
Copy-Item packages "$runtime\packages" -Recurse
```

Create the runtime `package.json` with only runtime dependencies required by
the compiled backend and frontend. Keep this file close to the known-good
runtime package at `release-runtime\gtm_rhautt_flat\package.json`.

Install production dependencies with a flat copied layout:

```powershell
@"
node-linker=hoisted
package-import-method=copy
"@ | Set-Content "$runtime\.npmrc" -Encoding ascii

Copy-Item pnpm-lock.yaml "$runtime\pnpm-lock.yaml"
Set-Content "$runtime\pnpm-workspace.yaml" "packages: []" -Encoding ascii

Push-Location $runtime
pnpm install --prod --frozen-lockfile
Pop-Location
```

Add the runtime scripts:

```powershell
Copy-Item release-runtime\gtm_rhautt_flat\start-all.ps1 "$runtime\start-all.ps1"
Copy-Item release-runtime\gtm_rhautt_flat\stop-all.ps1 "$runtime\stop-all.ps1"
Copy-Item release-runtime\gtm_rhautt_flat\run-services.mjs "$runtime\run-services.mjs"
Copy-Item release-runtime\gtm_rhautt_flat\backend\start-backend.ps1 "$runtime\backend\start-backend.ps1"
Copy-Item release-runtime\gtm_rhautt_flat\frontend\start-frontend.ps1 "$runtime\frontend\start-frontend.ps1"
```

Verify dependency resolution before compressing:

```powershell
Push-Location $runtime
node -e "require('reflect-metadata'); console.log('reflect-metadata OK')"
node -e "require('next'); console.log('next OK')"
Pop-Location
```

Compress the package. The archive must contain top-level folder `gtm_rhautt`:

```powershell
$date = Get-Date -Format yyyyMMdd
$packageDir = Join-Path $releaseRoot "package-flat-tmp"
$packageApp = Join-Path $packageDir "gtm_rhautt"
$archive = Join-Path $releaseRoot "gtm_rhautt-production-flat-$date.tar.gz"

if (Test-Path $packageDir) { Remove-Item $packageDir -Recurse -Force }
New-Item -ItemType Directory -Force $packageDir | Out-Null
Copy-Item $runtime $packageApp -Recurse
tar -czf $archive -C $packageDir gtm_rhautt
```

Known-good package from the 2026-08-09 deployment:

```text
D:\Project\Red\rhautt-GOT\release-runtime\gtm_rhautt-production-flat-20260809.tar.gz
```

## Deploy on the production host

Copy the archive to `E:\dev`, then replace the runtime:

```powershell
cd E:\dev
powershell -ExecutionPolicy Bypass -File E:\dev\gtm_rhautt\stop-all.ps1
Rename-Item E:\dev\gtm_rhautt E:\dev\gtm_rhautt_backup_$(Get-Date -Format yyyyMMddHHmmss)
tar -xzf E:\dev\gtm_rhautt-production-flat-20260809.tar.gz -C E:\dev
cd E:\dev\gtm_rhautt
.\start-all.ps1
```

If the archive filename uses a new date, replace the filename in the `tar`
command.

## Required production env

Edit backend env after extraction:

```powershell
notepad E:\dev\gtm_rhautt\backend\.env.nestjs
```

SSO values for `gtm.rhautt.com`:

```env
OIDC_ISSUER=https://ai.rhautt.com
OIDC_CLIENT_ID=<production-sso-client-id>
OIDC_CLIENT_SECRET=<production-sso-client-secret>
OIDC_REDIRECT_URI=https://gtm.rhautt.com/api/v2/auth/sso/callback
OIDC_SCOPES=openid profile email roles org
OIDC_POST_LOGIN_REDIRECT=/cockpit
OIDC_ALLOWED_REDIRECT_HOSTS=gtm.rhautt.com
```

The matching SSO client must be registered in `ai.rhautt.com` as a server-side
application with callback:

```text
https://gtm.rhautt.com/api/v2/auth/sso/callback
```

Hermes center AI values for copy generation:

```env
HERMES_CENTER_AI_BASE_URL=https://ai.rhautt.com
HERMES_CENTER_AI_PROVIDER=qwen-max
HERMES_CENTER_AI_FIRST_BYTE_TIMEOUT_MS=30000
HERMES_CENTER_AI_TIMEOUT_MS=120000
HERMES_CENTER_AI_AUTH_HEADER=Authorization
HERMES_CENTER_AI_AUTH_TOKEN=Bearer <hermes-center-ai-token>
```

`HERMES_CENTER_AI_BASE_URL` is the root URL only. Runtime code calls:

```text
https://ai.rhautt.com/api/llm-stream
```

## Start, stop, and verify

Start:

```powershell
cd E:\dev\gtm_rhautt
.\start-all.ps1
```

Stop:

```powershell
cd E:\dev\gtm_rhautt
.\stop-all.ps1
```

Verify local services:

```powershell
curl http://127.0.0.1:4500/api/v2/health
curl http://127.0.0.1:5000/
```

Verify public Nginx proxy:

```powershell
curl https://gtm.rhautt.com/api/v2/health
curl https://gtm.rhautt.com/
```

Read logs:

```powershell
Get-Content E:\dev\gtm_rhautt\logs\backend.err.log -Tail 200
Get-Content E:\dev\gtm_rhautt\logs\backend.out.log -Tail 200
Get-Content E:\dev\gtm_rhautt\logs\frontend.err.log -Tail 200
Get-Content E:\dev\gtm_rhautt\logs\frontend.out.log -Tail 200
```

Check ports:

```powershell
netstat -ano | findstr ":4500"
netstat -ano | findstr ":5000"
```

## Nginx commands on Windows

Nginx is installed at `E:\soft\nginx-1.30.2`. In Windows PowerShell, run it as
`.\nginx.exe` from that directory:

```powershell
cd E:\soft\nginx-1.30.2
.\nginx.exe -t
.\nginx.exe -s reload
```

The production proxy must route:

```text
/             -> http://127.0.0.1:5000
/_next/static -> http://127.0.0.1:5000
/api/         -> http://127.0.0.1:4500
/ws           -> http://127.0.0.1:4500
```

If Nginx returns `502 Bad Gateway`, first verify the local ports with `curl`
and `netstat`. A 502 with no TCP listener on `127.0.0.1:4500` or
`127.0.0.1:5000` is an application startup problem, not an Nginx syntax problem.

## Common operator mistakes

Only paste commands into PowerShell. Do not paste prompt text or previous output
lines such as:

```text
PS E:\dev\gtm_rhautt>
Frontend: http://127.0.0.1:5000
Backend:  http://127.0.0.1:4500/api/v2/health
Logs:     E:\dev\gtm_rhautt\logs
```

PowerShell will try to execute those lines as commands and report confusing
errors.

If `curl https://gtm.rhautt.com/api/v2/health` returns `502`, run the local
checks first:

```powershell
curl http://127.0.0.1:4500/api/v2/health
curl http://127.0.0.1:5000/
Get-Content E:\dev\gtm_rhautt\logs\backend.err.log -Tail 200
Get-Content E:\dev\gtm_rhautt\logs\frontend.err.log -Tail 200
```
