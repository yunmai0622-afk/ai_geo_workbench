import { describe, expect, it } from "vitest";
import {
  collectBoundProfileIdsForHealthCheck,
  collectExpiredPublishAccounts,
  filterSnapshotEntriesForProfiles,
  formatPublishAccountLastValidAt,
  isPublishAccountSessionExpired,
  selectSnapshotEntriesForProjectSync,
} from "./publishAccountHealthCheck";
import type { LocalAgentAccountStatusEntry } from "./localAgentAccountSync";

describe("publishAccountHealthCheck", () => {
  it("detects expired enabled binding accounts", () => {
    const expired = collectExpiredPublishAccounts([
      {
        platform: "zhihu",
        accounts: [
          { id: 1, accountName: "A", isEnabled: true, localProfileId: "p1", sessionStatus: "expired" },
          { id: 2, accountName: "B", isEnabled: true, localProfileId: "p2", sessionStatus: "active" },
          { id: 3, accountName: "C", isEnabled: false, localProfileId: "p3", sessionStatus: "expired" },
        ],
      },
    ]);
    expect(expired).toHaveLength(1);
    expect(expired[0]?.accountName).toBe("A");
  });

  it("tolerates missing nested accounts arrays", () => {
    expect(collectExpiredPublishAccounts([{ platform: "zhihu", accounts: undefined as unknown as [] }])).toEqual(
      [],
    );
    expect(collectBoundProfileIdsForHealthCheck([{ platform: "zhihu", accounts: undefined as unknown as [] }])).toEqual(
      [],
    );
  });

  it("collects profile ids for enabled bound accounts", () => {
    expect(
      collectBoundProfileIdsForHealthCheck([
        {
          platform: "zhihu",
          accounts: [
            { id: 1, accountName: "A", isEnabled: true, localProfileId: " p1 ", sessionStatus: "active" },
            { id: 2, accountName: "B", isEnabled: false, localProfileId: "p2", sessionStatus: "active" },
          ],
        },
      ]),
    ).toEqual(["p1"]);
  });

  it("filters snapshot entries by profile id", () => {
    const snapshots: LocalAgentAccountStatusEntry[] = [
      {
        platform: "zhihu",
        profileId: "p1",
        displayName: "A",
        displayNameVerified: true,
        loginStatus: "valid",
        lastCheckedAt: "2026-06-01T00:00:00.000Z",
      },
      {
        platform: "zhihu",
        profileId: "p9",
        displayName: null,
        displayNameVerified: false,
        loginStatus: "invalid",
        lastCheckedAt: "2026-06-01T00:00:00.000Z",
      },
    ];
    expect(filterSnapshotEntriesForProfiles(snapshots, ["p1"]).map(e => e.profileId)).toEqual(["p1"]);
  });

  it("selectSnapshotEntriesForProjectSync syncs all valid when no bound profiles", () => {
    const snapshots: LocalAgentAccountStatusEntry[] = [
      {
        platform: "zhihu",
        profileId: "p1",
        displayName: "A",
        displayNameVerified: true,
        loginStatus: "valid",
        lastCheckedAt: "2026-06-01T00:00:00.000Z",
      },
      {
        platform: "zhihu",
        profileId: "p9",
        displayName: null,
        displayNameVerified: false,
        loginStatus: "invalid",
        lastCheckedAt: "2026-06-01T00:00:00.000Z",
      },
    ];
    expect(selectSnapshotEntriesForProjectSync(snapshots, []).map(e => e.profileId)).toEqual(["p1"]);
    expect(selectSnapshotEntriesForProjectSync(snapshots, ["p1"]).map(e => e.profileId)).toEqual(["p1"]);
  });

  it("formats last valid time for customer copy", () => {
    expect(formatPublishAccountLastValidAt(null)).toBe("暂无记录");
    expect(isPublishAccountSessionExpired("expired")).toBe(true);
    expect(isPublishAccountSessionExpired("active")).toBe(false);
  });
});
