# Production Deploy Pipeline

This project currently deploys to Manus production. The production URL is:

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
- Static version endpoint: `dist/public/__manus__/version.json` after build.

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

The script calls `website.publish`, polls `website.status`, and fails if the deployment does not become ready before the timeout.

## GitHub Actions

`.github/workflows/deploy-manus.yml` runs on pushes to `main` and can also be triggered manually.

Configure these GitHub repository secrets:

```text
MANUS_API_KEY
MANUS_WEBSITE_ID
```

or, if the Manus project is only addressable by task:

```text
MANUS_API_KEY
MANUS_TASK_ID
```

Configure this GitHub repository variable:

```text
MANUS_EXPECTED_URL=https://aigeoworkb-kzxhj9uy.manus.space
```

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
