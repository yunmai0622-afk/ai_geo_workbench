import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

function readEnv(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function git(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : null;
}

const commit =
  readEnv("RAILWAY_GIT_COMMIT_SHA") ||
  readEnv("GITHUB_SHA") ||
  git(["rev-parse", "HEAD"]) ||
  readEnv("SOURCE_VERSION") ||
  readEnv("COMMIT_SHA") ||
  readEnv("GIT_COMMIT") ||
  "unknown";

const payload = {
  ok: true,
  version: typeof packageJson.version === "string" ? packageJson.version : "unknown",
  commit,
  buildTime: readEnv("RAILWAY_BUILD_TIME") || new Date().toISOString(),
  environment: readEnv("NODE_ENV") || readEnv("RAILWAY_ENVIRONMENT_NAME") || "production",
  source: "build",
};

const outputFiles = [
  resolve(root, "dist", "public", "__manus__", "version.json"),
  resolve(root, "dist", "public", "manus", "version.json"),
  resolve(root, "dist", "public", "version.json"),
];

for (const file of outputFiles) {
  const directory = dirname(file);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

console.log(`[version] wrote production version metadata for commit ${commit.slice(0, 12)}`);
