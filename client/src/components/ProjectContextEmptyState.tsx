import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import { useLocation } from "wouter";

type Props = {
  title?: string;
  description?: string;
  testId?: string;
};

export default function ProjectContextEmptyState({
  title = "请先选择客户项目",
  description = "该功能必须基于一个企业项目运行，请先到客户管理台选择或新建客户项目。",
  testId = "active-project-empty",
}: Props) {
  const [, setLocation] = useLocation();

  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-2xl border border-gray-200 bg-white/[0.03] px-6 py-12 text-center"
      data-testid={testId}
    >
      <Building2 className="h-12 w-12 text-gray-600" aria-hidden />
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="max-w-md text-sm leading-6 text-gray-400">{description}</p>
      </div>
      <Button
        className="bg-blue-600 text-white hover:bg-blue-700"
        onClick={() => setLocation("/clients")}
        data-testid="go-client-dashboard"
      >
        去客户管理台
      </Button>
    </div>
  );
}
