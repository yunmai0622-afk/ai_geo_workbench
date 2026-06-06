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
    const flowSource = readProjectFile("client/src/pages/V12FlowPages.tsx");
    const reportPageSource = readProjectFile("client/src/pages/DeliveryReportsCenterPage.tsx");
    const reportUiSource = flowSource + reportPageSource;
    const routerSource = readProjectFile("server/routers.ts");
    const serverShareSource = readProjectFile("server/deliveryReportPublicShare.ts");

    expect(appSource).toContain('path="/delivery-reports/share/:projectId"');
    expect(appSource).toContain('path="/delivery-reports/public/:token"');
    expect(appSource).toContain('path="/delivery-reports/public/:token/evidence/:monitoringId/:resultIndex"');
    expect(appSource).toContain("DeliveryReportPublicEvidencePage");
    expect(appSource).toContain("DeliveryReportPublicPage");
    const routerBlock = appSource.slice(appSource.indexOf("function Router()"), appSource.indexOf("function App()"));
    expect(routerBlock.indexOf('path="/delivery-reports/public/:token"')).toBeLessThan(
      routerBlock.indexOf("<Route component={AuthenticatedAppShell}"),
    );
    expect(reportPageSource).toContain("生成分享链接");
    expect(reportPageSource).toContain("delivery-report-share-primary");
    expect(reportPageSource).toContain("shareLinkStatus");
    expect(reportPageSource).toContain("复制客户报告链接");
    expect(reportPageSource).toContain("客户报告链接已复制");
    const copyToastLine =
      reportPageSource.match(/toast\.success\([^)]*客户报告链接已复制[^)]*\)/)?.[0] ?? "";
    expect(copyToastLine.length).toBeGreaterThan(0);
    for (const forbidden of ["shareToken", "projectId", "migration"]) {
      expect(copyToastLine).not.toContain(forbidden);
    }
    expect(readProjectFile("HARNESS.md")).toContain("0019_delivery_report_share_tokens");
    expect(readProjectFile("HARNESS.md")).toContain("pnpm db:push");
    expect(reportPageSource).toContain("createShareLink");
    expect(reportPageSource).toContain("disableShareLink");
    expect(reportPageSource).toContain("regenerateShareLink");
    expect(reportPageSource).toContain("renewShareLink");
    expect(reportPageSource).toContain("DeliveryReportShareRenewalReminderCard");
    expect(readProjectFile("client/src/components/delivery/DeliveryReportShareRenewalReminderCard.tsx")).toContain(
      "delivery-report-share-renewal-reminder",
    );
    expect(reportPageSource).toContain("链接已续期");
    expect(reportPageSource).toContain("重新生成链接");
    expect(reportPageSource).toContain("禁用链接");
    expect(reportPageSource).toContain("新链接已生成，旧链接已失效");
    expect(reportPageSource).toContain("客户报告链接已禁用");
    expect(reportPageSource).toContain("确定要禁用当前客户报告链接吗？");
    expect(reportPageSource).toContain("禁用后，客户将无法通过原链接查看报告和证据");
    expect(reportPageSource).toContain("确定要重新生成客户报告链接吗？");
    expect(reportPageSource).toContain("重新生成后，旧链接将立即失效");
    expect(reportPageSource).toContain("window.confirm");
    expect(reportPageSource).toContain("sharePath");
    expect(reportUiSource).not.toContain("buildDeliveryReportSharePath");
    expect(readProjectFile("shared/deliveryReportPublicShare.ts")).toContain("/delivery-reports/public/");
    expect(routerSource).toContain("createShareLink");
    expect(routerSource).toContain("publicShare");
    expect(routerSource).toContain("publicEvidence");
    expect(routerSource).toContain("disableShareLink");
    expect(routerSource).toContain("regenerateShareLink");
    expect(routerSource).toContain("renewShareLink");
    expect(routerSource).toContain("publicProcedure");
    expect(publicSource).toContain("buildDeliveryReportPublicEvidencePath");
    expect(publicSource).not.toContain("/geo/evidence/");

    for (const text of [
      "AI 搜索可见度评分",
      "发布前后变化",
      "本轮新增 AI 搜索资产",
      "下一轮优化动作",
    ]) {
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
    for (const text of [
      "GEO AI 搜索可见度优化交付报告",
      "老板先看这 3 点",
      "本轮你获得了什么",
      "查看原始 AI 回答证据",
    ]) {
      expect(lightViewSource + publicSource + shareSource).toContain(text);
    }
    for (const text of ["经营结论", "本轮报告摘要", "AI 搜索实测结果", "查看完整证据", "查看证据"]) {
      expect(customerViewSource).toContain(text);
    }
    expect(lightViewSource + publicSource).toContain(
      "暂无 AI 搜索实测数据。建议先完成一次 AI 实测，以建立可追溯的可见度基线。",
    );
    expect(flowSource).toContain("DeliveryReportsCenterPage");
    expect(readProjectFile("shared/deliveryReportPublicShare.ts")).toContain(
      "报告链接无效或已失效，请联系服务人员重新获取",
    );
    expect(readProjectFile("shared/deliveryReportPublicShare.ts")).toContain("publishedContent");
    expect(readProjectFile("server/deliveryReportPublicShare.ts")).toContain("geoPublishRecords");

    for (const forbidden of [
      "rawAnswer",
      "taskId",
      "provider",
      "adapter",
      "mock",
      "schema",
      "testStage",
      "before_publish",
      "after_publish",
      "manual_check",
      "aiTestResults",
      "ProjectSelector",
      "内容诊断结果",
      "优化任务清单",
      "DashboardLayout",
    ]) {
      expect(publicSource).not.toContain(forbidden);
      expect(customerViewSource).not.toContain(forbidden);
      expect(lightViewSource).not.toContain(forbidden);
    }

    expect(readProjectFile("drizzle/schema.ts")).toContain("delivery_report_share_tokens");
    expect(serverShareSource).toContain("deliveryReportShareTokens");
    expect(publicSource).not.toContain("projectId");

    expect(reportPageSource).toContain("复制链接");
    expect(reportPageSource).toContain("showShareQrCode");
    expect(reportPageSource).toContain("api.qrserver.com");
    expect(reportPageSource).toContain("客户报告分享二维码");
    expect(publicSource).toContain("document.title");
    expect(publicSource).toContain("GEO 交付报告");
    expect(lightViewSource).toContain("有效期剩余");
    expect(lightViewSource).toContain("resolveDeliveryReportShareCountdown");
  });
});
