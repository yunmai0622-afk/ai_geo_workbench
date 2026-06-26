#!/usr/bin/env node

const API_BASE = process.env.MANUS_API_BASE_URL?.replace(/\/+$/, "") || "https://api.manus.ai/v2";

const args = new Set(process.argv.slice(2));
const statusOnly = args.has("--status-only");
const noPoll = args.has("--no-poll");

const apiKey = process.env.MANUS_API_KEY?.trim();
const websiteId = process.env.MANUS_WEBSITE_ID?.trim();
const taskId = process.env.MANUS_TASK_ID?.trim();
const expectedUrl = process.env.MANUS_EXPECTED_URL?.trim();
const visibility = process.env.MANUS_PUBLISH_VISIBILITY?.trim() || "public";
const pollTimeoutMs = Number(process.env.MANUS_POLL_TIMEOUT_MS ?? 10 * 60 * 1000);
const pollIntervalMs = Number(process.env.MANUS_POLL_INTERVAL_MS ?? 15 * 1000);

function fail(message) {
  console.error(`[deploy:manus] ${message}`);
  process.exit(1);
}

if (!apiKey) {
  fail("MANUS_API_KEY is required. Store it as a local env var or GitHub Actions secret.");
}

if (!websiteId && !taskId) {
  fail("MANUS_WEBSITE_ID or MANUS_TASK_ID is required.");
}

if (websiteId && taskId) {
  fail("Provide exactly one of MANUS_WEBSITE_ID or MANUS_TASK_ID, not both.");
}

function deploymentRef() {
  return websiteId ? { website_id: websiteId } : { task_id: taskId };
}

async function callManus(endpoint, body) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-manus-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const detail = typeof payload?.error === "string" ? payload.error : JSON.stringify(payload);
    throw new Error(`${endpoint} failed with ${response.status}: ${detail}`);
  }

  return payload;
}

function extractStatus(payload) {
  const data = payload?.data && typeof payload.data === "object" ? payload.data : payload;
  const siteUrls = Array.isArray(data?.site_urls) ? data.site_urls.filter(url => typeof url === "string") : [];
  return {
    status: data?.publish_status ?? data?.status ?? data?.state ?? data?.deployment_status ?? "unknown",
    url: siteUrls[0] ?? data?.url ?? data?.website_url ?? data?.site_url ?? data?.public_url ?? "",
    urls: siteUrls,
    version: data?.version_id ?? data?.version ?? data?.deployment_version ?? data?.checkpoint_id ?? "",
    raw: data,
  };
}

function isReady(status) {
  return /ready|published|deployed|success|completed|active/i.test(String(status));
}

async function readStatus() {
  const params = new URLSearchParams(deploymentRef());
  const response = await fetch(`${API_BASE}/website.status?${params.toString()}`, {
    method: "GET",
    headers: {
      "x-manus-api-key": apiKey,
    },
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const detail = typeof payload?.error === "string" ? payload.error : JSON.stringify(payload);
    throw new Error(`website.status failed with ${response.status}: ${detail}`);
  }

  return extractStatus(payload);
}

async function pollStatus() {
  const deadline = Date.now() + pollTimeoutMs;
  let last;

  while (Date.now() < deadline) {
    last = await readStatus();
    console.log(
      `[deploy:manus] status=${last.status}${last.version ? ` version=${last.version}` : ""}${last.url ? ` url=${last.url}` : ""}`,
    );

    if (isReady(last.status)) {
      if (expectedUrl && last.urls.length > 0 && !last.urls.some(url => url.startsWith(expectedUrl))) {
        fail(`deployment URL mismatch: expected ${expectedUrl}, got ${last.urls.join(", ")}`);
      }
      return last;
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  fail(`deployment did not become ready within ${pollTimeoutMs}ms`);
}

async function main() {
  console.log(`[deploy:manus] target=${websiteId ? "website" : "task"}:${websiteId || taskId}`);

  if (statusOnly) {
    const status = await readStatus();
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  const publishPayload = { ...deploymentRef(), visibility };
  const publishResult = await callManus("website.publish", publishPayload);
  console.log(`[deploy:manus] publish requested: ${JSON.stringify(extractStatus(publishResult))}`);

  if (!noPoll) {
    const finalStatus = await pollStatus();
    console.log(`[deploy:manus] deployment ready: ${JSON.stringify(finalStatus)}`);
  }
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)));
