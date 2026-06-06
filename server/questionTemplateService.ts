import {
  fillTemplateWithProjectProfile,
  type TemplateProjectLike,
} from "@shared/templateProjectProfileFill";
import {
  BUILTIN_QUESTION_TEMPLATES,
  type QuestionTemplateFieldKey,
} from "@shared/questionContentTemplates";
import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type QuestionTemplateRow = {
  id: number;
  slug: string;
  title: string;
  platform: string;
  questionType: string;
  promptTemplate: string;
  description?: string | null;
};

export type QuestionTemplatePreviewPayload = {
  template: QuestionTemplateRow;
  enterpriseName: string;
  filledPrompt: string;
  usedFields: QuestionTemplateFieldKey[];
  missingFieldLabels: string[];
};

const BUILTIN_ROWS: QuestionTemplateRow[] = BUILTIN_QUESTION_TEMPLATES.map((seed, index) => ({
  id: index + 1,
  slug: seed.slug,
  title: seed.title,
  platform: seed.platform,
  questionType: seed.questionType,
  promptTemplate: seed.promptTemplate,
  description: seed.description,
}));

export async function ensureBuiltinQuestionTemplates(_db: Db): Promise<void> {}

export async function listQuestionTemplates(_db: Db): Promise<QuestionTemplateRow[]> {
  return [...BUILTIN_ROWS];
}

export async function getQuestionTemplateById(_db: Db, id: number): Promise<QuestionTemplateRow | null> {
  return BUILTIN_ROWS.find(row => row.id === id) ?? null;
}

export function buildQuestionTemplatePreview(
  template: Pick<QuestionTemplateRow, "id" | "title" | "platform" | "questionType" | "promptTemplate"> & Partial<Pick<QuestionTemplateRow, "slug" | "description">>,
  project: TemplateProjectLike,
  profile?: Record<string, unknown> | null,
): QuestionTemplatePreviewPayload {
  const filled = fillTemplateWithProjectProfile(template.promptTemplate, { project, profile: profile ?? null });
  return {
    template: {
      id: template.id,
      slug: template.slug ?? `builtin-${template.id}`,
      title: template.title,
      platform: template.platform,
      questionType: template.questionType,
      promptTemplate: template.promptTemplate,
      description: template.description ?? null,
    },
    enterpriseName: filled.enterpriseName,
    filledPrompt: filled.filledPrompt,
    usedFields: filled.usedFields,
    missingFieldLabels: filled.missingFieldLabels,
  };
}

export function resolveFilledQuestionTemplatePrompt(
  template: Pick<QuestionTemplateRow, "promptTemplate">,
  project: TemplateProjectLike,
  profile?: Record<string, unknown> | null,
): string {
  return fillTemplateWithProjectProfile(template.promptTemplate, { project, profile: profile ?? null }).filledPrompt;
}
