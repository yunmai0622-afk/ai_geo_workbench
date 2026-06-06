import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 LocalAgentDownloadCard status hard sync P0", () => {
  const card = read("client/src/components/LocalAgentDownloadCard.tsx");
  const shared = read("shared/localAgentConnectionStatus.ts");

  it("LocalAgentDownloadCard uses unified resolved state, not HTTP-only", () => {
    expect(card).toContain("resolveLocalAgentConnectionState");
    expect(card).toContain("deriveLocalAgentUiConnectionStatus");
    expect(card).toContain("isLocalAgentResolvedConnected");
    expect(card).toContain("localAgentConnectionCheckFeedback");
    expect(card).toContain("localAgentDownloadCardConnectionDetail");
    expect(card).toContain("geo.platformAccounts.list.useQuery");
    expect(card).toContain("resolveServerContextForDetect");
    expect(card).toContain("refresh-local-agent-account-status");
    expect(card).toContain("selectSnapshotEntriesForProjectSync");
    expect(card).not.toContain("未检测到本地发布客户端，请下载安装并启动后重试");
    expect(card).not.toContain("未检测到本地发布客户端。请先下载安装并启动");
    expect(card).toContain("void refreshHealth()");
    expect(card).toMatch(/useEffect\(\(\)\s*=>\s*\{[^}]*refreshHealth/);
  });

  it("all LocalAgentDownloadCard entry points pass projectId for self-fetch", () => {
    const publishPage = read("client/src/pages/ContentPublishingCenterPage.tsx");
    const overview = read("client/src/components/platformAccounts/PublishPlatformAccountsOverview.tsx");
    const matrix = read("client/src/components/platformAccounts/PlatformAccountMatrix.tsx");
    const enterprise = read("client/src/components/enterpriseProfile/EnterprisePublishEnvironmentSection.tsx");

    expect(publishPage).toContain("projectId={selectedProjectId");
    expect(overview).toContain("projectId={projectId}");
    expect(matrix).toContain("projectId={projectId}");
    expect(enterprise).toContain("projectId={projectId}");
  });

  it("legacy offline copy removed from binding matrix", () => {
    const matrix = read("client/src/components/platformAccounts/PlatformAccountMatrix.tsx");
    const binding = read("client/src/components/platformAccounts/usePlatformAccountBinding.ts");
    expect(matrix).not.toContain("未检测到本地发布客户端。请先下载安装并启动 GEO 发布客户端后重试。");
    expect(binding).not.toContain("未检测到本地发布客户端。请先下载安装并启动 GEO 发布客户端后重试。");
    expect(binding).toContain("resolveLocalAgentConnectionState");
  });

  it("server heartbeat + local HTTP failed feedback copy", () => {
    expect(shared).toContain(
      "已检测到本地发布助手在线；本地直接检测未通过，但不影响任务下发。若任务未出现，请在客户端点击「立即拉取任务」。",
    );
  });
});
