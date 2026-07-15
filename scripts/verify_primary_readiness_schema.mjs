import { readFile } from "node:fs/promises";
const migration = await readFile("drizzle/0077_understand_primary_readiness.sql", "utf8");
const baseline = await readFile("drizzle/baselines/tidb_v0077.sql", "utf8");
const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
for (const value of ["category","products_services","customers","scenarios","capability_differentiation","boundary_temporal","request_evidence","mark_insufficient_data"]) {
  if (!migration.includes(value) || !baseline.includes(value)) throw new Error(`0077 missing ${value}`);
}
if (journal.entries.at(-1)?.tag !== "0077_understand_primary_readiness") throw new Error("0077 is not journal tail");
if (/UPDATE\s+`?understanding_evaluations|INSERT\s+INTO\s+`?understanding_evaluations/i.test(migration)) throw new Error("0077 modifies legacy data");
console.log(JSON.stringify({ status:"passed", migration:"0077", appendOnlyReview:true, legacyUnchanged:true }));
