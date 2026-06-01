import {
  BUILTIN_QUESTION_TEMPLATES,
  buildQuestionTemplateVariables,
  fillQuestionTemplatePrompt,
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

export function resolveFilledQuestionTemplatePrompt(
  template: Pick<QuestionTemplateRow, "promptTemplate">,
  project: {
    enterpriseName: string;
    productIntro?: string | null;
    targetCustomers?: string | null;
    industry?: string | null;
    coreSellingPoints?: string | null;
  },
): string {
  return fillQuestionTemplatePrompt(
    template.promptTemplate,
    buildQuestionTemplateVariables({
      brand: project.enterpriseName,
      product: project.productIntro,
      targetCustomer: project.targetCustomers,
      industry: project.industry,
      coreAdvantage: project.coreSellingPoints,
    }),
  );
}
