import { describe, expect, it } from "vitest";
import {
  buildPublishErrorPayload,
  customerMessageForAgentPublishFailure,
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
    expect(publishTaskStatusCustomerLabel({ status: "draft_saved" })).toBe(
      "草稿已保存，请在平台确认发布",
    );
  });

  it("maps agent failure messages for customers", () => {
    expect(
      customerMessageForAgentPublishFailure("profile_not_found: zhihu_xxx", "profile_not_found"),
    ).toBe("账号环境未找到，请重新绑定账号");
    expect(customerMessageForAgentPublishFailure("account_mismatch", null)).toBe(
      "登录账号与绑定账号不一致",
    );
    expect(customerMessageForAgentPublishFailure("title_input_not_found", null)).toBe(
      "未找到标题输入框，请重试",
    );
    expect(
      customerMessageForAgentPublishFailure(
        "publish_flow [failed] locator.count: Target page, context or browser has been closed",
        null,
      ),
    ).toBe("发布过程中断，请重试");
    expect(customerMessageForAgentPublishFailure("something weird", null)).toBe(
      "发布失败，请重试或联系支持",
    );
  });
});
