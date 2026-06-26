#!/usr/bin/env node

const API_BASE =
  process.env.MANUS_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.manus.ai/v2";
const DEFAULT_TARGET_HOST = "aigeoworkb-kzxhj9uy.manus.space";

const args = new Map(
  process.argv
    .slice(2)
    .filter(arg => arg.startsWith("--") && arg.includes("="))
    .map(arg => {
      const [key, ...valueParts] = arg.slice(2).split("=");
      return [key, valueParts.join("=")];
    })
);

const apiKey = process.env.MANUS_API_KEY?.trim();
const configuredWebsiteId = process.env.MANUS_WEBSITE_ID?.trim();
const configuredTaskId = process.env.MANUS_TASK_ID?.trim();
const targetHost = normalizeHost(
  args.get("target-host") ||
    process.env.MANUS_TARGET_HOST ||
    process.env.MANUS_EXPECTED_URL ||
    DEFAULT_TARGET_HOST
);
const maxTasks = readPositiveInt(
  args.get("max-tasks") || process.env.MANUS_DISCOVER_MAX_TASKS,
  160
);
const maxPages = readPositiveInt(
  args.get("max-pages") || process.env.MANUS_DISCOVER_MAX_PAGES,
  5
);
const statusDelayMs = readPositiveInt(
  process.env.MANUS_DISCOVER_STATUS_DELAY_MS,
  650
);
const printLimit = readPositiveInt(process.env.MANUS_DISCOVER_PRINT_LIMIT, 25);

function fail(message) {
  console.error(`[discover:manus] ${message}`);
  process.exit(1);
}

function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizeHost(value) {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_TARGET_HOST;

  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return raw
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
  }
}

function safeUrlHost(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

function matchesTargetHost(urls) {
  return urls.some(
    url =>
      safeUrlHost(url) === targetHost ||
      String(url).toLowerCase().includes(targetHost)
  );
}

function timestampSecondsToIso(value) {
  if (!value || !Number.isFinite(Number(value))) return undefined;
  return new Date(Number(value) * 1000).toISOString();
}

function compactTask(task) {
  return {
    task_id: task?.id,
    title: task?.title,
    task_url: task?.task_url,
    status: task?.status,
    task_type: task?.task_type,
    share_visibility: task?.share_visibility,
    created_at: timestampSecondsToIso(task?.created_at),
    updated_at: timestampSecondsToIso(task?.updated_at),
  };
}

function compactWebsite(payload, task) {
  const data =
    payload?.data && typeof payload.data === "object" ? payload.data : payload;
  const siteUrls = [
    ...(Array.isArray(data?.site_urls) ? data.site_urls : []),
    data?.url,
    data?.website_url,
    data?.site_url,
    data?.public_url,
  ].filter(
    (url, index, urls) => typeof url === "string" && urls.indexOf(url) === index
  );

  return {
    task_id: task?.id,
    task_title: task?.title,
    task_url: task?.task_url,
    website_id: data?.website_id ?? data?.id,
    publish_status: data?.publish_status ?? data?.status ?? data?.state,
    visibility: data?.visibility,
    version_id: data?.version_id ?? data?.version,
    status_updated_at: timestampSecondsToIso(data?.status_updated_at),
    site_urls: siteUrls,
    matched_target_host: matchesTargetHost(siteUrls),
  };
}

function sanitizeErrorPayload(payload) {
  const error = payload?.error;
  return {
    code: typeof error?.code === "string" ? error.code : undefined,
    message:
      typeof error?.message === "string"
        ? error.message
        : typeof error === "string"
          ? error
          : undefined,
    request_id:
      typeof payload?.request_id === "string" ? payload.request_id : undefined,
  };
}

async function getJson(endpoint, params = {}) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
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
    payload = { raw: text ? "[non-json response]" : "" };
  }

  if (!response.ok) {
    const detail = sanitizeErrorPayload(payload);
    const error = new Error(
      `${endpoint} failed with ${response.status}: ${JSON.stringify(detail)}`
    );
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  return payload;
}

async function listTasks(params = {}) {
  const tasks = [];
  let cursor = "";
  let pages = 0;
  let hasMore = false;

  do {
    pages += 1;
    const payload = await getJson("task.list", {
      limit: Math.min(100, maxTasks - tasks.length),
      order: "desc",
      ...params,
      cursor,
    });
    const pageTasks = Array.isArray(payload?.data) ? payload.data : [];
    tasks.push(...pageTasks);
    cursor =
      typeof payload?.next_cursor === "string" ? payload.next_cursor : "";
    hasMore = Boolean(payload?.has_more && cursor);
  } while (hasMore && pages < maxPages && tasks.length < maxTasks);

  return {
    tasks: tasks.slice(0, maxTasks),
    pages,
    has_more: hasMore,
  };
}

async function listProjects() {
  try {
    const payload = await getJson("project.list");
    return Array.isArray(payload?.data) ? payload.data : [];
  } catch (error) {
    console.log(`[discover:manus] project.list unavailable: ${error.message}`);
    return [];
  }
}

async function readWebsiteStatus(params) {
  return getJson("website.status", params);
}

async function readWebsiteCheckpoints(params) {
  try {
    const payload = await getJson("website.listCheckpoints", params);
    const checkpoints = Array.isArray(payload?.data) ? payload.data : [];
    return {
      published_version_id: payload?.published_version_id,
      checkpoint_count: checkpoints.length,
      latest_checkpoint: checkpoints[0]
        ? {
            version_id: checkpoints[0].version_id,
            message: checkpoints[0].message,
            status: checkpoints[0].status,
            created_at: timestampSecondsToIso(checkpoints[0].created_at),
          }
        : undefined,
    };
  } catch (error) {
    return {
      checkpoints_error: error.message,
    };
  }
}

async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function checkConfiguredTarget() {
  const configured = [];
  if (configuredWebsiteId)
    configured.push({
      type: "MANUS_WEBSITE_ID",
      params: { website_id: configuredWebsiteId },
    });
  if (configuredTaskId)
    configured.push({
      type: "MANUS_TASK_ID",
      params: { task_id: configuredTaskId },
    });

  for (const target of configured) {
    try {
      const payload = await readWebsiteStatus(target.params);
      const website = compactWebsite(payload, { id: target.params.task_id });
      console.log(`[discover:manus] configured ${target.type} status:`);
      console.log(JSON.stringify(website, null, 2));
    } catch (error) {
      console.log(
        `[discover:manus] configured ${target.type} status failed: ${error.message}`
      );
    }
  }
}

async function collectTasks() {
  const unique = new Map();
  const allTasksResult = await listTasks({ scope: "all" });
  console.log(
    `[discover:manus] task.list scope=all tasks=${allTasksResult.tasks.length} pages=${allTasksResult.pages} has_more=${allTasksResult.has_more}`
  );
  for (const task of allTasksResult.tasks) {
    if (task?.id) unique.set(task.id, task);
  }

  const projects = await listProjects();
  console.log(`[discover:manus] project.list projects=${projects.length}`);

  for (const project of projects) {
    if (unique.size >= maxTasks) break;
    if (!project?.id) continue;
    try {
      const result = await listTasks({
        scope: "project",
        project_id: project.id,
      });
      console.log(
        `[discover:manus] task.list project_id=${project.id} tasks=${result.tasks.length}`
      );
      for (const task of result.tasks) {
        if (task?.id && unique.size < maxTasks) unique.set(task.id, task);
      }
    } catch (error) {
      console.log(
        `[discover:manus] task.list project_id=${project.id} unavailable: ${error.message}`
      );
    }
  }

  return [...unique.values()].slice(0, maxTasks);
}

async function discoverWebsites(tasks) {
  const websites = [];
  let noWebsite = 0;
  let failed = 0;

  for (const task of tasks) {
    try {
      const payload = await readWebsiteStatus({ task_id: task.id });
      const website = compactWebsite(payload, task);
      website.checkpoints = await readWebsiteCheckpoints({
        website_id: website.website_id || undefined,
        task_id: website.website_id ? undefined : task.id,
      });
      websites.push(website);
    } catch (error) {
      if (error.status === 404) {
        noWebsite += 1;
      } else {
        failed += 1;
        console.log(
          `[discover:manus] website.status task_id=${task.id} failed: ${error.message}`
        );
      }
    }
    await sleep(statusDelayMs);
  }

  return {
    websites,
    noWebsite,
    failed,
  };
}

async function main() {
  if (!apiKey) {
    fail(
      "MANUS_API_KEY is required. Configure it as an environment variable or GitHub Actions secret."
    );
  }

  console.log(`[discover:manus] target_host=${targetHost}`);
  console.log(`[discover:manus] api_base=${API_BASE}`);
  console.log(`[discover:manus] max_tasks=${maxTasks} max_pages=${maxPages}`);

  await checkConfiguredTarget();

  const tasks = await collectTasks();
  console.log(`[discover:manus] unique_tasks=${tasks.length}`);
  console.log(
    `[discover:manus] task_sample=${JSON.stringify(tasks.slice(0, Math.min(5, tasks.length)).map(compactTask), null, 2)}`
  );

  const result = await discoverWebsites(tasks);
  const matches = result.websites.filter(
    website => website.matched_target_host
  );

  console.log(
    `[discover:manus] website.status summary websites_seen=${result.websites.length} no_website=${result.noWebsite} failed=${result.failed} matches=${matches.length}`
  );

  if (result.websites.length > 0) {
    console.log(
      `[discover:manus] website_candidates=${JSON.stringify(result.websites.slice(0, printLimit), null, 2)}`
    );
  }

  if (matches.length > 0) {
    const recommended = matches[0];
    console.log("[discover:manus] matched_target_websites=");
    console.log(JSON.stringify(matches, null, 2));
    console.log("[discover:manus] recommendation=");
    console.log(
      JSON.stringify(
        {
          secret_to_set: "MANUS_WEBSITE_ID",
          id: recommended.website_id,
          reason: `site_urls contains ${targetHost}`,
          cleanup:
            "Delete MANUS_TASK_ID after MANUS_WEBSITE_ID is configured; deploy script accepts exactly one target id.",
        },
        null,
        2
      )
    );
    return;
  }

  console.log("[discover:manus] no matching website found for target host.");
  console.log(
    JSON.stringify(
      {
        possible_causes: [
          "MANUS_API_KEY cannot access the production website owner account or workspace.",
          "The production site belongs to another Manus account or workspace.",
          "The API key only has create_task scope and cannot list UI-created tasks.",
          "The configured MANUS_TASK_ID is not a website session or has no initialized website.",
          "The API exposes website.status but does not expose a global website.list endpoint, so manual website_id lookup may still be required.",
        ],
        next_step:
          "Copy the website_id from the Manus website publishing/settings page, or use a Manus API key with manage_all_tasks access and rerun this workflow.",
      },
      null,
      2
    )
  );
}

main().catch(error =>
  fail(error instanceof Error ? error.message : String(error))
);
