import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_WHITE_LABEL_CONFIG,
  resolveWhiteLabelConfig,
} from "../client/src/lib/whiteLabel";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("GEO V2.3 OEM white-label readiness", () => {
  it("uses neutral defaults when OEM variables are absent", () => {
    expect(resolveWhiteLabelConfig({})).toEqual(DEFAULT_WHITE_LABEL_CONFIG);
    expect(DEFAULT_WHITE_LABEL_CONFIG.agencyName).toBe("GEO 代运营交付系统");
    expect(DEFAULT_WHITE_LABEL_CONFIG.reportBrandName).toBe("GEO 服务团队");
  });

  it("supports safe single-deployment environment overrides", () => {
    expect(resolveWhiteLabelConfig({
      OEM_AGENCY_NAME: "星河 AI 服务中心",
      OEM_LOGO_URL: "https://cdn.example.com/logo.svg",
      OEM_BRAND_COLOR: "#123ABC",
      OEM_LOGIN_TITLE: "星河 AI 可见度系统",
      OEM_LOGIN_SUBTITLE: "让品牌更容易被 AI 看见",
      OEM_REPORT_BRAND_NAME: "星河 GEO 服务团队",
      OEM_SUPPORT_CONTACT: "service@example.com",
      OEM_POWERED_BY_VISIBLE: "false",
    })).toEqual({
      agencyName: "星河 AI 服务中心",
      brandLogoUrl: "https://cdn.example.com/logo.svg",
      brandColor: "#123ABC",
      loginTitle: "星河 AI 可见度系统",
      loginSubtitle: "让品牌更容易被 AI 看见",
      reportBrandName: "星河 GEO 服务团队",
      supportContact: "service@example.com",
      poweredByVisible: false,
    });
  });

  it("falls back cleanly when logo and color are not configured or invalid", () => {
    const config = resolveWhiteLabelConfig({ OEM_LOGO_URL: "", OEM_BRAND_COLOR: "red" });
    expect(config.brandLogoUrl).toBeNull();
    expect(config.brandColor).toBeNull();
  });

  it("keeps OEM service provider separate from the customer project", () => {
    const report = read("client/src/components/DeliveryReportCustomerLightView.tsx");
    const reportCenter = read("client/src/pages/DeliveryReportsCenterPage.tsx");
    const workspace = read("client/src/pages/EnterpriseWorkspacePage.tsx");
    expect(report).toContain("服务方");
    expect(report).toContain("服务对象");
    expect(report).toContain("DELIVERY_REPORT_SERVICE_PROVIDER");
    expect(reportCenter).toContain("whiteLabel.reportBrandName");
    expect(workspace).toContain("whiteLabel.agencyName");
    expect(read("client/src/lib/deliveryReportLightDisplay.ts")).not.toContain('= "海豚知道"');
  });

  it("does not leak infrastructure or internal fields in white-label customer surfaces", () => {
    const customerFiles = [
      "client/src/components/auth/AuthMarketingPanel.tsx",
      "client/src/components/auth/LoginGatePanel.tsx",
      "client/src/components/DeliveryReportCustomerLightView.tsx",
      "client/src/pages/EnterpriseWorkspacePage.tsx",
      "client/src/pages/ClientDashboardPage.tsx",
    ].map(read).join("\n");
    expect(customerFiles).not.toMatch(/Manus|Railway|taskId|sourceType|OpenAI|Tavily|Internal API/i);
  });
});
