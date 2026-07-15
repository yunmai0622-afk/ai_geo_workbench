import { mkdir, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";
const value = flag => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : undefined; };
const projectId = Number(value("--project-id"));
const out = value("--out");
if (!process.env.DATABASE_URL || !projectId || !out) throw new Error("DATABASE_URL, --project-id and --out are required");
const tables = ["brand_truth_profiles","brand_truth_facts","brand_truth_fact_versions","brand_truth_evidence","brand_truth_fact_evidence_links","brand_truth_conflicts","understanding_question_sets","understanding_questions","understanding_evaluations","understanding_dimension_results","understanding_correction_tasks","understanding_rule_configs"];
const db = await mysql.createConnection(process.env.DATABASE_URL);
await mkdir(out, { recursive: true });
try {
  for (const table of tables) {
    const [rows] = await db.execute(`SELECT * FROM \`${table}\` WHERE projectId = ?`, [projectId]);
    await writeFile(`${out}/${table}.json`, JSON.stringify(rows, null, 2));
  }
} finally { await db.end(); }
console.log(`[brand-truth-export] exported project ${projectId} to ${out}`);
