import { P0Card } from "@/components/geo/P0UiPrimitives";
import {
  QUESTION_QUALITY_INTENT_COVERAGE,
  QUESTION_QUALITY_STANDARDS,
} from "@shared/questionBankIntentMap";

export function QuestionQualityStandardsPanel() {
  return (
    <P0Card data-testid="question-quality-standards">
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">
          什么是高质量 GEO 问题？
        </summary>
        <p className="mt-2 text-xs text-gray-500" data-testid="question-quality-standards-summary">
          高质量问题应接近目标客户真实 AI 搜索场景，覆盖品牌认知、场景痛点与方案寻找等意图。
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-600">高质量问题应该满足：</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700">
              {QUESTION_QUALITY_STANDARDS.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600">生成问题时必须按以下意图覆盖：</p>
            <p className="mt-1 text-sm text-gray-700">{QUESTION_QUALITY_INTENT_COVERAGE.join("、")}</p>
          </div>
        </div>
      </details>
    </P0Card>
  );
}
