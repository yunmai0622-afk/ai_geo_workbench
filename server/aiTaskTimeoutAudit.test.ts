import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("AI task timeout audit", () => {
  it("OPENAI_TIMEOUT_MS defaults to at least 60000", () => {
    const llm = read("server/_core/llm.ts");
    expect(llm).toMatch(/OPENAI_TIMEOUT_MS \?\? 60000/);
    const example = read(".env.example");
    expect(example).toContain("OPENAI_TIMEOUT_MS=60000");
  });

  it("diagnosis and article generation use explicit invoke timeouts", () => {
    const routers = read("server/routers.ts");
    expect(routers).toMatch(/timeout_ms:\s*120000/);
    const articleLogic = read("server/geoArticleLogic.ts");
    expect(articleLogic).toMatch(/timeout_ms:\s*180000/);
  });

  it("frontend trpc client does not set an artificial short fetch timeout", () => {
    const main = read("client/src/main.tsx");
    expect(main).not.toMatch(/AbortSignal\.timeout|timeout:\s*\d+/);
  });
});
