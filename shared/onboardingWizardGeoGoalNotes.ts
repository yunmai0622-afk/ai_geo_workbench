/**
 * geoGoalNotes 复合存储：Step4 问题引导示例 + Step8 90天目标备注
 */

export type QuestionGuideExamples = {
  brandSearch: string[];
  categoryRecommend: string[];
  sceneNeed: string[];
  comparison: string[];
  longTail: string[];
};

export type GeoGoalNotesPayload = {
  goalNotes?: string;
  questionGuide?: QuestionGuideExamples;
};

const EMPTY_GUIDE: QuestionGuideExamples = {
  brandSearch: [],
  categoryRecommend: [],
  sceneNeed: [],
  comparison: [],
  longTail: [],
};

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(v => String(v).trim()).filter(Boolean);
}

export function emptyQuestionGuideExamples(): QuestionGuideExamples {
  return { ...EMPTY_GUIDE };
}

export function parseGeoGoalNotesPayload(raw: string | null | undefined): GeoGoalNotesPayload {
  const text = (raw ?? "").trim();
  if (!text) return { goalNotes: "", questionGuide: emptyQuestionGuideExamples() };
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const guide = parsed.questionGuide as Record<string, unknown> | undefined;
      return {
        goalNotes: typeof parsed.goalNotes === "string" ? parsed.goalNotes : "",
        questionGuide: {
          brandSearch: stringArray(guide?.brandSearch),
          categoryRecommend: stringArray(guide?.categoryRecommend),
          sceneNeed: stringArray(guide?.sceneNeed),
          comparison: stringArray(guide?.comparison),
          longTail: stringArray(guide?.longTail),
        },
      };
    } catch {
      return { goalNotes: text, questionGuide: emptyQuestionGuideExamples() };
    }
  }
  return { goalNotes: text, questionGuide: emptyQuestionGuideExamples() };
}

export function serializeGeoGoalNotesPayload(payload: GeoGoalNotesPayload): string | null {
  const goalNotes = (payload.goalNotes ?? "").trim();
  const guide = payload.questionGuide ?? emptyQuestionGuideExamples();
  const hasGuide =
    guide.brandSearch.length > 0 ||
    guide.categoryRecommend.length > 0 ||
    guide.sceneNeed.length > 0 ||
    guide.comparison.length > 0 ||
    guide.longTail.length > 0;
  if (!goalNotes && !hasGuide) return null;
  return JSON.stringify({
    goalNotes,
    questionGuide: hasGuide ? guide : undefined,
  });
}

export function mergeGeoGoalNotesPayload(
  existingRaw: string | null | undefined,
  patch: Partial<GeoGoalNotesPayload>,
): string | null {
  const current = parseGeoGoalNotesPayload(existingRaw);
  return serializeGeoGoalNotesPayload({
    goalNotes: patch.goalNotes !== undefined ? patch.goalNotes : current.goalNotes,
    questionGuide: patch.questionGuide !== undefined ? patch.questionGuide : current.questionGuide,
  });
}
