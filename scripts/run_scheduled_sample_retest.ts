import "dotenv/config";
import { runDueSampleRetests } from "../server/scheduledSampleRetest";

const dryRun = process.argv.includes("--dry-run");
const ensureQuestions = process.argv.includes("--ensure-questions");
runDueSampleRetests({ dryRun, ensureQuestions })
  .then(result => {
    console.log(JSON.stringify(result, null, 2));
    const failed = !dryRun && "results" in result && result.results.some(item => item.status === "failed");
    process.exit(failed ? 1 : 0);
  })
  .catch(error => {
    console.error("[scheduled-sample-retest] runner failed", error);
    process.exit(1);
  });
