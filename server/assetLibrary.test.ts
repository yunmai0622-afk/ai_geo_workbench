import { describe, expect, it } from "vitest";

import {
  assertNoPlainCredentialKeys,
  buildAssetEvidencePack,
  calculateProfileCompletionScore,
  createUploadAssetDbRecord,
  sanitizePlatformAuthorizationInput,
  validateCustomerCaseInput,
  type AssetSourceForEvidence,
} from "./assetLibrary";

describe("V1.2 enterprise GEO asset library", () => {
  it("rejects platform authorization configs containing plain credential fields or notes", () => {
    expect(() => assertNoPlainCredentialKeys({ platformName: "知乎", password: "123456" })).toThrow("明文凭证字段");
    expect(() => assertNoPlainCredentialKeys({ platformName: "小红书", authorizationNotes: "账号密码：demo/123456" })).toThrow("不能保存明文密码");
    expect(() => assertNoPlainCredentialKeys({ platformName: "知乎", secureCredentialRef: "password=demo123" })).toThrow("凭证引用不能保存明文密码");

    const safe = sanitizePlatformAuthorizationInput({
      platformName: "公众号",
      accountAlias: "brand***@example.com",
      authorizationNotes: "由客户线下授权，凭证存放在安全凭证系统中。",
      secureCredentialRef: "secrets:wechat-oauth-ref",
    });

    expect(safe.credentialStorageMode).toBe("不保存明文凭证");
    expect(Object.keys(safe)).not.toContain("password");
  });

  it("prevents fabricated real customer cases without source evidence", () => {
    expect(() => validateCustomerCaseInput({
      caseType: "真实案例",
      customerName: "某制造企业",
      sourceAssetIds: [],
    })).toThrow("不能无来源编造案例");

    expect(validateCustomerCaseInput({
      caseType: "待补充案例线索",
      customerName: "待确认客户",
      sourceAssetIds: [],
    }).sourceAssetIds).toEqual([]);

    expect(validateCustomerCaseInput({
      caseType: "真实案例",
      customerName: "华东设备厂",
      sourceAssetIds: [11],
    }).sourceAssetIds).toEqual([11]);
  });

  it("builds generation evidence only from confirmed and allowed asset sources", () => {
    const usable: AssetSourceForEvidence = {
      id: 7,
      title: "售后服务流程资料",
      sourceType: "产品服务资料",
      trustLevel: "高",
      canUseForGeneration: 1,
      manuallyConfirmed: 1,
      structuredSummary: { digest: "客户提供的售后服务流程" },
      contentDigest: "包含服务流程、交付方式和售后边界。",
    };

    const evidence = buildAssetEvidencePack([usable]);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ assetId: 7, title: "售后服务流程资料", sourceType: "产品服务资料" });

    expect(() => buildAssetEvidencePack([{ ...usable, id: 8, title: "未确认资料", manuallyConfirmed: 0 }])).toThrow("尚未人工确认");
    expect(() => buildAssetEvidencePack([{ ...usable, id: 9, title: "不可生成资料", canUseForGeneration: 0 }])).toThrow("未允许用于内容生成");
  });

  it("creates upload records without storing file bytes in database fields", () => {
    const record = createUploadAssetDbRecord({
      projectId: 1,
      sourceType: "企业基础资料",
      title: "企业介绍 PDF",
      originalFileName: "company.pdf",
      fileKey: "asset-sources/1/123-company.pdf",
      fileUrl: "/manus-storage/asset-sources/1/123-company.pdf",
      mimeType: "application/pdf",
      contentDigest: "企业介绍、产品服务与目标客户摘要。",
      trustLevel: "高",
      isPublic: false,
      canUseForGeneration: true,
      manuallyConfirmed: true,
    });

    expect(record.fileKey).toContain("asset-sources/1/");
    expect(record.fileUrl).toContain("/manus-storage/");
    expect(record).not.toHaveProperty("fileBase64");
    expect(record).not.toHaveProperty("fileBytes");
    expect(record).not.toHaveProperty("content");
    expect(record.structuredSummary).toMatchObject({ title: "企业介绍 PDF" });
  });

  it("calculates profile completion so the UI can show next action and risk reminders", () => {
    expect(calculateProfileCompletionScore(null)).toBe(0);
    const score = calculateProfileCompletionScore({
      enterpriseName: "清源智能",
      industry: "工业知识库",
      productServiceIntro: "面向制造企业的售后知识库与客服自动化系统",
      salesChannels: ["官网", "销售顾问"],
    });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });
});
