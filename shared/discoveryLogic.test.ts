import { describe, expect, it } from "vitest";
import {
  buildSourceDiscoveryQueries,
  buildTrustEvidenceDiscoveryQueries,
  classifySourceRecordType,
  classifyTrustEvidenceRecordType,
  detectDiscoverySignals,
  mapSourceSuggestedTypeToPlatform,
  mapTrustEvidenceSuggestedTypeToEvidenceType,
  resolveDiscoveryConfidence,
} from "./discoveryLogic";

describe("discoveryLogic", () => {
  it("builds 8 source and 6 trust evidence queries from brand name", () => {
    expect(buildSourceDiscoveryQueries("云脉")).toHaveLength(8);
    expect(buildSourceDiscoveryQueries("云脉")[0]).toBe("云脉 官网");
    expect(buildTrustEvidenceDiscoveryQueries("云脉")).toHaveLength(6);
    expect(buildTrustEvidenceDiscoveryQueries("云脉")[0]).toBe("云脉 客户案例");
  });

  it("classifies source domains and titles", () => {
    expect(classifySourceRecordType("https://www.zhihu.com/org/demo", "云脉介绍")).toBe("知乎");
    expect(classifySourceRecordType("https://www.xiaohongshu.com/user/demo", "云脉")).toBe("小红书");
    expect(
      classifySourceRecordType("https://www.example.com/about", "云脉官网", "https://www.example.com"),
    ).toBe("官网");
    expect(classifySourceRecordType("https://news.demo.com/a", "云脉媒体报道")).toBe("媒体平台");
  });

  it("classifies trust evidence titles", () => {
    expect(classifyTrustEvidenceRecordType("云脉客户案例分享")).toBe("客户案例");
    expect(classifyTrustEvidenceRecordType("云脉媒体专访报道")).toBe("媒体报道");
    expect(classifyTrustEvidenceRecordType("云脉第三方测评")).toBe("第三方评测");
    expect(classifyTrustEvidenceRecordType("云脉简介")).toBe("其他");
  });

  it("detects signals and confidence", () => {
    const signals = detectDiscoverySignals({
      brandName: "云脉",
      title: "云脉客户案例",
      snippet: "合作成功",
      url: "https://www.example.com/case",
      officialWebsite: "https://www.example.com",
      competitors: ["竞品A"],
      candidateType: "trust_evidence",
    });
    expect(signals.hasBrandName).toBe(true);
    expect(signals.likelyOfficial).toBe(true);
    expect(signals.likelyCustomerEvidence).toBe(true);
    expect(resolveDiscoveryConfidence(signals)).toBe("high");
  });

  it("maps suggested types to storage enums", () => {
    expect(mapSourceSuggestedTypeToPlatform("知乎")).toBe("zhihu");
    expect(mapTrustEvidenceSuggestedTypeToEvidenceType("媒体报道")).toBe("media_coverage");
  });
});
