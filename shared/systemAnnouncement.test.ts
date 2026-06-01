import { describe, expect, it } from "vitest";
import {
  SYSTEM_ANNOUNCEMENT_DISMISS_STORAGE_KEY,
  shouldShowSystemAnnouncement,
} from "./systemAnnouncement";

describe("systemAnnouncement", () => {
  it("hides when disabled or empty body", () => {
    expect(
      shouldShowSystemAnnouncement(
        { enabled: false, body: "hi", versionKey: "v1" },
        null,
      ),
    ).toBe(false);
    expect(
      shouldShowSystemAnnouncement(
        { enabled: true, body: "   ", versionKey: "v1" },
        null,
      ),
    ).toBe(false);
  });

  it("shows until dismissed for same version", () => {
    const ann = { enabled: true, body: "维护通知", versionKey: "2026-06-01T00:00:00.000Z" };
    expect(shouldShowSystemAnnouncement(ann, null)).toBe(true);
    expect(shouldShowSystemAnnouncement(ann, "other")).toBe(true);
    expect(shouldShowSystemAnnouncement(ann, ann.versionKey)).toBe(false);
  });

  it("uses stable localStorage key", () => {
    expect(SYSTEM_ANNOUNCEMENT_DISMISS_STORAGE_KEY).toBe("geo.systemAnnouncement.dismissedVersion");
  });
});
