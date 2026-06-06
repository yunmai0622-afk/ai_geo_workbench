import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
import { Redirect } from "wouter";

const STATUS_LABELS = {
  pending: "待处理",
  processing: "处理中",
  completed: "已完成",
  failed: "失败",
} as const;

type PublishTaskStatus = keyof typeof STATUS_LABELS;

const STATUS_BADGE_CLASS: Record<PublishTaskStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

function normalizeAdminStatus(status: string): PublishTaskStatus | null {
  if (status === "pending" || status === "pending_agent") return "pending";
  if (status === "processing") return "processing";
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return null;
}

function formatDateTime(input: Date | string | null | undefined): string {
  if (!input) return "—";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function AdminPublishTasksPage() {
  const { user, loading: authLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<PublishTaskStatus | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const listQuery = trpc.adminPublishTasks.list.useQuery(
    {
      status: statusFilter === "all" ? undefined : statusFilter,
      platform: platformFilter === "all" ? undefined : platformFilter,
      limit: 200,
    },
    { enabled: user?.role === "admin" },
  );

  useEffect(() => {
    document.title = "发布任务监控 - GEO";
  }, []);

  if (authLoading || (user?.role === "admin" && listQuery.isLoading && !listQuery.data)) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-gray-500">
        <Spinner className="size-6 text-blue-600" />
        <p className="text-sm">加载中…</p>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/landing" />;
  }

  if (user.role !== "admin") {
    return <Redirect to="/clients" />;
  }

  const rows = listQuery.data?.tasks ?? [];
  const platformOptions = useMemo(() => listQuery.data?.platforms ?? [], [listQuery.data?.platforms]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6" data-testid="admin-publish-tasks-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">发布任务监控</h1>
        <p className="text-sm text-gray-500">管理员专用 · 查看所有用户和项目的发布任务状态</p>
      </header>

      <Card data-testid="admin-publish-tasks-filters">
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
          <CardDescription>支持按状态、平台过滤全局发布任务列表</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Select value={statusFilter} onValueChange={value => setStatusFilter(value as PublishTaskStatus | "all")}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="admin-publish-tasks-status-filter">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="pending">待处理</SelectItem>
              <SelectItem value="processing">处理中</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
            </SelectContent>
          </Select>

          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-full sm:w-[220px]" data-testid="admin-publish-tasks-platform-filter">
              <SelectValue placeholder="全部平台" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部平台</SelectItem>
              {platformOptions.map(platform => (
                <SelectItem key={platform} value={platform}>
                  {platform}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card data-testid="admin-publish-tasks-table-card">
        <CardHeader>
          <CardTitle>全局发布任务</CardTitle>
          <CardDescription>
            当前共 {rows.length} 条
            {listQuery.isFetching ? "（刷新中…）" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listQuery.isError ? (
            <p className="text-sm text-red-600">加载失败，请刷新页面重试</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">暂无符合条件的发布任务</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务ID</TableHead>
                  <TableHead>企业名</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead className="min-w-[260px]">失败原因</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => {
                  const normalizedStatus = normalizeAdminStatus(row.status);
                  return (
                    <TableRow key={row.id} data-testid={`admin-publish-task-row-${row.id}`}>
                      <TableCell className="font-medium">#{row.id}</TableCell>
                      <TableCell>{row.enterpriseName}</TableCell>
                      <TableCell>{row.platform}</TableCell>
                      <TableCell>
                        {normalizedStatus ? (
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                              STATUS_BADGE_CLASS[normalizedStatus],
                            )}
                          >
                            {STATUS_LABELS[normalizedStatus]}
                          </span>
                        ) : (
                          row.status
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        创建：{formatDateTime(row.createdAt)}
                        <br />
                        更新：{formatDateTime(row.updatedAt)}
                      </TableCell>
                      <TableCell className="max-w-[360px] whitespace-normal text-sm text-gray-700">
                        {row.failureReason?.trim() || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
