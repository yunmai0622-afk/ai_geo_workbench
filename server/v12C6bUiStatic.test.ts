import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("C6-B enterprise profile flow order", () => {
  const page = read("client/src/pages/AssetCenter.tsx");
  const panel = read("client/src/components/enterpriseProfile/ProfileIntakePanel.tsx");

  it("shows create project first when no projects", () => {
    expect(page).toContain("先新建第一个企业项目");
    expect(page).toContain("hasProjects");
    expect(page).toContain("hasSelectedProject");
  });

  it("hides intake and forms without selected project", () => {
    expect(page).toContain("{hasSelectedProject ? (");
    expect(page).toMatch(/hasSelectedProject \?[\s\S]*ProfileIntakePanel/);
  });

  it("places new project as secondary when projects exist", () => {
    expect(page).toContain("已有企业档案");
    expect(page).toContain("新增企业项目");
    expect(page).toContain("<details");
  });

  it("shows document ownership and intake after enterprise", () => {
    expect(panel).toContain("当前资料将应用到");
    expect(panel).toContain("上传资料，AI 自动建档");
    const enterpriseBlock = page.indexOf('title={hasProjects ? "已有企业档案"');
    const intakeBlock = page.indexOf("<ProfileIntakePanel");
    expect(enterpriseBlock).toBeGreaterThan(-1);
    expect(intakeBlock).toBeGreaterThan(enterpriseBlock);
  });

  it("auto switches after create with hint message", () => {
    expect(page).toContain("企业已创建，现在可以上传资料进行 AI 建档");
  });
});
