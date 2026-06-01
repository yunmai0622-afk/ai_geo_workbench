import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { Redirect } from "wouter";

type AdminStatMetricKey =
  | "totalRegisteredUsers"
  | "activeProjectCount"
  | "totalPublishCount"
  | "totalContentGenerationCount"
  | "todayActiveUserCount";

const STAT_ITEMS: Array<{
  key: AdminStatMetricKey;
  label: string;
  description: string;
}> = [
  { key: "totalRegisteredUsers", label: "注册用户总数", description: "users 表全部账号" },
  { key: "activeProjectCount", label: "活跃项目数", description: "未归档项目（archivedAt 为空）" },
  { key: "totalPublishCount", label: "总发布次数", description: "人工发布登记记录总数" },
  { key: "totalContentGenerationCount", label: "总内容生成次数", description: "已生成 GEO 文章总数" },
  { key: "todayActiveUserCount", label: "今日活跃用户数", description: "今日有登录签到的用户" },
];

export default function AdminStatsPage() {
  const { user, loading: authLoading } = useAuth();
  const statsQuery = trpc.adminStats.summary.useQuery(undefined, { enabled: user?.role === "admin" });

  useEffect(() => {
    document.title = "系统使用统计 - GEO";
  }, []);

  if (authLoading || (user?.role === "admin" && statsQuery.isLoading)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">加载中…</div>
    );
  }

  if (!user) {
    return <Redirect to="/landing" />;
  }

  if (user.role !== "admin") {
    return <Redirect to="/clients" />;
  }

  const stats = statsQuery.data;
  const sources = stats?.sources;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6" data-testid="admin-stats-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">系统使用统计</h1>
        <p className="text-sm text-gray-500">管理员专用 · 基于现有业务表实时聚合，不新增统计表</p>
        {statsQuery.isError ? (
          <p className="text-sm text-red-600">加载失败，请刷新页面重试</p>
        ) : null}
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {STAT_ITEMS.map(item => (
          <Card key={item.key} data-testid={`admin-stats-${item.key}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-gray-900">{item.label}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums text-gray-900">
                {stats ? stats[item.key].toLocaleString() : "—"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {sources ? (
        <Card data-testid="admin-stats-sources">
          <CardHeader>
            <CardTitle className="text-base">统计来源说明</CardTitle>
            <CardDescription>便于验收与排查数据口径</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>注册用户总数：{sources.totalRegisteredUsers}</li>
              <li>活跃项目数：{sources.activeProjectCount}</li>
              <li>总发布次数：{sources.totalPublishCount}</li>
              <li>总内容生成次数：{sources.totalContentGenerationCount}</li>
              <li>今日活跃用户数：{sources.todayActiveUserCount}</li>
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
