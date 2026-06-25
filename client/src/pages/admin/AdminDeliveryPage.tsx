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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  COMMAND_CENTER_RENEWAL_RISK_LABELS,
  DELIVERY_COMMAND_CENTER_SUBTITLE,
  DELIVERY_COMMAND_CENTER_TITLE,
  DELIVERY_QUICK_ACTION_LABELS,
  type CommandCenterRenewalRisk,
  type DeliveryQuickAction,
  type DeliveryTodoItem,
} from "@shared/deliveryCommandCenter";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";

function riskBadgeVariant(risk: CommandCenterRenewalRisk): "default" | "secondary" | "destructive" {
  if (risk === "high") return "destructive";
  if (risk === "attention") return "secondary";
  return "default";
}

const QUICK_ACTION_ORDER: DeliveryQuickAction[] = [
  "workspace",
  "profile",
  "aiDiagnosis",
  "monthlyPlan",
  "content",
];

function QuickActionMenu({
  projectId,
  highlightedAction,
  quickActionPaths,
}: {
  projectId: number;
  highlightedAction: DeliveryQuickAction;
  quickActionPaths: Record<DeliveryQuickAction, string>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          data-testid={`delivery-quick-menu-${projectId}`}
        >
          进入
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {QUICK_ACTION_ORDER.map(action => (
          <DropdownMenuItem key={action} asChild>
            <Link
              href={quickActionPaths[action]}
              className={cn(
                "cursor-pointer",
                highlightedAction === action && "bg-blue-50 font-medium text-blue-700",
              )}
              data-testid={`delivery-quick-action-${projectId}-${action}`}
            >
              {DELIVERY_QUICK_ACTION_LABELS[action]}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
                <p className="font-medium text-gray-900" data-testid={`delivery-todo-label-${item.id}`}>
                  {item.clientLabel}
                </p>
                <p className="text-sm text-gray-700">{item.description}</p>
                <p className="text-xs text-gray-500">
                  {item.lastActionAt ? `上次操作：${item.lastActionAt}` : "暂无最近操作记录"}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="shrink-0" asChild>
                <Link href={item.actionPath}>{item.actionLabel}</Link>
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
          {data.unconfiguredSubscriptionCount > 0 ? (
            <div
              className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              data-testid="delivery-subscription-warning"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <p>
                有 {data.unconfiguredSubscriptionCount} 个项目未配置套餐，无法计算到期时间。
                <Link href="/admin/subscriptions" className="ml-1 font-medium text-amber-800 underline">
                  前往套餐管理配置
                </Link>
                。
              </p>
            </div>
          ) : null}

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
                          <TableHead>当前阶段</TableHead>
                          <TableHead>内容资产</TableHead>
                          <TableHead>月报状态</TableHead>
                          <TableHead>续费风险</TableHead>
                          <TableHead className="sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                            操作
                          </TableHead>
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
                            <TableCell data-testid={`delivery-subscription-${row.projectId}`}>
                              {row.subscriptionLabel}
                            </TableCell>
                            <TableCell data-testid={`delivery-stage-${row.projectId}`}>
                              {row.currentStageLabel}
                            </TableCell>
                            <TableCell>{row.contentAssetsLabel}</TableCell>
                            <TableCell>{row.monthlyReportStatus}</TableCell>
                            <TableCell>
                              <Badge variant={riskBadgeVariant(row.renewalRisk)}>
                                {COMMAND_CENTER_RENEWAL_RISK_LABELS[row.renewalRisk]}
                              </Badge>
                            </TableCell>
                            <TableCell className="sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                              <QuickActionMenu
                                projectId={row.projectId}
                                highlightedAction={row.highlightedQuickAction}
                                quickActionPaths={row.quickActionPaths}
                              />
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
