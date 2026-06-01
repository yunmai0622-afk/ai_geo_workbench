import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type QuestionTemplateRow = {
  id: number;
  slug: string;
  title: string;
  platform: string;
  questionType: string;
  promptTemplate: string;
};

export async function ensureBuiltinQuestionTemplates(_db: Db): Promise<void> {
  // P1: built-in templates seed deferred until schema migration lands
}

export async function listQuestionTemplates(_db: Db): Promise<QuestionTemplateRow[]> {
  return [];
}

export async function getQuestionTemplateById(_db: Db, _id: number): Promise<QuestionTemplateRow | null> {
  return null;
}

export function resolveFilledQuestionTemplatePrompt(
  template: QuestionTemplateRow,
  _project: Pick<Project, "enterpriseName" | "industry">,
): string {
  return template.promptTemplate;
}
