import { readFile } from "node:fs/promises";

const migration = await readFile("drizzle/0076_shadow_understand_question_locale.sql", "utf8");
const baseline = await readFile("drizzle/baselines/tidb_v0076.sql", "utf8");
const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
if (!/ADD COLUMN `locale` varchar\(32\) NOT NULL DEFAULT 'zh-CN'/i.test(migration)) throw new Error("0076 must add the question locale snapshot");
if (!baseline.includes("`locale` varchar(32) DEFAULT 'zh-CN' NOT NULL")) throw new Error("v0076 baseline is missing question locale");
if (journal.entries.at(-1)?.tag !== "0076_shadow_understand_question_locale") throw new Error("0076 is not the journal tail");
if (/understanding_evaluations|publish|trust.score|recommendation.gap/i.test(migration)) throw new Error("0076 crossed the PR-03.6D boundary");
console.log(JSON.stringify({ status: "passed", migration: "0076", legacyUnderstandingEvaluationsTouched: false }));
