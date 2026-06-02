import { describe, expect, it } from "vitest";
import {
  compactList,
  filterAiTestRunRows,
  filterRoundQuestionLinks,
  filterRowsWithNumericId,
  filterTestRoundRows,
} from "./trpcRowSanitize";

describe("trpcRowSanitize", () => {
  it("compactList removes null holes", () => {
    const holey = [1, null, 2, undefined, 3] as Array<number | null>;
    expect(compactList(holey)).toEqual([1, 2, 3]);
  });

  it("filterRowsWithNumericId drops invalid id rows", () => {
    const rows = [{ id: 1 }, null, { id: null }, { id: 0 }, { id: 2 }] as Array<{ id: unknown } | null>;
    expect(filterRowsWithNumericId(rows).map(r => r.id)).toEqual([1, 2]);
  });

  it("filterTestRoundRows requires string id and roundType", () => {
    const rows = [
      { id: "uuid-1", roundType: "T0_BASELINE" },
      null,
      { id: "", roundType: "T0_BASELINE" },
      { id: "uuid-2", roundType: "T1_RETEST" },
    ];
    expect(filterTestRoundRows(rows).map(r => r.id)).toEqual(["uuid-1", "uuid-2"]);
  });

  it("filterAiTestRunRows requires questionId", () => {
    expect(filterAiTestRunRows([{ questionId: 1 }, null, { questionId: null }, { questionId: 2 }])).toHaveLength(2);
  });

  it("filterRoundQuestionLinks drops orphan question null (LEFT JOIN 悬空)", () => {
    const links = [
      { id: "lq1", questionId: 10, question: { id: 10, questionText: "Q" } },
      { id: "lq2", questionId: 99, question: null },
      null,
    ];
    const out = filterRoundQuestionLinks(links);
    expect(out).toHaveLength(1);
    expect(out[0]?.questionId).toBe(10);
  });
});
