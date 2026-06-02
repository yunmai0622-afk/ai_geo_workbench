import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { buildProjectUrl } from "@/lib/activeProject";
import { QUESTION_TEMPLATE_FIELD_LABELS, type QuestionTemplateFieldKey } from "@shared/questionContentTemplates";
import { Link } from "wouter";

export type TemplateFillPreviewData = {
  template: { id: number; title: string; platform: string; questionType: string; promptTemplate: string };
  enterpriseName: string;
  filledPrompt: string;
  usedFields: QuestionTemplateFieldKey[];
  missingFieldLabels: string[];
};

type Props = {
  open: boolean;
  loading?: boolean;
  projectId: number | null;
  preview: TemplateFillPreviewData | null;
  onOpenChange: (open: boolean) => void;
};

export function TemplateFillPreviewDialog({ open, loading, projectId, preview, onOpenChange }: Props) {
  const fieldRows = (Object.keys(QUESTION_TEMPLATE_FIELD_LABELS) as QuestionTemplateFieldKey[]).map(key => ({
    key,
    label: QUESTION_TEMPLATE_FIELD_LABELS[key],
    used: preview?.usedFields.includes(key) ?? false,
    missing: preview?.missingFieldLabels.includes(QUESTION_TEMPLATE_FIELD_LABELS[key]) ?? false,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="template-fill-preview-dialog">
        <DialogHeader>
          <DialogTitle>模板填充预览</DialogTitle>
          <DialogDescription>
            {preview?.enterpriseName ? `当前企业：${preview.enterpriseName}` : "根据当前企业项目资料填充模板占位符。"}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : preview ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-gray-900">已用字段</p>
              <ul className="space-y-1 text-sm text-gray-700" data-testid="template-fill-preview-fields">
                {fieldRows.map(row => (
                  <li key={row.key} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
                    <span>{row.label}</span>
                    <span className={row.used ? "text-emerald-700" : row.missing ? "text-amber-700" : "text-gray-500"}>
                      {row.used ? "已填充" : row.missing ? "缺少" : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-900">预览内容</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-gray-800" data-testid="template-fill-preview-content">
                {preview.filledPrompt}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">暂无预览内容</p>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="template-fill-preview-close">
            关闭
          </Button>
          <div className="flex flex-wrap gap-2">
            {projectId ? (
              <Link href={buildProjectUrl("/enterprise-profile", projectId)}>
                <Button variant="secondary" data-testid="template-fill-preview-profile">
                  去完善品牌资料
                </Button>
              </Link>
            ) : null}
            {projectId ? (
              <Link href={buildProjectUrl("/weekly", projectId)}>
                <Button data-testid="template-fill-preview-weekly">去内容生成</Button>
              </Link>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
