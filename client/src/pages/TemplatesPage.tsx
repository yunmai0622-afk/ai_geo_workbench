import { P0Card, P0Section } from "@/components/geo/P0UiPrimitives";
import { TemplateFillPreviewDialog, type TemplateFillPreviewData } from "@/components/templates/TemplateFillPreviewDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { trpc } from "@/lib/trpc";
import { groupQuestionTemplatesByPlatform, groupQuestionTemplatesByQuestionType, resolveQuestionTemplatePlatformLabel, resolveQuestionTemplateTypeLabel } from "@shared/questionContentTemplates";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type TemplateRow = { id: number; platform: string; questionType: string; title: string; promptTemplate: string; description?: string | null };
const ALL = "__all__";

export default function TemplatesPage() {
  const utils = trpc.useUtils();
  const { selectedProjectId, selectedProject } = useActiveProjectSelection();
  const [platformFilter, setPlatformFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [viewMode, setViewMode] = useState<"platform" | "questionType">("platform");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<TemplateFillPreviewData | null>(null);
  const templatesQuery = trpc.geo.questionTemplates.list.useQuery({ platform: platformFilter === ALL ? undefined : platformFilter, questionType: typeFilter === ALL ? undefined : typeFilter });
  const templates = (templatesQuery.data ?? []) as TemplateRow[];
  const grouped = useMemo(() => (viewMode === "platform" ? groupQuestionTemplatesByPlatform(templates) : groupQuestionTemplatesByQuestionType(templates)), [templates, viewMode]);

  const handlePreview = async (templateId: number) => {
    if (!selectedProjectId) return toast.error("请先选择企业项目");
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const data = await utils.geo.questionTemplates.preview.fetch({ templateId, projectId: selectedProjectId });
      setPreviewData({
        template: data.template,
        enterpriseName: data.enterpriseName,
        filledPrompt: data.filledPrompt,
        usedFields: data.usedFields,
        missingFieldLabels: data.missingFieldLabels,
      });
    } catch (e) {
      setPreviewOpen(false);
      toast.error(toUserFacingErrorFromUnknown(e, "预览失败"));
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="templates-page">
      <P0Section title="内容模板库" description="系统内置模板，按平台与问题类型分类。">
        <div className="flex flex-wrap gap-3">
          <Select value={platformFilter} onValueChange={setPlatformFilter}><SelectTrigger className="w-[160px]" data-testid="templates-filter-platform"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>全部平台</SelectItem>{Array.from(new Set(templates.map(t => t.platform))).map(p => <SelectItem key={p} value={p}>{resolveQuestionTemplatePlatformLabel(p)}</SelectItem>)}</SelectContent></Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-[180px]" data-testid="templates-filter-question-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>全部问题类型</SelectItem>{Array.from(new Set(templates.map(t => t.questionType))).map(t => <SelectItem key={t} value={t}>{resolveQuestionTemplateTypeLabel(t)}</SelectItem>)}</SelectContent></Select>
          <Button size="sm" variant={viewMode === "platform" ? "default" : "ghost"} onClick={() => setViewMode("platform")} data-testid="templates-view-platform">按平台</Button>
          <Button size="sm" variant={viewMode === "questionType" ? "default" : "ghost"} onClick={() => setViewMode("questionType")} data-testid="templates-view-question-type">按问题类型</Button>
          {selectedProjectId ? <Link href={buildProjectUrl("/weekly", selectedProjectId)}><Button variant="outline" size="sm">去内容生成</Button></Link> : null}
        </div>
        {!selectedProjectId ? <p className="text-sm text-amber-700" data-testid="templates-missing-project">请先在顶部选择企业项目，再预览模板填充效果。</p> : selectedProject ? <p className="text-sm text-gray-600">当前企业项目：{selectedProject.enterpriseName}</p> : null}
      </P0Section>
      {templatesQuery.isLoading ? <Spinner className="mx-auto" /> : templates.length === 0 ? <P0Card className="p-8 text-center text-sm text-gray-500">暂无模板</P0Card> : (
        <div className="space-y-8">{grouped.map(group => (
          <section key={"platform" in group ? group.platform : group.questionType}><h2 className="mb-4 text-lg font-semibold">{group.label}</h2><div className="grid gap-4 md:grid-cols-2">{group.items.map((template: TemplateRow) => (
            <P0Card key={template.id} className="space-y-3 p-5" data-testid={`template-card-${template.id}`}>
              <div className="flex gap-2"><Badge variant="secondary">{resolveQuestionTemplatePlatformLabel(template.platform)}</Badge><Badge variant="outline">{resolveQuestionTemplateTypeLabel(template.questionType)}</Badge></div>
              <h3 className="font-semibold">{template.title}</h3>
              <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">{template.promptTemplate}</pre>
              <Button variant="outline" size="sm" data-testid={`template-preview-${template.id}`} onClick={() => void handlePreview(template.id)}>预览填充效果</Button>
            </P0Card>
          ))}</div></section>
        ))}</div>
      )}
      <TemplateFillPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} projectId={selectedProjectId ?? null} preview={previewData} loading={previewLoading} />
    </div>
  );
}
