import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSystemSubdomain,
  normalizeDomain,
  validateCustomDomain,
  validateSubdomainSlug,
} from "../shared/whiteLabelSettings";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("GEO V2.3 white-label settings and domain readiness", () => {
  it("validates system subdomain slugs without claiming activation", () => {
    expect(validateSubdomainSlug("abcagency")).toBeNull();
    expect(validateSubdomainSlug("abc-agency")).toBeNull();
    expect(validateSubdomainSlug("Abc_Agency")).not.toBeNull();
    expect(validateSubdomainSlug("-abc")).not.toBeNull();
    expect(buildSystemSubdomain("abcagency", "aigeo.example.com")).toBe("abcagency.aigeo.example.com");
    expect(buildSystemSubdomain("abcagency", null)).toBeNull();
  });

  it("normalizes and validates custom domains", () => {
    expect(normalizeDomain(" HTTPS://Geo.Customer.COM/ ")).toBe("geo.customer.com");
    expect(validateCustomDomain("geo.customer.com")).toBeNull();
    expect(validateCustomDomain("https://geo.customer.com/path")).not.toBeNull();
    expect(validateCustomDomain("localhost")).not.toBeNull();
  });

  it("exposes an admin settings route with four focused sections", () => {
    const page = read("client/src/pages/WhiteLabelSettingsPage.tsx");
    const app = read("client/src/App.tsx");
    expect(app).toContain('path="/settings/white-label"');
    expect(page).toContain('user?.role === "admin"');
    expect(page).toContain("white-label-brand-section");
    expect(page).toContain("white-label-login-section");
    expect(page).toContain("white-label-report-section");
    expect(page).toContain("white-label-domain-section");
    expect(page).toContain("保存只保留当前浏览器草稿");
  });

  it("provides truthful DNS guidance and no automatic-binding claim", () => {
    const page = read("client/src/pages/WhiteLabelSettingsPage.tsx");
    expect(page).toContain("未配置 OEM_BASE_DOMAIN");
    expect(page).toContain("状态：待配置 DNS");
    expect(page).toContain("暂未接入自动检测");
    expect(page).toContain("不自动修改 DNS，也不承诺 SSL 已完成");
  });
});
