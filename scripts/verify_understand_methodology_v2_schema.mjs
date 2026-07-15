import {readFile} from "node:fs/promises";
const migration=await readFile("drizzle/0078_understand_methodology_v2.sql","utf8"),baseline=await readFile("drizzle/baselines/tidb_v0078.sql","utf8"),journal=JSON.parse(await readFile("drizzle/meta/_journal.json","utf8"));
for(const value of ["identity","category","business","product_service","target_customer","scenario","capability_differentiation","boundary_temporal","understanding_methodology_dimension_definitions","understanding_question_dimension_bindings","temporalStatus"]){if(!migration.includes(value)||!baseline.includes(value))throw new Error(`0078 missing ${value}`);}
if(journal.entries.at(-1)?.tag!=="0078_understand_methodology_v2")throw new Error("0078 is not journal tail");
if(/(?:INSERT|UPDATE|DELETE).*understanding_evaluations/i.test(migration))throw new Error("0078 touches legacy data");
console.log(JSON.stringify({status:"passed",migration:"0078",v1Preserved:true,legacyTouched:false}));
