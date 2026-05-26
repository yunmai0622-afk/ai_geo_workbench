import { P0Card } from "@/components/geo/P0UiPrimitives";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Surfaces } from "@/lib/geoP0Visual";
import type { CustomerStepStatus, MainPipelineStepView } from "@/lib/geoProductPositioning";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

const STATUS_CLASS: Record<CustomerStepStatus, string> = {
  未开始: "bg-gray-100 text-gray-600",
  进行中: "bg-blue-50 text-blue-800",
  已完成: "bg-emerald-50 text-emerald-800",
  需补充: "bg-amber-50 text-amber-900",
  有风险: "bg-red-50 text-red-800",
};

type Props = {
  projectId: number;
  steps: MainPipelineStepView[];
};

export function WorkspaceEightStepPanel({ projectId, steps }: Props) {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-3" data-testid="workspace-eight-step-pipeline">
      {steps.map((step, index) => (
        <P0Card key={step.id} testId={`workspace-step-${step.id}`} className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">第 {index + 1} 步</span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_CLASS[step.status])}>
                  {step.status}
                </span>
              </div>
              <h3 className="text-base font-semibold text-gray-900">{step.title}</h3>
              <p className={geoP0Surfaces.muted}>{step.customerDescription}</p>
              <p className="text-sm text-gray-700">
                <span className="font-medium text-gray-500">下一步：</span>
                {step.nextAction}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center text-sm font-medium text-blue-700 hover:text-blue-900"
              onClick={() => setLocation(buildProjectUrl(step.path, projectId))}
            >
              进入
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </button>
          </div>
        </P0Card>
      ))}
    </div>
  );
}
