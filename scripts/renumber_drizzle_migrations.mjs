/**
 * Renumber drizzle/*.sql by git-add time (creation), then refresh references + journal.
 * Two-phase rename avoids filename collisions.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DRIZZLE = path.join(ROOT, "drizzle");

const pad = (n) => String(n).padStart(4, "0");

const files = fs.readdirSync(DRIZZLE).filter((f) => f.endsWith(".sql"));
const rows = files.map((f) => {
  const full = path.join("drizzle", f);
  let when = "1970-01-01T00:00:00";
  try {
    when =
      execSync(`git log --diff-filter=A --format='%ci' -1 -- ${JSON.stringify(full)}`, {
        encoding: "utf8",
        cwd: ROOT,
      }).trim() || when;
  } catch {
    /* ignore */
  }
  const suffix = f.replace(/^\d{4}_/, "");
  return { f, when, suffix };
});
rows.sort((a, b) => a.when.localeCompare(b.when) || a.suffix.localeCompare(b.suffix));

const mapping = new Map();
rows.forEach((r, i) => {
  const newName = `${pad(i)}_${r.suffix}`;
  if (r.f !== newName) mapping.set(r.f, newName);
});

if (mapping.size === 0) {
  console.log("No renames needed.");
  process.exit(0);
}

console.log(`Renaming ${mapping.size} migration file(s)...`);

// Phase 1: temp names
const temp = new Map();
for (const [oldName] of mapping) {
  const tmp = `__renumber_tmp__${oldName}`;
  fs.renameSync(path.join(DRIZZLE, oldName), path.join(DRIZZLE, tmp));
  temp.set(oldName, tmp);
}
// Phase 2: final names
for (const [oldName, newName] of mapping) {
  fs.renameSync(path.join(DRIZZLE, temp.get(oldName)), path.join(DRIZZLE, newName));
}

// Replace references in repo (longest old name first)
const sortedOld = [...mapping.keys()].sort((a, b) => b.length - a.length);
const exts = new Set([".ts", ".tsx", ".mjs", ".md", ".json"]);
function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".git") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (exts.has(path.extname(ent.name))) out.push(p);
  }
  return out;
}
let fileUpdates = 0;
for (const filePath of walk(ROOT)) {
  if (filePath.includes(`${path.sep}drizzle${path.sep}`) && filePath.endsWith(".sql")) continue;
  if (filePath.endsWith("renumber_drizzle_migrations.mjs")) continue;
  let text = fs.readFileSync(filePath, "utf8");
  let next = text;
  for (const oldName of sortedOld) {
    const newName = mapping.get(oldName);
    next = next.split(`drizzle/${oldName}`).join(`drizzle/${newName}`);
  }
  if (next !== text) {
    fs.writeFileSync(filePath, next);
    fileUpdates++;
  }
}

// Rebuild journal (all .sql in numeric order)
const finalFiles = fs
  .readdirSync(DRIZZLE)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const baseWhen = 1778224697827;
const entries = finalFiles.map((f, idx) => ({
  idx,
  version: "5",
  when: baseWhen + idx * 1000000,
  tag: f.replace(/\.sql$/, ""),
  breakpoints: true,
}));
const journalPath = path.join(DRIZZLE, "meta", "_journal.json");
fs.writeFileSync(
  journalPath,
  `${JSON.stringify({ version: "7", dialect: "mysql", entries }, null, 2)}\n`,
);

console.log("Updated references in", fileUpdates, "files");
console.log("Journal entries:", entries.length);
console.log("Final migrations:");
finalFiles.forEach((f) => console.log(" ", f));
