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
    const flowSource = readProjectFile("client/src/pages/V12FlowPages.tsx");
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
    expect(flowSource).toContain("复制客户报告链接");
    expect(flowSource).toContain("客户报告链接已复制。该链接长期有效，请仅发送给对应客户");
    expect(flowSource).toContain("长期有效");
    expect(flowSource).toContain("仅发送给对应客户");
    const copyToastLine = flowSource.match(/toast\.success\("客户报告链接已复制[^"]*"\)/)?.[0] ?? "";
    expect(copyToastLine.length).toBeGreaterThan(0);
    for (const forbidden of ["shareToken", "projectId", "migration"]) {
      expect(copyToastLine).not.toContain(forbidden);
    }
    expect(readProjectFile("HARNESS.md")).toContain("0019_delivery_report_share_tokens");
    expect(readProjectFile("HARNESS.md")).toContain("pnpm db:push");
    expect(flowSource).toContain("createShareLink");
    expect(flowSource).toContain("disableShareLink");
    expect(flowSource).toContain("regenerateShareLink");
    expect(flowSource).toContain("重新生成客户报告链接");
    expect(flowSource).toContain("禁用客户报告链接");
    expect(flowSource).toContain("新的客户报告链接已生成并复制");
    expect(flowSource).toContain("客户报告链接已禁用，原链接将无法访问");
    expect(flowSource).toContain("当前暂无可禁用的客户报告链接");
    expect(flowSource).toContain("确定要禁用当前客户报告链接吗？");
    expect(flowSource).toContain("禁用后，客户将无法通过原链接查看报告和证据");
    expect(flowSource).toContain("确定要重新生成客户报告链接吗？");
    expect(flowSource).toContain("重新生成后，旧链接将立即失效");
    expect(flowSource).toContain("window.confirm");
    expect(flowSource).toContain("sharePath");
    expect(flowSource).not.toContain("buildDeliveryReportSharePath");
    expect(readProjectFile("shared/deliveryReportPublicShare.ts")).toContain("/delivery-reports/public/");
    expect(routerSource).toContain("createShareLink");
    expect(routerSource).toContain("publicShare");
    expect(routerSource).toContain("publicEvidence");
    expect(routerSource).toContain("disableShareLink");
    expect(routerSource).toContain("regenerateShareLink");
    expect(routerSource).toContain("publicProcedure");
    expect(publicSource).toContain("buildDeliveryReportPublicEvidencePath");
    expect(publicSource).not.toContain("/geo/evidence/");

    for (const text of [
      "AI 搜索可见度评分",
      "经营结论",
      "本轮报告摘要",
      "AI 搜索实测结果",
      "发布前后变化",
      "本轮新增 AI 搜索资产",
      "下一轮优化动作",
      "查看完整证据",
      "查看证据",
      "暂无 AI 搜索实测数据。建议先完成一次 AI 实测，以生成可追溯的品牌可见度结果。",
    ]) {
      const customerPages = customerViewSource + publicSource + shareSource;
      expect(customerPages).toContain(text);
    }
    expect(flowSource).toContain("DeliveryReportCustomerView");
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
    }

    expect(readProjectFile("drizzle/schema.ts")).toContain("delivery_report_share_tokens");
    expect(serverShareSource).toContain("deliveryReportShareTokens");
    expect(JSON.stringify(publicSource + customerViewSource)).not.toContain("projectId");
  });
});
