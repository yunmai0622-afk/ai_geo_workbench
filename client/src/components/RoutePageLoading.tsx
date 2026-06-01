import { Spinner } from "@/components/ui/spinner";

export function RoutePageLoading({ label = "页面加载中…" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-gray-500">
      <Spinner className="size-6 text-blue-600" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
