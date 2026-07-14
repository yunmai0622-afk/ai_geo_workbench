import "dotenv/config";
import { assertIndependentRetestModelConfiguration } from "../server/geoAiMentionCheck";

try {
  const config = assertIndependentRetestModelConfiguration();
  console.info(JSON.stringify({
    ok: true,
    independent: config.independent,
    channels: {
      doubao: { source: config.doubao.source, fingerprint: config.doubao.fingerprint },
      deepseek: { source: config.deepseek.source, fingerprint: config.deepseek.fingerprint },
    },
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    wroteRetestResults: false,
  }, null, 2));
  process.exitCode = 1;
}
