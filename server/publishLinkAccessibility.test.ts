import { describe, expect, it } from "vitest";
import { probePublishLinkAccessibility, resolvePublishLinkAbsoluteUrl } from "./publishLinkAccessibility";

describe("publishLinkAccessibility", () => {
  it("resolves relative GEO content paths against base URL", () => {
    expect(resolvePublishLinkAbsoluteUrl("/geo/content/1/2", "http://127.0.0.1:3000")).toBe(
      "http://127.0.0.1:3000/geo/content/1/2",
    );
    expect(resolvePublishLinkAbsoluteUrl("https://example.com/a")).toBe("https://example.com/a");
  });

  it("marks 2xx responses as accessible", async () => {
    const result = await probePublishLinkAccessibility("/geo/content/1/2", {
      baseUrl: "http://127.0.0.1:3000",
      fetchImpl: async () => new Response(null, { status: 200 }),
    });
    expect(result.accessible).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.checkedAt).toBeTruthy();
  });

  it("marks network failures as inaccessible", async () => {
    const result = await probePublishLinkAccessibility("https://missing.example", {
      fetchImpl: async () => {
        throw new Error("fetch failed");
      },
    });
    expect(result.accessible).toBe(false);
    expect(result.errorMessage).toContain("fetch failed");
  });
});
