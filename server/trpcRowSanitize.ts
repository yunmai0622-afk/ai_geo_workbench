/**
 * tRPC 列表返回值契约：剔除 null/undefined 空洞行，以及 LEFT JOIN 式嵌套 null（如已删 question 的 round_question）。
 * 供 /ai-diagnosis 等 V12 流程在数据层统一清洗，避免前端对 .id 访问崩溃。
 */

export function compactList<T>(rows: Array<T | null | undefined> | null | undefined): T[] {
  return (rows ?? []).filter((row): row is T => row != null);
}

export function filterRowsWithNumericId<T extends { id?: unknown }>(
  rows: Array<T | null | undefined> | null | undefined,
): Array<T & { id: number }> {
  return compactList(rows).filter(
    (row): row is T & { id: number } =>
      typeof row.id === "number" && Number.isFinite(row.id) && row.id > 0,
  );
}

export function filterTestRoundRows<T extends { id?: unknown; roundType?: unknown }>(
  rows: Array<T | null | undefined> | null | undefined,
): Array<T & { id: string; roundType: string }> {
  return compactList(rows).filter(
    (row): row is T & { id: string; roundType: string } =>
      typeof row.id === "string" &&
      row.id.length > 0 &&
      typeof row.roundType === "string" &&
      row.roundType.length > 0,
  );
}

export function filterAiTestRunRows<T extends { questionId?: unknown }>(
  rows: Array<T | null | undefined> | null | undefined,
): Array<T & { questionId: number }> {
  return compactList(rows).filter(
    (row): row is T & { questionId: number } =>
      typeof row.questionId === "number" && Number.isFinite(row.questionId),
  );
}

export type RoundQuestionLinkRow<TLink extends { questionId?: unknown; id?: unknown }, TQuestion> = TLink & {
  question: TQuestion | null;
};

/** 丢弃 question 已删除的 round_questions（原 listByRound 的 question: null 悬空行） */
export function filterRoundQuestionLinks<
  TLink extends { questionId?: unknown; id?: unknown },
  TQuestion extends { id?: unknown },
>(
  links: Array<RoundQuestionLinkRow<TLink, TQuestion> | null | undefined> | null | undefined,
): Array<TLink & { question: TQuestion & { id: number } }> {
  return compactList(links).filter(
    (link): link is TLink & { question: TQuestion & { id: number } } =>
      typeof link.questionId === "number" &&
      Number.isFinite(link.questionId) &&
      typeof link.id === "string" &&
      link.id.length > 0 &&
      link.question != null &&
      typeof link.question.id === "number" &&
      Number.isFinite(link.question.id),
  );
}

export function sanitizeTestRoundRow<T extends { id?: unknown; roundType?: unknown }>(
  row: T | null | undefined,
): (T & { id: string; roundType: string }) | null {
  return filterTestRoundRows(row == null ? [] : [row])[0] ?? null;
}
