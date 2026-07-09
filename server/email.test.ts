import { describe, expect, it } from "vitest";
import { formatSimpleEmailBody } from "./email";
import { isSmtpConfigured } from "./_core/env";

describe("GEO-V1.1 email notification", () => {
  it("formats simple email body with title, result, and view link", () => {
    const body = formatSimpleEmailBody({
      subject: "AI 能见度诊断完成",
      result: "示例企业的优化前基线 已完成。",
      viewUrl: "https://app.example.com/ai-diagnosis?projectId=1",
    });
    expect(body).toContain("标题：AI 能见度诊断完成");
    expect(body).toContain("结果：示例企业的优化前基线 已完成。");
    expect(body).toContain("查看：https://app.example.com/ai-diagnosis?projectId=1");
  });

  it("omits view line when url missing", () => {
    const body = formatSimpleEmailBody({
      subject: "内容发布成功",
      result: "已发布。",
      viewUrl: null,
    });
    expect(body).not.toContain("查看：");
  });

  it("reports SMTP as unconfigured in test env by default", () => {
    expect(isSmtpConfigured()).toBe(false);
  });
});
