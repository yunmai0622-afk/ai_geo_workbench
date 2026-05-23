import { describe, expect, it } from "vitest";
import {
  buildPublishErrorPayload,
  customerMessageForPublishError,
  parsePublishTaskErrorMessage,
  publishTaskStatusCustomerLabel,
} from "./publishTaskErrors";

describe("publishTaskErrors", () => {
  it("maps editor_not_found with step for customer message", () => {
    const msg = customerMessageForPublishError("editor_not_found", "wait_editor_ready");
    expect(msg).toContain("步骤");
    expect(msg).toContain("wait_editor_ready");
  });

  it("parses legacy 等待编辑器超时 as editor_not_found", () => {
    const parsed = parsePublishTaskErrorMessage("等待编辑器超时");
    expect(parsed?.errorType).toBe("editor_not_found");
    expect(parsed?.step).toBe("wait_editor_ready");
  });

  it("builds JSON error payload", () => {
    const p = buildPublishErrorPayload({
      errorType: "account_mismatch",
      step: "verify_account",
    });
    const parsed = parsePublishTaskErrorMessage(p.errorMessage);
    expect(parsed?.errorType).toBe("account_mismatch");
  });

  it("shows draft_saved status label", () => {
    expect(publishTaskStatusCustomerLabel({ status: "draft_saved" })).toBe("已保存草稿");
  });
});
