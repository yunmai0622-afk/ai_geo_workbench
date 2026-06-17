import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf-8");

describe("delivery report share page renders customer-facing sections", () => {
  it("exposes share routes and customer sections without engineering fields", () => {
    const appSource = readProjectFile("client/src/App.tsx");
    const shareSource = readProjectFile("client/src/pages/DeliveryReportSharePage.tsx");
    const publicSource = readProjectFile("client/src/pages/DeliveryReportPublicPage.tsx");
    const customerViewSource = readProjectFile("client/src/components/DeliveryReportCustomerView.tsx");
    const lightViewSource = readProjectFile("client/src/components/DeliveryReportCustomerLightView.tsx");
    const productBodySource = readProjectFile("client/src/components/delivery/DeliveryReportProductBody.tsx");
    const flowSource = readProjectFile("client/src/pages/V12FlowPages.tsx");
    const reportPageSource = readProjectFile("client/src/pages/DeliveryReportsCenterPage.tsx");
    const routerSource = readProjectFile("server/routers.ts");
    const renewalCardSource = readProjectFile("client/src/components/delivery/DeliveryReportShareRenewalReminderCard.tsx");

    expect(appSource).toContain('path="/delivery-reports/share/:projectId"');
    expect(appSource).toContain('path="/delivery-reports/public/:token"');
    expect(appSource).toContain('path="/delivery-reports/public/:token/evidence/:monitoringId/:resultIndex"');
    expect(appSource).toContain("DeliveryReportPublicEvidencePage");
    expect(appSource).toContain("DeliveryReportPublicPage");
    const routerBlock = appSource.slice(appSource.indexOf("function Router()"), appSource.indexOf("function App()"));
    expect(routerBlock.indexOf('path="/delivery-reports/public/:token"')).toBeLessThan(
      routerBlock.indexOf("<Route component={AuthenticatedAppShell}"),
    );
    expect(reportPageSource).toContain("AI 品牌成熟度月报");
    expect(reportPageSource).toContain("geo.monthlyPlan.getReport");
    expect(readProjectFile("HARNESS.md")).toContain("0019_delivery_report_share_tokens");
    expect(readProjectFile("HARNESS.md")).toContain("pnpm db:push");
    expect(routerSource).toContain("createShareLink");
    expect(routerSource).toContain("publicShare");
    expect(routerSource).toContain("publicEvidence");
    expect(routerSource).toContain("disableShareLink");
    expect(routerSource).toContain("regenerateShareLink");
    expect(routerSource).toContain("renewShareLink");
    expect(routerSource).toContain("publicProcedure");
    expect(renewalCardSource).toContain("delivery-report-share-renewal-reminder");
    expect(publicSource).toContain("buildDeliveryReportPublicEvidencePath");
    expect(publicSource).not.toContain("/geo/evidence/");

    for (const text of ["发布前后变化"]) {
      const customerPages = customerViewSource + lightViewSource + publicSource + shareSource;
      expect(customerPages).toContain(text);
    }
    expect(publicSource).toContain('variant="light"');
    expect(publicSource).toContain("shareExpiresAt");
    expect(lightViewSource).toContain("主要检测结论");
    expect(lightViewSource).toContain("delivery-report-public-share-expiry");
    expect(readProjectFile("shared/deliveryReportPublicShare.ts")).toContain("DELIVERY_REPORT_SHARE_VALIDITY_DAYS");
    expect(readProjectFile("shared/deliveryReportPublicShare.ts")).toContain("DELIVERY_REPORT_SHARE_RENEWAL_REMINDER_DAYS");
    expect(readProjectFile("shared/deliveryReportPublicShare.ts")).toContain("resolveDeliveryReportShareRenewalReminder");
    expect(shareSource).toContain('variant="light"');
    expect(lightViewSource).toContain("GEO 增长交付报告");
    expect(lightViewSource).toContain("查看原始 AI 回答证据");
    expect(productBodySource).toContain("delivery-report-boss-summary");
    for (const text of ["经营结论", "本轮报告摘要", "AI 搜索实测结果", "查看完整证据", "查看证据"]) {
      expect(customerViewSource).toContain(text);
    }
    expect(flowSource).toContain("DeliveryReportsCenterPage");
    expect(readProjectFile("shared/deliveryReportPublicShare.ts")).toContain(
      "报告链接无效或已失效，请联系服务人员重新获取",
    );
  });
});
