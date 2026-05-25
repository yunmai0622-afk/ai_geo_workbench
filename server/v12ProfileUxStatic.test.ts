import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("Profile UX enterprise archive console", () => {
  const page = read("client/src/pages/AssetCenter.tsx");
  const panel = read("client/src/components/enterpriseProfile/ProfileIntakePanel.tsx");

  it("uses customer-facing archive title and intake copy", () => {
    expect(page).toContain("企业 AI 搜索档案");
    expect(panel).toContain("先上传企业资料");
    expect(page).toContain("客户画像与购买场景");
    expect(page).toContain("案例与信任素材");
    expect(page).toContain("发布账号绑定");
  });

  it("does not expose engineering section titles", () => {
    expect(page).not.toContain("Section 1");
    expect(page).not.toContain("Section 2");
    expect(page).not.toContain("Section 3");
  });

  it("keeps platform binding and one-click auth", () => {
    expect(page).toContain("PlatformAccountBindingSection");
    expect(read("client/src/components/PlatformAccountBindingSection.tsx")).toContain("绑定发布账号");
  });

  it("does not add schema migration or new router procedures", () => {
    const journal = read("drizzle/meta/_journal.json");
    expect(journal).not.toContain("profile_ux");
    expect(read("server/routers.ts")).not.toContain("profileUx");
  });

  it("keeps industry pain options linked", () => {
    expect(page).toContain("getPainOptionsForIndustry");
  });
});
