import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DemoGeoPage from "../client/src/pages/DemoGeo";
import DemoGeoBrowsePage from "../client/src/pages/DemoGeoBrowse";
import { demoFlowStepTitles, disabledOperations } from "../client/src/lib/demoGeoData";

describe("V1.1 演示引导流程 /demo", () => {
  const renderFlowHtml = () => renderToStaticMarkup(React.createElement(DemoGeoPage));

  it("渲染五步演示第一步与下一步按钮", () => {
    const html = renderFlowHtml();

    expect(html).toContain("演示模式");
    expect(html).toContain("海豚知道");
    expect(html).toContain("无需登录");
    expect(html).toContain("AI 现状检测结果");
    expect(html).toContain("下一步");
    expect(html).toContain("上一步");
    expect(html).toContain(`第 1 / ${demoFlowStepTitles.length} 步`);

    for (const title of demoFlowStepTitles) {
      expect(html).toContain(title);
    }
  });

  it("第一步展示海豚知道 T0 基线与样例问题", () => {
    const html = renderFlowHtml();

    expect(html).toContain("GEO 总分（基线）");
    expect(html).toContain("弱可见");
    expect(html).toContain("知识付费 SaaS 平台哪个好？");
    expect(html).toContain("小鹅通");
  });
});

describe("V1.2 外部只读 Demo 全模块浏览 /demo/geo", () => {
  const renderBrowseHtml = () => renderToStaticMarkup(React.createElement(DemoGeoBrowsePage));

  it("渲染七个公开只读模块和海豚知道样板项目入口信息", () => {
    const html = renderBrowseHtml();

    expect(html).toContain("V1.2 外部只读 Demo");
    expect(html).toContain("海豚知道｜知识付费 SaaS / 企业 AI 经营系统");
    expect(html).toContain("无需登录");
    expect(html).toContain("仅样板数据");

    for (const moduleTitle of ["总览指挥舱", "企业资产", "AI 诊断", "内容生产", "平台发布", "收录监测", "报告中心"]) {
      expect(html).toContain(moduleTitle);
    }
  });

  it("页面级渲染包含只读提示、十个禁用写操作按钮和公开内容页路径文案", () => {
    const html = renderBrowseHtml();
    const readonlyHint = "Demo 演示模式仅支持查看，不支持修改。";

    expect(html).toContain(readonlyHint);
    expect(html).toContain("本页面不提供登录、编辑、生成、发布、删除、保存或更新状态能力");
    expect(html).toContain("/geo/content/1/180001");
    expect(html).not.toMatch(/href="\/geo\/content\/1\/180001"/);
    expect(html).toContain("Demo 仅展示样板路径，不跳转至后台发布页。");

    for (const operation of disabledOperations) {
      const escapedOperation = operation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const buttonPattern = new RegExp(`<button[^>]*disabled=""[^>]*title="${readonlyHint}"[^>]*>${escapedOperation}</button>`);
      expect(html).toMatch(buttonPattern);
    }

    const disabledButtonCount = (html.match(/<button\b[^>]*disabled=""/g) ?? []).length;
    expect(disabledButtonCount).toBe(disabledOperations.length);
  });
});
