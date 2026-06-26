# Production Deploy Pipeline

This project used to deploy to Manus production. Manus is now a rollback backup because `website.publish` republishes the latest Manus checkpoint but does not upload the GitHub Actions build artifact.

The active Railway migration runbook is:

```text
docs/railway-production-deploy.md
```

Legacy Manus URL:

```text
https://aigeoworkb-kzxhj9uy.manus.space
```

## Current Runtime Shape

- Frontend: Vite + React, built to `dist/public`.
- Backend: Express + tRPC, bundled to `dist/index.js`.
- Build command: `pnpm build`.
- Start command: `pnpm start`.
- Default port: `PORT` or `3000`.
- Database: MySQL through `DATABASE_URL` and Drizzle.
- Migration command: `pnpm db:migrate`.
- Dynamic version endpoints: `/version.json`, `/manus/version.json`, and `/__manus__/version.json`.

## Manus Deployment

Deployment is triggered by:

```bash
pnpm deploy:manus
```

Required environment variables:

```text
MANUS_API_KEY
MANUS_WEBSITE_ID or MANUS_TASK_ID
```

Provide exactly one deployment identifier. If both `MANUS_WEBSITE_ID` and `MANUS_TASK_ID` are set, the script stops before calling Manus.

Optional environment variables:

```text
MANUS_API_BASE_URL=https://api.manus.ai/v2
MANUS_EXPECTED_URL=https://aigeoworkb-kzxhj9uy.manus.space
MANUS_PUBLISH_VISIBILITY=public
MANUS_POLL_TIMEOUT_MS=600000
MANUS_POLL_INTERVAL_MS=15000
```

The script calls `website.publish`, polls `website.status`, and fails if the deployment does not become ready before the timeout. This confirms Manus publish state only; it does not prove that the GitHub Actions build artifact reached production.

## Manus Target Discovery

If `website.publish` fails with `404 web project not found`, run the read-only discovery workflow before changing deployment IDs:

```bash
gh workflow run discover-manus-target.yml --repo yunmai0622-afk/ai_geo_workbench00 --ref main
```

The workflow runs `pnpm manus:discover-target` with `MANUS_API_KEY`, calls read-only Manus endpoints (`task.list`, `project.list`, `website.status`, and `website.listCheckpoints`), and matches `site_urls` against:

```text
aigeoworkb-kzxhj9uy.manus.space
```

It never calls `website.publish` and does not print API keys or application secrets. If a matching website is found, prefer configuring `MANUS_WEBSITE_ID` and remove `MANUS_TASK_ID`; the deploy script requires exactly one of them.

## GitHub Actions

`.github/workflows/deploy-manus.yml` runs on pushes to `main` and can also be triggered manually.

Configure these GitHub repository secrets:

```text
MANUS_API_KEY
MANUS_WEBSITE_ID
DATABASE_URL
JWT_SECRET
OPENAI_API_KEY
TAVILY_API_KEY
```

or, if the Manus project is only addressable by task:

```text
MANUS_API_KEY
MANUS_TASK_ID
DATABASE_URL
JWT_SECRET
OPENAI_API_KEY
TAVILY_API_KEY
```

Configure these GitHub repository variables:

```text
MANUS_EXPECTED_URL=https://aigeoworkb-kzxhj9uy.manus.space
MANUS_PUBLISH_VISIBILITY=public
LLM_PROVIDER=openai
OPENAI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
OPENAI_MODEL=ep-20251210143333-s6bb7
OPENAI_TIMEOUT_MS=60000
RUN_MIGRATIONS=false
```

Set `RUN_MIGRATIONS=true` only for commits that require `pnpm db:migrate` during deployment.

## Production Verification

After deployment:

```bash
curl --fail --show-error --silent \
  https://aigeoworkb-kzxhj9uy.manus.space/__manus__/version.json
```

Then run browser verification against:

```text
https://aigeoworkb-kzxhj9uy.manus.space/weekly?projectId=210001
```

Acceptance requires the "进入推进" action to navigate to a single-task progress page with project and task parameters, no console errors, and no API 500 responses.
