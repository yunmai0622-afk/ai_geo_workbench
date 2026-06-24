import {
  AdminLayout,
  AdminMetricCards,
  AdminPageHeader,
} from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  COMMAND_CENTER_RENEWAL_RISK_LABELS,
  DELIVERY_COMMAND_CENTER_SUBTITLE,
  DELIVERY_COMMAND_CENTER_TITLE,
  type CommandCenterRenewalRisk,
  type DeliveryTodoItem,
} from "@shared/deliveryCommandCenter";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";

function riskBadgeVariant(risk: CommandCenterRenewalRisk): "default" | "secondary" | "destructive" {
  if (risk === "high") return "destructive";
  if (risk === "attention") return "secondary";
  return "default";
}

function TodoGroup({
  title,
  tone,
  items,
  testId,
}: {
  title: string;
  tone: "red" | "orange" | "blue";
  items: DeliveryTodoItem[];
  testId: string;
}) {
  const toneClass =
    tone === "red"
      ? "border-red-200 bg-red-50/60"
      : tone === "orange"
        ? "border-amber-200 bg-amber-50/60"
        : "border-blue-200 bg-blue-50/60";

  return (
    <Card className={toneClass} data-testid={testId}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-900">
          {title}
          <span className="ml-2 text-sm font-normal text-gray-500">（{items.length}）</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">暂无待办</p>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-lg border border-white/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              data-testid={`delivery-todo-${item.id}`}
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-gray-900">{item.companyName}</p>
                <p className="text-sm text-gray-700">{item.description}</p>
                <p className="text-xs text-gray-500">
                  {item.lastActionAt ? `上次操作：${item.lastActionAt}` : "暂无最近操作记录"}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="shrink-0" asChild>
                <Link href={item.actionPath}>
                  {item.actionLabel}
                  <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDeliveryPage() {
  const commandCenterQuery = trpc.admin.delivery.getCommandCenter.useQuery();

  useEffect(() => {
    document.title = `${DELIVERY_COMMAND_CENTER_TITLE} - 平台运营后台`;
  }, []);

  const data = commandCenterQuery.data;

  return (
    <AdminLayout>
      <AdminPageHeader
        title={DELIVERY_COMMAND_CENTER_TITLE}
        description={DELIVERY_COMMAND_CENTER_SUBTITLE}
      />

      {commandCenterQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6 text-blue-600" />
        </div>
      ) : null}

      {commandCenterQuery.isError ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-red-600">
            交付驾驶舱数据加载失败，请稍后重试。
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <div className="space-y-8">
          <section className="space-y-4" data-testid="delivery-command-todos">
            <h2 className="text-lg font-semibold text-gray-900">今日待办</h2>
            <div className="grid gap-4 xl:grid-cols-3">
              <TodoGroup title="紧急" tone="red" items={data.todos.urgent} testId="delivery-todos-urgent" />
              <TodoGroup title="待处理" tone="orange" items={data.todos.pending} testId="delivery-todos-pending" />
              <TodoGroup
                title="跟进中"
                tone="blue"
                items={data.todos.inProgress}
                testId="delivery-todos-in-progress"
              />
            </div>
          </section>

          <section className="space-y-4" data-testid="delivery-command-overview">
            <h2 className="text-lg font-semibold text-gray-900">客户交付总览</h2>
            <Card>
              <CardContent className="p-0">
                {data.overview.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">暂无客户项目</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>客户名称</TableHead>
                          <TableHead>套餐到期</TableHead>
                          <TableHead>建档完成度</TableHead>
                          <TableHead>AI 诊断状态</TableHead>
                          <TableHead>本月计划</TableHead>
                          <TableHead>内容进度</TableHead>
                          <TableHead>收录状态</TableHead>
                          <TableHead>月报状态</TableHead>
                          <TableHead>续费风险</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.overview.map(row => (
                          <TableRow key={row.projectId} data-testid={`delivery-overview-${row.projectId}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-gray-900">{row.companyName}</p>
                                <p className="text-xs text-gray-500">{row.projectName}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {row.subscriptionExpiresAt
                                ? new Date(row.subscriptionExpiresAt).toLocaleDateString("zh-CN")
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {row.profileCompletedSteps}/{row.profileTotalSteps} 步
                            </TableCell>
                            <TableCell>{row.aiDiagnosisLabel}</TableCell>
                            <TableCell>{row.monthlyPlanLabel}</TableCell>
                            <TableCell>
                              已生成 {row.contentGeneratedCount} 篇 / 已发布 {row.contentPublishedCount} 篇
                            </TableCell>
                            <TableCell>已收录 {row.inclusionIncludedCount} 篇</TableCell>
                            <TableCell>{row.monthlyReportStatus}</TableCell>
                            <TableCell>
                              <Badge variant={riskBadgeVariant(row.renewalRisk)}>
                                {COMMAND_CENTER_RENEWAL_RISK_LABELS[row.renewalRisk]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button type="button" variant="outline" size="sm" asChild>
                                <Link href={row.workspacePath}>进入项目</Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4" data-testid="delivery-command-monthly-stats">
            <h2 className="text-lg font-semibold text-gray-900">本月交付统计</h2>
            <AdminMetricCards
              items={[
                { label: "管理客户总数", value: data.monthlyStats.totalCustomers },
                { label: "本月已完成 AI 诊断数", value: data.monthlyStats.aiDiagnosisCompletedThisMonth },
                { label: "本月已生成内容总篇数", value: data.monthlyStats.contentGeneratedThisMonth },
                { label: "本月已发布内容总篇数", value: data.monthlyStats.contentPublishedThisMonth },
                { label: "本月已生成月报数", value: data.monthlyStats.monthlyReportsGeneratedThisMonth },
                { label: "高续费风险客户数", value: data.monthlyStats.highRenewalRiskCount },
              ]}
            />
          </section>
        </div>
      ) : null}
    </AdminLayout>
  );
}
