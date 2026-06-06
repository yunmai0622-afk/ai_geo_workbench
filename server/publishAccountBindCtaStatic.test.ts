import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V1.1 publish account bind CTA hard fix", () => {
  const shell = read("client/src/components/project/EnterpriseProjectShell.tsx");
  const topBar = read("client/src/components/project/ProjectWorkspaceTopBar.tsx");
  const assistant = read("client/src/components/publishing/PublishAssistantPanel.tsx");
  const hook = read("client/src/hooks/usePublishAccountBindCta.tsx");
  const dialog = read("client/src/components/publishing/PublishAccountBindDialog.tsx");

  it("统一 CTA handler 与状态分流逻辑", () => {
    expect(hook).toContain("handlePublishAccountBindCta");
    expect(hook).toContain("resolvePublishAccountBindCtaState");
    expect(hook).toContain("publishAccountBindCtaLabel");
    expect(read("shared/publishAccountBindCta.ts")).toContain("not_connected");
    expect(read("shared/publishAccountBindCta.ts")).toContain("not_synced");
    expect(read("shared/publishAccountBindCta.ts")).toContain("not_bound");
    expect(read("shared/publishAccountBindCta.ts")).toContain("bound");
  });

  it("顶部 CTA 与右侧发布助手调用同一 handler", () => {
    expect(shell).toContain("usePublishAccountBindCta");
    expect(shell).toContain("handlePublishAccountBindCta");
    expect(shell).toContain("onCtaClick");
    expect(shell).toContain("onPublishAccountBindCta");
    expect(topBar).toContain("onCtaClick");
    expect(topBar).toContain('data-testid="project-topbar-cta"');
    expect(assistant).toContain("onPublishAccountBindCta");
    expect(assistant).toContain('data-testid="publish-assistant-bind-cta"');
  });

  it("所有绑定 CTA 按钮均有 onClick", () => {
    expect(topBar).toMatch(/onClick=\{\(\) => \{[\s\S]*onCtaClick/);
    expect(assistant).toMatch(/onClick=\{\(\) => onPublishAccountBindCta\(\)\}/);
    expect(shell).toMatch(/onClick=\{\(\) => \{[\s\S]*handlePublishAccountBindCta/);
  });

  it("未连接 / 未绑定场景有引导弹窗", () => {
    expect(dialog).toContain("publish-account-bind-dialog");
    expect(dialog).toContain("publish-bind-dialog-check-connection");
    expect(dialog).toContain("publish-bind-dialog-download-client");
    expect(dialog).toContain("publish-bind-dialog-open-accounts");
    expect(dialog).toContain("publish-bind-dialog-refresh-accounts");
    expect(hook).toContain('setDialogMode("not_connected")');
    expect(hook).toContain('setDialogMode("not_bound")');
  });

  it("已连接未同步时触发刷新账号状态", () => {
    expect(hook).toContain('case "not_synced"');
    expect(hook).toContain("runRefreshAccountStatus");
    expect(hook).toContain("正在刷新账号状态");
  });

  it("已绑定时不显示误导性「去绑定发布账号」文案", () => {
    expect(read("shared/publishAccountBindCta.ts")).toContain("查看可发布账号");
    expect(read("shared/publishAccountBindCta.test.ts")).toContain("查看可发布账号");
  });

  it("点击会展开发布账号管理区域而非空跳转", () => {
    expect(hook).toContain("openPublishPlatformAccountsFold");
    expect(hook).toContain('data-testid="publish-platform-accounts-fold"');
  });
});
