import { describe, expect, it } from "vitest";
import {
  GENERIC_FORBIDDEN_MESSAGE,
  GENERIC_OPERATION_FAILED_MESSAGE,
  GENERIC_SERVER_ERROR_MESSAGE,
  GENERIC_SERVICE_UNAVAILABLE_MESSAGE,
  GENERIC_UNAUTHORIZED_MESSAGE,
  looksLikeInternalTechnicalError,
  toUserFacingError,
  toUserFacingErrorFromUnknown,
  toUserFacingQueryError,
} from "./userFacingErrors";

describe("userFacingErrors", () => {
  it("keeps business-facing Chinese messages", () => {
    expect(toUserFacingError("请先完成企业档案建档")).toBe("请先完成企业档案建档");
    expect(toUserFacingError("项目不存在或无访问权限")).toBe("项目不存在或无访问权限");
  });

  it("filters SQL and stack traces", () => {
    expect(looksLikeInternalTechnicalError("Failed query: insert into projects (ownerUserId) values (1)")).toBe(true);
    expect(toUserFacingError("Error: stack trace\n    at Object.handler (/app/server.ts:12:3)")).toBe(
      GENERIC_OPERATION_FAILED_MESSAGE,
    );
  });

  it("filters technical ids and engineering terms", () => {
    expect(toUserFacingError("questionId=42 not found for roundId=7")).toBe(GENERIC_OPERATION_FAILED_MESSAGE);
    expect(toUserFacingError("rawAnswer is empty")).toBe(GENERIC_OPERATION_FAILED_MESSAGE);
    expect(toUserFacingError("tenantId mismatch")).toBe(GENERIC_OPERATION_FAILED_MESSAGE);
    expect(toUserFacingError("provider adapter mock failed")).toBe(GENERIC_OPERATION_FAILED_MESSAGE);
    expect(toUserFacingError("schema validation error on field x")).toBe(GENERIC_OPERATION_FAILED_MESSAGE);
  });

  it("filters TRPC error codes", () => {
    expect(toUserFacingError("NOT_FOUND")).toBe(GENERIC_OPERATION_FAILED_MESSAGE);
    expect(toUserFacingError("UNAUTHORIZED")).toBe(GENERIC_UNAUTHORIZED_MESSAGE);
  });

  it("maps unknown errors with fallback", () => {
    expect(toUserFacingErrorFromUnknown(new Error("projectId invalid"))).toBe(GENERIC_OPERATION_FAILED_MESSAGE);
    expect(toUserFacingErrorFromUnknown(new Error("密码不正确"), "注册失败")).toBe("密码不正确");
    expect(toUserFacingQueryError("Internal Server Error")).toBe(GENERIC_SERVER_ERROR_MESSAGE);
  });

  it("maps known auth/network/server errors to user-facing messages", () => {
    expect(toUserFacingError("Please login (10001)")).toBe(GENERIC_UNAUTHORIZED_MESSAGE);
    expect(toUserFacingError("You do not have required permission (10002)")).toBe(GENERIC_FORBIDDEN_MESSAGE);
    expect(toUserFacingError("FORBIDDEN")).toBe(GENERIC_FORBIDDEN_MESSAGE);
    expect(toUserFacingError("UNAUTHORIZED")).toBe(GENERIC_UNAUTHORIZED_MESSAGE);
    expect(toUserFacingError("INTERNAL_SERVER_ERROR")).toBe(GENERIC_SERVER_ERROR_MESSAGE);
    expect(toUserFacingError("Failed to fetch")).toBe(GENERIC_SERVICE_UNAVAILABLE_MESSAGE);
  });
});
