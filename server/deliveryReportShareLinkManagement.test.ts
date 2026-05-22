import { describe, expect, it } from "vitest";
import { generateDeliveryReportShareToken, isShareTokenRowActive } from "./deliveryReportPublicShare";

type ShareRow = { token: string; projectId: number; isEnabled: boolean; expiresAt: Date | null };

function resolveTokenAccess(rows: ShareRow[], token: string): boolean {
  const row = rows.find(r => r.token === token);
  return isShareTokenRowActive(row);
}

function disableProjectTokens(rows: ShareRow[], projectId: number): boolean {
  let changed = false;
  for (const row of rows) {
    if (row.projectId === projectId && row.isEnabled) {
      row.isEnabled = false;
      changed = true;
    }
  }
  return changed;
}

function regenerateProjectToken(rows: ShareRow[], projectId: number): string {
  disableProjectTokens(rows, projectId);
  const next = generateDeliveryReportShareToken();
  rows.push({ token: next, projectId, isEnabled: true, expiresAt: null });
  return next;
}

describe("delivery report share link management", () => {
  it("disableShareLink invalidates public report and evidence access", () => {
    const rows: ShareRow[] = [{ token: "active-tok", projectId: 1, isEnabled: true, expiresAt: null }];
    expect(resolveTokenAccess(rows, "active-tok")).toBe(true);
    expect(disableProjectTokens(rows, 1)).toBe(true);
    expect(resolveTokenAccess(rows, "active-tok")).toBe(false);
    expect(isShareTokenRowActive({ isEnabled: false, expiresAt: null })).toBe(false);
  });

  it("regenerateShareLink disables old token and returns new token", () => {
    const rows: ShareRow[] = [{ token: "legacy-tok", projectId: 2, isEnabled: true, expiresAt: null }];
    const next = regenerateProjectToken(rows, 2);
    expect(next).not.toBe("legacy-tok");
    expect(resolveTokenAccess(rows, "legacy-tok")).toBe(false);
    expect(resolveTokenAccess(rows, next)).toBe(true);
    expect(rows.filter(r => r.projectId === 2)).toHaveLength(2);
  });

  it("share link management does not remove report or test rows", () => {
    const reportRows = [{ id: 1, markdown: "report-body" }];
    const monitoringRows = [{ id: 10, aiTestResults: [{ answer: "x" }] }];
    const shareRows: ShareRow[] = [{ token: "t1", projectId: 3, isEnabled: true, expiresAt: null }];

    regenerateProjectToken(shareRows, 3);
    disableProjectTokens(shareRows, 3);

    expect(reportRows).toHaveLength(1);
    expect(monitoringRows[0].aiTestResults).toHaveLength(1);
    expect(shareRows).toHaveLength(2);
    expect(shareRows.every(r => r.token)).toBe(true);
  });
});
