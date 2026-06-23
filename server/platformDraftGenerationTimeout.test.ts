import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PLATFORM_DRAFT_GENERATION_BASIS_KEY,
  PLATFORM_DRAFT_GENERATION_TIMEOUT_CUSTOMER_MESSAGE,
  PLATFORM_DRAFT_START_MESSAGE,
} from "../shared/platformDraftGeneration";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.1-P1-Content-Generation-Timeout-Stability", () => {
  const routers = read("server/routers.ts");
  const service = read("server/platformDraftGenerationService.ts");
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const shared = read("shared/platformDraftGeneration.ts");

  it("exposes async start and status APIs", () => {
    expect(routers).toContain("startPlatformDraftGeneration");
    expect(routers).toContain("getPlatformDraftGenerationStatus");
    expect(service).toContain("executePlatformDraftGenerationJob");
    expect(service).toContain("void executePlatformDraftGenerationJob");
  });

  it("stores generation state in generationBasis without new migration", () => {
    expect(shared).toContain(PLATFORM_DRAFT_GENERATION_BASIS_KEY);
    expect(service).toContain("mergePlatformDraftGeneration");
    expect(routers).not.toContain("0068_platform_draft");
  });

  it("weekly page polls draft status instead of blocking on sync generate", () => {
    expect(weekly).toContain("startPlatformDraftGeneration");
    expect(weekly).toContain("getPlatformDraftGenerationStatus");
    expect(weekly).toContain("pollPlatformDraftUntilDone");
    expect(weekly).toContain("readPlatformDraftGeneration");
    expect(weekly).toContain("PLATFORM_DRAFT_START_MESSAGE");
    expect(weekly).toContain("PLATFORM_DRAFT_GENERATION_TIMEOUT_CUSTOMER_MESSAGE");
  });

  it("uses customer-safe timeout copy", () => {
    expect(shared).toContain(PLATFORM_DRAFT_GENERATION_TIMEOUT_CUSTOMER_MESSAGE);
    expect(PLATFORM_DRAFT_GENERATION_TIMEOUT_CUSTOMER_MESSAGE).not.toContain("联系管理员");
    expect(PLATFORM_DRAFT_START_MESSAGE).not.toContain("联系服务人员");
  });
});
