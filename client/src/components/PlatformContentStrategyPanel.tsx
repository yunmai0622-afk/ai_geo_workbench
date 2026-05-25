import { aiGlassPanel, aiInput, aiOutlineBtn } from "@/lib/aiProductUi";
import { cn } from "@/lib/utils";
import {
  AI_SEARCH_PLATFORM_OPTIONS,
  GEO_ENHANCEMENT_GOAL_OPTIONS,
  PLATFORM_CONTENT_RULES,
  PLATFORM_CONTENT_TYPE_OPTIONS,
  PUBLISH_PLATFORM_IDS,
  formatPlatformRulesForPrompt,
  type PlatformContentStrategyInput,
  type PublishPlatformId,
} from "@shared/platformContentRules";
import {
  ACCOUNT_GROUP_OPTIONS,
  PUBLISH_IDENTITY_OPTIONS,
  type AccountGroupType,
  type ContentAssetType,
  type PublishIdentity,
} from "@shared/contentStrategy";
import type { AiSearchPlatform, GeoEnhancementGoal } from "@shared/platformContentRules";

type Props = {
  value: PlatformContentStrategyInput;
  onChange: (next: PlatformContentStrategyInput) => void;
  targetQuestionOptions: string[];
  disabled?: boolean;
};

export default function PlatformContentStrategyPanel({
  value,
  onChange,
  targetQuestionOptions,
  disabled,
}: Props) {
  const rule = PLATFORM_CONTENT_RULES[value.targetPublishPlatform];

  return (
    <section
      className={cn(aiGlassPanel, "space-y-5 p-5 md:p-6")}
      data-testid="platform-content-strategy-panel"
    >
      <div>
        <h2 className="text-lg font-semibold text-white">平台化内容策略</h2>
        <p className="mt-1 text-sm text-slate-400">
          基于 AI 诊断缺口，为<strong className="font-normal text-slate-200">单一发布平台</strong>
          生成专属结构与正文；不同平台不会共用同一套稿件。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1.5 text-sm" data-testid="platform-target-publish-platform">
          <span className="font-medium text-slate-200">目标发布平台</span>
          <select
            className={aiInput}
            disabled={disabled}
            value={value.targetPublishPlatform}
            onChange={e => onChange({ ...value, targetPublishPlatform: e.target.value as PublishPlatformId })}
          >
            {PUBLISH_PLATFORM_IDS.map(id => (
              <option key={id} value={id}>
                {PLATFORM_CONTENT_RULES[id].label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5 text-sm" data-testid="platform-content-type">
          <span className="font-medium text-slate-200">内容类型</span>
          <select
            className={aiInput}
            disabled={disabled}
            value={value.contentStrategyType}
            onChange={e =>
              onChange({ ...value, contentStrategyType: e.target.value as ContentAssetType })
            }
          >
            {PLATFORM_CONTENT_TYPE_OPTIONS.map(opt => (
              <option key={opt.strategyType} value={opt.strategyType}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5 text-sm" data-testid="platform-publish-identity">
          <span className="font-medium text-slate-200">账号身份</span>
          <select
            className={aiInput}
            disabled={disabled}
            value={value.publishIdentity}
            onChange={e => onChange({ ...value, publishIdentity: e.target.value as PublishIdentity })}
          >
            {PUBLISH_IDENTITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5 text-sm" data-testid="platform-account-group">
          <span className="font-medium text-slate-200">推荐账号组</span>
          <select
            className={aiInput}
            disabled={disabled}
            value={value.recommendedAccountGroup}
            onChange={e =>
              onChange({ ...value, recommendedAccountGroup: e.target.value as AccountGroupType })
            }
          >
            {ACCOUNT_GROUP_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5 text-sm md:col-span-2" data-testid="platform-target-question">
          <span className="font-medium text-slate-200">目标问题</span>
          {targetQuestionOptions.length > 0 ? (
            <select
              className={aiInput}
              disabled={disabled}
              value={value.targetQuestion}
              onChange={e => onChange({ ...value, targetQuestion: e.target.value })}
            >
              <option value="">请选择目标问题</option>
              {targetQuestionOptions.map(q => (
                <option key={q} value={q}>
                  {q.length > 80 ? `${q.slice(0, 80)}…` : q}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={aiInput}
              disabled={disabled}
              value={value.targetQuestion}
              onChange={e => onChange({ ...value, targetQuestion: e.target.value })}
              placeholder="请先完成 AI 诊断或手动填写客户高意向问题"
            />
          )}
        </label>

        <label className="block space-y-1.5 text-sm" data-testid="platform-geo-enhancement-goal">
          <span className="font-medium text-slate-200">GEO 增强目标</span>
          <select
            className={aiInput}
            disabled={disabled}
            value={value.geoEnhancementGoal}
            onChange={e => onChange({ ...value, geoEnhancementGoal: e.target.value as GeoEnhancementGoal })}
          >
            {GEO_ENHANCEMENT_GOAL_OPTIONS.map(goal => (
              <option key={goal} value={goal}>
                {goal}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-2 md:col-span-2" data-testid="platform-target-ai-platforms">
          <legend className="text-sm font-medium text-slate-200">目标 AI 平台（可见度语境）</legend>
          <div className="flex flex-wrap gap-3">
            {AI_SEARCH_PLATFORM_OPTIONS.map(platform => {
              const checked = value.targetAiPlatforms.includes(platform);
              return (
                <label
                  key={platform}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                    checked ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-100" : "border-white/10 text-slate-400",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    className="accent-cyan-400"
                    disabled={disabled}
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? value.targetAiPlatforms.filter(p => p !== platform)
                        : [...value.targetAiPlatforms, platform];
                      onChange({ ...value, targetAiPlatforms: next as AiSearchPlatform[] });
                    }}
                  />
                  {platform}
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <details className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
        <summary className="cursor-pointer font-medium text-cyan-100" data-testid="platform-rules-summary">
          {rule.label} 内容规则（生成时将写入 Prompt）
        </summary>
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-400">
          {formatPlatformRulesForPrompt(value.targetPublishPlatform)}
        </pre>
      </details>
    </section>
  );
}
