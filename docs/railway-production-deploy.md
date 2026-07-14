# Railway Production Deploy

Railway is the new production deployment target for GEO. The Manus site remains online as rollback backup until the Railway deployment has been verified.

## Runtime Shape

- Frontend: Vite + React.
- Backend: Express + tRPC.
- Frontend artifact: `dist/public`.
- Backend artifact: `dist/index.js`.
- Build command: `corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm build`.
- Start command: `corepack pnpm start`.
- Port: Railway injects `PORT`; the server falls back to `3000` locally.
- Database: MySQL through `DATABASE_URL` and Drizzle.
- Migration command: `corepack pnpm db:migrate`.
- Runtime: long-running Node service.

## Railway Config

`railway.json` configures:

- Railpack builder.
- Build command.
- Start command.
- `/health` healthcheck.
- `ON_FAILURE` restart policy with 10 retries.

The lightweight `/health` route returns `200` without calling the database or LLM provider. The deeper operational health endpoint remains `/api/health`.

## Version Endpoints

Production verification can use any of:

```text
/version.json
/manus/version.json
/__manus__/version.json
```

The response includes:

- `version`
- `commit`
- `buildTime`
- `environment`

No secrets are returned.

## Required Railway Variables

Configure these on the Railway service:

```text
NODE_ENV=production
DATABASE_URL
JWT_SECRET
OPENAI_API_KEY
TAVILY_API_KEY
LLM_PROVIDER=openai
OPENAI_BASE_URL
OPENAI_MODEL
OPENAI_TIMEOUT_MS=60000
APP_PUBLIC_URL=<Railway production URL>
```

Optional variables used by current code paths:

```text
OPENAI_CHAT_COMPLETIONS_PATH=/chat/completions
HTTPS_PROXY
HTTP_PROXY
ALL_PROXY
VITE_APP_ID
OAUTH_SERVER_URL
VITE_OAUTH_PORTAL_URL
OWNER_OPEN_ID
BUILT_IN_FORGE_API_URL
BUILT_IN_FORGE_API_KEY
VITE_FRONTEND_FORGE_API_URL
VITE_FRONTEND_FORGE_API_KEY
ARK_DEEPSEEK_MODEL_ID  # 样板定时复测必需；必须与 OPENAI_MODEL 不同
KIMI_API_KEY
QWEN_API_KEY
WENXIN_API_KEY
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
GEO_QC_FLOW_MAX_MS
GEO_QC_REWRITE_TIMEOUT_MS
GEO_CONTENT_GENERATION_PER_MINUTE_LIMIT
GEO_T0_DETECTION_PER_HOUR_LIMIT
GEO_QUALITY_MIN_PASS_SCORE
GEO_DEFAULT_PUBLISH_PLATFORMS
AGENT_MAC_ZIP_URL
GEO_WEB_BASE_URL
```

Do not commit `.env`, database passwords, API keys, tokens, or Railway secrets.

## GitHub Actions Secrets And Variables

`Deploy Railway Production` requires these GitHub Actions secrets:

```text
DATABASE_URL
JWT_SECRET
OPENAI_API_KEY
TAVILY_API_KEY
RAILWAY_TOKEN
RAILWAY_PROJECT_ID
RAILWAY_SERVICE_ID
```

`RAILWAY_PROJECT_ID` and `RAILWAY_SERVICE_ID` may also be repository variables if preferred.

Alternative deployment trigger:

```text
RAILWAY_DEPLOY_HOOK_URL
```

If `RAILWAY_DEPLOY_HOOK_URL` is set, the workflow calls the hook instead of `railway up`. The service should be connected to GitHub so Railway receives `RAILWAY_GIT_COMMIT_SHA`.

Configure these repository variables:

```text
RAILWAY_ENVIRONMENT=production
RAILWAY_PRODUCTION_URL=<Railway production URL>
LLM_PROVIDER=openai
OPENAI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
OPENAI_MODEL=ep-20251210143333-s6bb7
OPENAI_TIMEOUT_MS=60000
RUN_MIGRATIONS=false
```

## Railway Console Setup

1. Create a Railway project.
2. Add a service from GitHub repository `yunmai0622-afk/ai_geo_workbench00`.
3. Select the `main` branch.
4. Confirm Railway reads `railway.json`.
5. Configure the required service variables.
6. Generate a public Railway domain.
7. Set `APP_PUBLIC_URL` and GitHub `RAILWAY_PRODUCTION_URL` to that domain.
8. Trigger the first deployment.
9. Check build and deploy logs.
10. Verify `/health` and `/version.json`.

## CLI Setup

Use this only on a trusted machine. Do not paste secrets into chat.

```bash
npm install -g @railway/cli
railway login
railway link
railway variable set NODE_ENV=production
railway variable set DATABASE_URL --stdin
railway variable set JWT_SECRET --stdin
railway variable set OPENAI_API_KEY --stdin
railway variable set TAVILY_API_KEY --stdin
railway variable set LLM_PROVIDER=openai
railway variable set OPENAI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
railway variable set OPENAI_MODEL=ep-20251210143333-s6bb7
railway variable set OPENAI_TIMEOUT_MS=60000
railway up --ci
```

## Migration Policy

This P0 migration does not add a database migration.

Do not run production migrations automatically on every deploy. For future DB changes:

1. Confirm migration file and rollback risk.
2. Back up or snapshot the production database.
3. Run `corepack pnpm db:migrate` manually or through an approved one-off job.
4. Verify affected pages and APIs.

## Production Verification

After deployment:

```bash
curl --fail --show-error --silent "$RAILWAY_PRODUCTION_URL/version.json"
curl --fail --show-error --silent "$RAILWAY_PRODUCTION_URL/?cb=$(git rev-parse HEAD)"
```

The HTML must not reference the old Manus bundle:

```text
/assets/index-Cwp_1Y0L.js
```

Weekly P0 browser acceptance:

1. Open `/weekly?projectId=210001`.
2. Click `进入推进`.
3. URL should become `/weekly?questionId=480001&projectId=210001` or an equivalent task URL.
4. The page should switch to the single-task progression view without refresh.
5. The task should show `海豚知道是什么？` and platform content tasks.
6. Console errors: 0.
7. Page errors: 0.
8. API 500: 0.

Regression pages:

```text
/weekly?projectId=180001
/workspace?projectId=180001
/monthly-plan?projectId=180001
/questions?projectId=180001
/inclusion-monitoring?projectId=180001
/delivery-reports?projectId=180001
```

Keep the Manus URL available as rollback backup until Railway verification passes.
