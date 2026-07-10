import "dotenv/config";
import { runDueSampleRetests } from "../server/scheduledSampleRetest";

const dryRun = process.argv.includes("--dry-run");
runDueSampleRetests({ dryRun })
  .then(result => {
    console.log(JSON.stringify(result, null, 2));
    if (!dryRun && "results" in result && result.results.some(item => item.status === "failed")) process.exitCode = 1;
  })
  .catch(error => {
    console.error("[scheduled-sample-retest] runner failed", error);
    process.exitCode = 1;
  });
