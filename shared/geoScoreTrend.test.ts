import { describe, expect, it } from "vitest";
import { buildGeoScoreTrendSvgCoords, geoScoreTrendPolyline } from "./geoScoreTrend";

describe("buildGeoScoreTrendSvgCoords", () => {
  it("maps two scores to ascending x and inverted y", () => {
    const coords = buildGeoScoreTrendSvgCoords(
      [
        { totalScore: 40, createdAt: "2026-01-01" },
        { totalScore: 80, createdAt: "2026-01-02" },
      ],
      200,
      100,
      10,
    );
    expect(coords).toHaveLength(2);
    expect(coords[0]!.x).toBeLessThan(coords[1]!.x);
    expect(coords[1]!.y).toBeLessThan(coords[0]!.y);
    expect(geoScoreTrendPolyline(coords)).toContain(" ");
  });
});
