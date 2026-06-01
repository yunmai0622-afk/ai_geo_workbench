import { describe, expect, it } from "vitest";
import {
  compareLocalAgentSemver,
  isLocalAgentClientOutdated,
  normalizeLocalAgentVersion,
} from "./localAgentVersionCompare";

describe("localAgentVersionCompare", () => {
  it("normalizes v prefix", () => {
    expect(normalizeLocalAgentVersion("v1.0.15")).toBe("1.0.15");
  });

  it("compares semver tuples", () => {
    expect(compareLocalAgentSemver("1.0.14", "1.0.15")).toBe(-1);
    expect(compareLocalAgentSemver("1.0.15", "1.0.15")).toBe(0);
    expect(compareLocalAgentSemver("1.1.0", "1.0.15")).toBe(1);
    expect(compareLocalAgentSemver("v1.0.14", "1.0.15")).toBe(-1);
  });

  it("detects outdated client", () => {
    expect(isLocalAgentClientOutdated("1.0.14", "1.0.15")).toBe(true);
    expect(isLocalAgentClientOutdated("1.0.15", "1.0.15")).toBe(false);
    expect(isLocalAgentClientOutdated("1.0.16", "1.0.15")).toBe(false);
    expect(isLocalAgentClientOutdated("1.0.15", "1.0.16")).toBe(true);
    expect(compareLocalAgentSemver("1.0.16", "1.0.16")).toBe(0);
  });

  it("returns null for unparseable versions", () => {
    expect(compareLocalAgentSemver("beta", "1.0.0")).toBeNull();
    expect(isLocalAgentClientOutdated("beta", "1.0.0")).toBe(false);
  });
});
