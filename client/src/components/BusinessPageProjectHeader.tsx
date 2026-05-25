import { Button } from "@/components/ui/button";
import { aiOutlineBtn } from "@/lib/aiProductUi";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

type Props = {
  projectName?: string;
  testId?: string;
};

/** 业务页只读当前客户项目 + 切换客户（项目切换统一去 /clients） */
export function BusinessPageProjectHeader({ projectName, testId = "business-page-project-header" }: Props) {
  const [, setLocation] = useLocation();

  return (
    <div
      className={cn("flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between")}
      data-testid={testId}
    >
      <p className="text-sm text-slate-300" data-testid="business-page-current-project">
        当前客户项目：<span className="font-semibold text-white">{projectName ?? "—"}</span>
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(aiOutlineBtn, "shrink-0")}
        data-testid="business-page-switch-client"
        onClick={() => setLocation("/clients")}
      >
        切换客户
      </Button>
    </div>
  );
}
