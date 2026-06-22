import {
  AdminLayout,
  AdminMetricCards,
  AdminPageHeader,
} from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { RENEWAL_RISK_LABELS } from "@shared/platformAdmin";
import { useEffect } from "react";

function riskBadgeVariant(risk: keyof typeof RENEWAL_RISK_LABELS): "default" | "secondary" | "destructive" {
  if (risk === "high") return "destructive";
  if (risk === "medium") return "secondary";
  return "default";
}

export default function AdminDeliveryPage() {
  const summaryQuery = trpc.admin.delivery.getSummary.useQuery();
  const listQuery = trpc.admin.delivery.list.useQuery({});

  useEffect(() => {
    document.title = "客户交付状态看板 - 平台运营后台";
  }, []);

  const summary = summaryQuery.data;
  const rows = listQuery.data ?? [];

  return (
    <AdminLayout>
      <AdminPageHeader
        title="客户交付状态看板"
        description="跟踪客户从建档、AI实测、本月计划、内容发布、复测到月报的交付进度。"
      />

      {summaryQuery.isLoading ? (
        <Spinner className="size-5 text-blue-600" />
      ) : (
        <AdminMetricCards
          items={[
            { label: "待建档客户", value: summary?.profilePending ?? 0 },
            { label: "待 AI 实测客户", value: summary?.aiTestPending ?? 0 },
            { label: "本月计划执行中", value: summary?.monthlyPlanActive ?? 0 },
            { label: "待发布内容", value: summary?.contentPending ?? 0 },
            { label: "待生成月报", value: summary?.reportPending ?? 0 },
            { label: "7天内到期客户", value: summary?.expiringSoon ?? 0 },
            { label: "高续费风险客户", value: summary?.highRisk ?? 0 },
          ]}
        />
      )}

      <Card>
        <CardContent className="p-4">
          {listQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-6 text-blue-600" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">暂无交付数据</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>客户公司</TableHead>
                    <TableHead>项目名称</TableHead>
                    <TableHead>当前阶段</TableHead>
                    <TableHead>建档完整度</TableHead>
                    <TableHead>成熟度分</TableHead>
                    <TableHead>本月任务进度</TableHead>
                    <TableHead>内容待处理</TableHead>
                    <TableHead>发布待处理</TableHead>
                    <TableHead>复测状态</TableHead>
                    <TableHead>月报状态</TableHead>
                    <TableHead>到期时间</TableHead>
                    <TableHead>续费风险</TableHead>
                    <TableHead>下一步动作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow
                      key={`${row.companyId}-${row.projectId}`}
                      data-testid={`admin-delivery-${row.projectId}`}
                    >
                      <TableCell className="font-medium">{row.companyName}</TableCell>
                      <TableCell>{row.projectName}</TableCell>
                      <TableCell>{row.currentStage}</TableCell>
                      <TableCell>{row.profileCompletionScore}%</TableCell>
                      <TableCell>{row.maturityScore ?? "—"}</TableCell>
                      <TableCell>
                        {row.monthlyPlanProgress.completedCount}/{row.monthlyPlanProgress.totalCount}
                      </TableCell>
                      <TableCell>{row.contentPending}</TableCell>
                      <TableCell>{row.publishPending}</TableCell>
                      <TableCell>{row.aiDiagnosisStatus}</TableCell>
                      <TableCell>{row.monthlyReportStatus}</TableCell>
                      <TableCell>
                        {row.subscriptionExpiresAt
                          ? new Date(row.subscriptionExpiresAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={riskBadgeVariant(row.renewalRisk)}>
                          {RENEWAL_RISK_LABELS[row.renewalRisk]}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.nextAction}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
