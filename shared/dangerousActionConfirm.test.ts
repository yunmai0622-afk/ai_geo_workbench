import { describe, expect, it } from "vitest";
import {
  buildDangerousActionConfirmMessage,
  DANGEROUS_ACTION_LABELS,
} from "./dangerousActionConfirm";

describe("dangerousActionConfirm", () => {
  it("builds standard irreversible confirm copy", () => {
    expect(buildDangerousActionConfirmMessage(DANGEROUS_ACTION_LABELS.deleteContent)).toBe(
      "确认要删除内容吗？此操作无法撤销。",
    );
    expect(buildDangerousActionConfirmMessage(DANGEROUS_ACTION_LABELS.archiveProject)).toBe(
      "确认要归档项目吗？此操作无法撤销。",
    );
    expect(buildDangerousActionConfirmMessage(DANGEROUS_ACTION_LABELS.resetT0Detection)).toBe(
      "确认要重置优化前检测吗？此操作无法撤销。",
    );
  });
});
