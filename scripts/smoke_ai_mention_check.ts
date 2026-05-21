import "dotenv/config";
import { runAiMentionCheck } from "../server/geoAiMentionCheck";

async function main() {
  const result = await runAiMentionCheck({
    enterpriseName: "河南海豚知道文化传媒有限公司",
    shortName: "海豚知道",
    questions: ["做线上课程用哪个平台比较好？"],
    engines: ["doubao", "deepseek"],
  });

  console.log(
    JSON.stringify(
      {
        resultCount: result.results.length,
        mentionRate: result.mentionRate,
        recommendRate: result.recommendRate,
        engineSummary: result.engineSummary,
        samples: result.results.map(r => ({
          engine: r.engineName,
          question: r.question.slice(0, 40),
          mentionsBrand: r.mentionsBrand,
          recommendsBrand: r.recommendsBrand,
          answerPreview: r.answer.slice(0, 120),
        })),
      },
      null,
      2,
    ),
  );

  if (result.results.length === 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
