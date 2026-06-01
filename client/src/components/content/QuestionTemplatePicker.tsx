import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aiGlassPanel, aiInput } from "@/lib/aiProductUi";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { resolveQuestionTemplatePlatformLabel, resolveQuestionTemplateTypeLabel } from "@shared/questionContentTemplates";
import { useMemo } from "react";
type TemplateItem = { id: number; platform: string; questionType: string; title: string; promptTemplate: string };
type Props = { platform?: string; value: number | null; onChange: (next: number | null) => void; disabled?: boolean; projectId?: number | null };
const NONE_VALUE = "__none__";
export function QuestionTemplatePicker({ platform, value, onChange, disabled, projectId }: Props) {
  const templatesQuery = trpc.geo.questionTemplates.list.useQuery({ platform: platform || undefined }, { enabled: Boolean(platform) });
  const templates = (templatesQuery.data ?? []) as TemplateItem[];
  const selectedTemplate = useMemo(() => templates.find(item => item.id === value) ?? null, [templates, value]);
  const previewQuery = trpc.geo.questionTemplates.preview.useQuery({ templateId: value ?? 0, projectId: projectId ?? 0 }, { enabled: Boolean(value && projectId) });
  return (
    <section className={cn(aiGlassPanel, "space-y-3 p-4")} data-testid="question-template-picker">
      <div><Label className="text-sm font-medium text-gray-800">内容模板（可选）</Label><p className="mt-1 text-xs text-gray-500">选择系统内置模板后，生成时会将其作为 prompt 参考句式。</p></div>
      <Select value={value ? String(value) : NONE_VALUE} onValueChange={next => onChange(next === NONE_VALUE ? null : Number(next))} disabled={disabled || !platform || templatesQuery.isLoading}>
        <SelectTrigger className={aiInput} data-testid="question-template-select"><SelectValue placeholder={platform ? "选择内容模板" : "请先选择目标发布平台"} /></SelectTrigger>
        <SelectContent><SelectItem value={NONE_VALUE}>不使用模板</SelectItem>{templates.map(template => (<SelectItem key={template.id} value={String(template.id)}>{template.title}</SelectItem>))}</SelectContent>
      </Select>
      {selectedTemplate ? (<div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-700"><div className="flex flex-wrap gap-2"><Badge variant="secondary">{resolveQuestionTemplatePlatformLabel(selectedTemplate.platform)}</Badge><Badge variant="outline">{resolveQuestionTemplateTypeLabel(selectedTemplate.questionType)}</Badge></div><p className="font-medium text-gray-800">{selectedTemplate.promptTemplate}</p>{previewQuery.data?.filledPrompt ? <p className="text-gray-600">填充预览：{previewQuery.data.filledPrompt}</p> : null}</div>) : null}
    </section>
  );
}
