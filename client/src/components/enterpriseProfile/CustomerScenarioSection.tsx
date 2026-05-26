import { AiFilledMark } from "@/components/enterpriseProfile/ProfileIntakePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { aiChipActive, aiChipIdle, aiGlassPanel, aiInput } from "@/lib/aiProductUi";
import { cn } from "@/lib/utils";
import { getPainOptionsForIndustry } from "@shared/enterpriseProfileIndustry";
import { Plus, X } from "lucide-react";
import { ProfileSectionShell } from "./ProfileSectionShell";
import type { SectionStatusTone } from "./types";

const textareaClass = `${aiInput} min-h-[5rem] w-full max-w-none resize-y py-2`;

const CUSTOMER_TYPE_PRESETS = [
  "知识付费老师",
  "教培机构",
  "咨询顾问",
  "企业培训公司",
  "本地生活商家",
  "连锁门店",
  "个人 IP",
  "B2B 企业",
] as const;

type Props = {
  status: SectionStatusTone;
  saving: boolean;
  industryTagValue: string;
  targetCustomer: string;
  onTargetCustomerChange: (v: string) => void;
  customerTypeTags: string[];
  customerTypeDraft: string;
  onCustomerTypeDraftChange: (v: string) => void;
  onToggleCustomerType: (tag: string, on: boolean) => void;
  onAddCustomCustomerType: () => void;
  customerIndustry: string;
  onCustomerIndustryChange: (v: string) => void;
  customerScale: string;
  onCustomerScaleChange: (v: string) => void;
  customerPains: string[];
  painDraft: string;
  onPainDraftChange: (v: string) => void;
  onTogglePain: (p: string, on: boolean) => void;
  onAddCustomPain: () => void;
  purchaseTriggers: string[];
  purchaseTriggerDraft: string;
  onPurchaseTriggerDraftChange: (v: string) => void;
  onAddPurchaseTrigger: () => void;
  onRemovePurchaseTrigger: (t: string) => void;
  decisionFocusList: string[];
  decisionFocusDraft: string;
  onDecisionFocusDraftChange: (v: string) => void;
  onAddDecisionFocus: () => void;
  onRemoveDecisionFocus: (t: string) => void;
  commonQuestionsList: string[];
  commonQuestionDraft: string;
  onCommonQuestionDraftChange: (v: string) => void;
  onAddCommonQuestion: () => void;
  onRemoveCommonQuestion: (q: string) => void;
  objectionList: string[];
  objectionDraft: string;
  onObjectionDraftChange: (v: string) => void;
  onAddObjection: () => void;
  onRemoveObjection: (o: string) => void;
  aiFilledKeys: Set<string>;
  onSave: () => void;
};

export function CustomerScenarioSection(props: Props) {
  const painPresets = getPainOptionsForIndustry(props.industryTagValue);

  return (
    <ProfileSectionShell
      id="profile-customer"
      title="目标客户与购买场景"
      description="客户是谁、为何需要你、会搜什么——决定 GEO 选题与 AI 搜索测试问题。"
      hint="分三栏填写画像、痛点与搜索问题；常见搜索问题请逐条添加。"
      status={props.status}
      saveLabel="保存客户画像"
      onSave={props.onSave}
      saving={props.saving}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cn(aiGlassPanel, "space-y-4 p-4")} data-testid="customer-scenario-who">
          <p className="text-sm font-medium text-blue-600/90">客户是谁</p>
          <p className="text-xs text-gray-500">越具体，生成的问题与内容越贴近真实业务。</p>
          <label className="block space-y-2 text-sm">
            <span className="font-medium text-gray-900">
              目标客户类型
              <AiFilledMark show={props.aiFilledKeys.has("targetCustomer")} />
            </span>
            <textarea
              className={textareaClass}
              rows={3}
              placeholder="例如：在抖音、视频号卖课的知识付费老师"
              value={props.targetCustomer}
              onChange={e => props.onTargetCustomerChange(e.target.value)}
            />
          </label>
          <div className="space-y-2 text-sm">
            <span className="font-medium text-gray-900">客户类型标签</span>
            <div className="flex flex-wrap gap-2">
              {CUSTOMER_TYPE_PRESETS.map(tag => (
                <label key={tag} className={cn("cursor-pointer rounded-full border px-3 py-1 text-xs", props.customerTypeTags.includes(tag) ? aiChipActive : aiChipIdle)}>
                  <input type="checkbox" className="sr-only" checked={props.customerTypeTags.includes(tag)} onChange={e => props.onToggleCustomerType(tag, e.target.checked)} />
                  {tag}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={props.customerTypeDraft}
                onChange={e => props.onCustomerTypeDraftChange(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), props.onAddCustomCustomerType())}
                placeholder="自定义类型，回车添加"
                className="border-gray-200 bg-white"
              />
              <Button type="button" variant="outline" size="icon" className="shrink-0 border-gray-200" onClick={props.onAddCustomCustomerType}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-gray-900">客户行业</span>
            <Input value={props.customerIndustry} onChange={e => props.onCustomerIndustryChange(e.target.value)} placeholder="例如：教育培训、企业服务" className="border-gray-200 bg-white" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-gray-900">客户规模</span>
            <Input value={props.customerScale} onChange={e => props.onCustomerScaleChange(e.target.value)} placeholder="例如：年营收 500 万+、团队 20 人" className="border-gray-200 bg-white" />
          </label>
        </div>

        <div className={cn(aiGlassPanel, "space-y-4 p-4")} data-testid="customer-scenario-why">
          <p className="text-sm font-medium text-blue-600/90">为什么需要你</p>
          <p className="text-xs text-gray-500">痛点与购买触发点会进入选题与 FAQ 素材。</p>
          <div className="space-y-2 text-sm">
            <span className="font-medium text-gray-900">
              核心痛点（至少 1 个）
              <AiFilledMark show={props.aiFilledKeys.has("customerPains")} />
            </span>
            <div className="flex flex-col gap-2">
              {painPresets.map(p => (
                <label key={p} className="flex cursor-pointer items-center gap-2 text-gray-700">
                  <input type="checkbox" checked={props.customerPains.includes(p)} onChange={e => props.onTogglePain(p, e.target.checked)} className="h-4 w-4 rounded border-gray-200 bg-white text-blue-600" />
                  {p}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={props.painDraft}
                onChange={e => props.onPainDraftChange(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), props.onAddCustomPain())}
                placeholder="自定义痛点，回车添加"
                className="border-gray-200 bg-white"
              />
              <Button type="button" variant="outline" size="icon" className="shrink-0 border-gray-200" onClick={props.onAddCustomPain}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <TagListEditor
            label="购买触发场景"
            hint="客户通常在什么情况下会认真考虑购买。"
            items={props.purchaseTriggers}
            draft={props.purchaseTriggerDraft}
            onDraftChange={props.onPurchaseTriggerDraftChange}
            onAdd={props.onAddPurchaseTrigger}
            onRemove={props.onRemovePurchaseTrigger}
          />
          <TagListEditor
            label="决策关注点"
            hint="客户做购买决策时最在意的 2–4 件事。"
            items={props.decisionFocusList}
            draft={props.decisionFocusDraft}
            onDraftChange={props.onDecisionFocusDraftChange}
            onAdd={props.onAddDecisionFocus}
            onRemove={props.onRemoveDecisionFocus}
          />
        </div>

        <div className={cn(aiGlassPanel, "space-y-4 p-4")} data-testid="customer-scenario-search">
          <p className="text-sm font-medium text-blue-600/90">他会搜索什么</p>
          <p className="text-xs text-gray-500">常见搜索问题用于 GEO 测试与内容选题，请逐条添加。</p>
          <QuestionListEditor
            label="常见搜索问题"
            items={props.commonQuestionsList}
            draft={props.commonQuestionDraft}
            onDraftChange={props.onCommonQuestionDraftChange}
            onAdd={props.onAddCommonQuestion}
            onRemove={props.onRemoveCommonQuestion}
          />
          <QuestionListEditor
            label="常见反对意见"
            hint="销售或咨询中最常听到的顾虑，便于生成对比与答疑内容。"
            items={props.objectionList}
            draft={props.objectionDraft}
            onDraftChange={props.onObjectionDraftChange}
            onAdd={props.onAddObjection}
            onRemove={props.onRemoveObjection}
          />
        </div>
      </div>
    </ProfileSectionShell>
  );
}

function TagListEditor({
  label,
  hint,
  items,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
}: {
  label: string;
  hint: string;
  items: string[];
  draft: string;
  onDraftChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (t: string) => void;
}) {
  return (
    <div className="space-y-2 text-sm">
      <span className="font-medium text-gray-900">{label}</span>
      <p className="text-xs text-gray-500">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {items.map(t => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs text-amber-700">
            {t}
            <button type="button" onClick={() => onRemove(t)}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={e => onDraftChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), onAdd())}
          placeholder="回车添加"
          className="border-gray-200 bg-white"
        />
        <Button type="button" variant="outline" size="icon" className="shrink-0 border-gray-200" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function QuestionListEditor({
  label,
  hint,
  items,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
}: {
  label: string;
  hint?: string;
  items: string[];
  draft: string;
  onDraftChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (q: string) => void;
}) {
  return (
    <div className="space-y-2 text-sm" data-testid="common-questions-list">
      <span className="font-medium text-gray-900">{label}</span>
      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
      <ul className="space-y-2">
        {items.length === 0 ? (
          <li className="text-xs text-gray-500">暂无，点击下方添加。</li>
        ) : (
          items.map(q => (
            <li key={q} className="flex items-start justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
              <span className="flex-1">{q}</span>
              <button type="button" className="text-gray-500 hover:text-white" onClick={() => onRemove(q)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={e => onDraftChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), onAdd())}
          placeholder="输入后回车添加"
          className="border-gray-200 bg-white"
        />
        <Button type="button" variant="outline" size="icon" className="shrink-0 border-gray-200" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
