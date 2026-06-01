import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSrc = readFileSync(resolve(__dirname, "publishTasksRouter.ts"), "utf-8");

describe("publishTasksRouter notification hooks", () => {
  it("keeps publish notifications inside complete mutation without stray closing braces", () => {
    const start = routerSrc.indexOf("complete: publicProcedure");
    const end = routerSrc.indexOf("listRecentByProject:", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = routerSrc.slice(start, end);

    expect(block).toContain('if (input.status === "completed"');
    expect(block).toContain("emitPublishSuccessNotification");
    expect(block).toContain('if (input.status === "failed")');
    expect(block).toContain("emitPublishFailedNotification");

    // Regression: notification hooks were once placed after an extra `}` (TS/esbuild parse failure).
    expect(block).not.toMatch(/\}\s*\}\s*\n\s*\n\s*void emitPublishSuccessNotification/);
  });
});
