import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const required = {
  understanding_evaluations: ["projectId", "rawAnswer", "methodologyVersion", "dimensionWeights", "ruleVersion", "truthProfileVersion", "questionSetVersion", "extractionVersion", "assessmentStatus", "assessmentCoverage"],
  brand_truth_evidence: ["projectId", "url", "sourceOwner", "sourceClass", "independentSource", "accessible", "capturedAt", "evidenceHash", "manualReviewStatus"],
};
const urlArg = process.argv.indexOf("--database-url");
const databaseUrl = urlArg >= 0 ? process.argv[urlArg + 1] : process.env.DATABASE_URL;
if (!databaseUrl) {
  const sql = (await Promise.all([
    readFile(new URL("../drizzle/0071_brand_truth_understand_engine.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0072_brand_truth_understand_acceptance_gate.sql", import.meta.url), "utf8"),
  ])).join("\n");
  for (const columns of Object.values(required)) for (const column of columns) if (!sql.includes(`\`${column}\``)) throw new Error(`0071/0072 missing ${column}`);
  console.log("[brand-truth-schema] dry-run static verification passed; DATABASE_URL not supplied, live drift is NOT verified");
  process.exit(0);
}
const db = await mysql.createConnection(databaseUrl);
try {
  const [schemaRows] = await db.query("SELECT DATABASE() schemaName");
  const schemaName = schemaRows[0].schemaName;
  for (const [table, columns] of Object.entries(required)) {
    const [rows] = await db.execute("SELECT column_name columnName FROM information_schema.columns WHERE table_schema=? AND table_name=?", [schemaName, table]);
    const actual = new Set(rows.map(row => row.columnName));
    for (const column of columns) if (!actual.has(column)) throw new Error(`${table}.${column} missing (schema drift)`);
  }
  console.log("[brand-truth-schema] live required-column verification passed");
} finally { await db.end(); }
