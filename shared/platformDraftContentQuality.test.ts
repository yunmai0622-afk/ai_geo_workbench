import { describe, expect, it } from "vitest";
import {
  evaluatePlatformDraftContentQuality,
  hasCaseEvidenceInText,
  hasConcreteNumericData,
  hasTimelinessExpression,
  ZHIHU_DRAFT_MIN_BODY_CHARS,
} from "./platformDraftContentQuality";

const longPad = "分析".repeat(Math.ceil(ZHIHU_DRAFT_MIN_BODY_CHARS / 2));

describe("platformDraftContentQuality", () => {
  it("detects concrete numbers", () => {
    expect(hasConcreteNumericData("行业增速约 23%，样本覆盖 120 家机构。")).toBe(true);
    expect(hasConcreteNumericData("效果很好，领先同行。")).toBe(false);
  });

  it("detects case evidence", () => {
    expect(hasCaseEvidenceInText("某教育机构在三个月内完成选型。")).toBe(true);
    expect(hasCaseEvidenceInText("建议大家多比较几家。")).toBe(false);
  });

  it("detects timeliness for news platforms", () => {
    expect(hasTimelinessExpression("今年以来，知识付费行业出现新变化。")).toBe(true);
    expect(hasTimelinessExpression("行业长期存在结构性问题。")).toBe(false);
  });

  it("zhihu draft fails without number, case, or length", () => {
    const short = evaluatePlatformDraftContentQuality("zhihu", "# 标题\n\n## 问题界定\n\n太短。");
    expect(short.passed).toBe(false);
    expect(short.issues).toContain("body_too_short");
    expect(short.issues).toContain("missing_concrete_number");
    expect(short.issues).toContain("missing_case_evidence");
  });

  it("zhihu draft passes with number, case, and length", () => {
    const body = [
      "# 如何选型知识付费工具？",
      "## 问题界定",
      longPad,
      "## 分析论证",
      "公开统计显示，约 35% 的中小机构在过去一年更换过工具。",
      "## 实操建议",
      "先列需求清单，再小范围试点。",
      "## 案例或数据参考",
      "某讲师团队用 90 天完成迁移，完课率提升 12 个百分点（脱敏案例）。",
      "## 常见误区",
      "只看价格不看交付。",
      "## 小结",
      "选型要匹配阶段，不虚构案例、不承诺、绝对排名。",
    ].join("\n\n");
    const ok = evaluatePlatformDraftContentQuality("zhihu", body);
    expect(ok.passed).toBe(true);
  });

  it("sohu draft requires timeliness and numbers", () => {
    const fail = evaluatePlatformDraftContentQuality("sohu", "## 导语\n\n行业很重要。");
    expect(fail.passed).toBe(false);
    const pass = evaluatePlatformDraftContentQuality(
      "sohu",
      "## 资讯导语\n\n今年以来，行业融资额同比下降 18%，近期多家机构调整策略。",
    );
    expect(pass.passed).toBe(true);
  });
});
