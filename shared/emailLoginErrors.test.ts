import { describe, expect, it } from "vitest";
import {
  EMAIL_LOGIN_INVALID_CREDENTIALS,
  toEmailLoginErrorMessage,
} from "./emailLoginErrors";

describe("toEmailLoginErrorMessage", () => {
  it("maps UNAUTHORIZED to friendly credentials message", () => {
    expect(
      toEmailLoginErrorMessage({
        message: "UNAUTHORIZED",
        data: { code: "UNAUTHORIZED" },
      }),
    ).toBe(EMAIL_LOGIN_INVALID_CREDENTIALS);
  });

  it("preserves server credentials message", () => {
    expect(
      toEmailLoginErrorMessage({ message: EMAIL_LOGIN_INVALID_CREDENTIALS }),
    ).toBe(EMAIL_LOGIN_INVALID_CREDENTIALS);
  });

  it("replaces technical errors with fallback", () => {
    expect(
      toEmailLoginErrorMessage({
        message: "failed query: select * from users",
      }),
    ).toBe("登录失败，请稍后重试");
  });
});
