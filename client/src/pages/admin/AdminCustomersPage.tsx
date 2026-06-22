import {
  AdminLayout,
  AdminMetricCards,
  AdminPageHeader,
} from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  CUSTOMER_COMPANY_STATUS_LABELS,
  RENEWAL_RISK_LABELS,
} from "@shared/platformAdmin";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function AdminCustomersPage() {
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState<string | undefined>();
  const utils = trpc.useUtils();

  const metricsQuery = trpc.admin.customers.metrics.useQuery();
  const listQuery = trpc.admin.customers.list.useQuery({ search: searchQuery });

  const approve = trpc.admin.customers.approve.useMutation({
    onSuccess: async () => {
      await utils.admin.customers.list.invalidate();
      await utils.admin.customers.metrics.invalidate();
      toast.success("已通过审核");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "操作失败")),
  });
  const reject = trpc.admin.customers.reject.useMutation({
    onSuccess: async () => {
      await utils.admin.customers.list.invalidate();
      await utils.admin.customers.metrics.invalidate();
      toast.success("已拒绝");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "操作失败")),
  });
  const disable = trpc.admin.customers.disable.useMutation({
    onSuccess: async () => {
      await utils.admin.customers.list.invalidate();
      await utils.admin.customers.metrics.invalidate();
      toast.success("已禁用");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "操作失败")),
  });

  useEffect(() => {
    document.title = "客户公司管理 - 平台运营后台";
  }, []);

  const metrics = metricsQuery.data;
  const rows = listQuery.data ?? [];

  return (
    <AdminLayout>
      <AdminPageHeader
        title="客户公司管理"
        description="管理客户公司、审核状态、套餐状态和项目绑定。"
      />

      {metricsQuery.isLoading ? (
        <Spinner className="size-5 text-blue-600" />
      ) : (
        <AdminMetricCards
          items={[
            { label: "客户总数", value: metrics?.totalCompanies ?? 0 },
            { label: "待审核客户", value: metrics?.pendingReview ?? 0 },
            { label: "正常服务中", value: metrics?.activeService ?? 0 },
            { label: "即将到期", value: metrics?.expiringSoon ?? 0 },
            { label: "高续费风险", value: metrics?.highRisk ?? 0 },
          ]}
        />
      )}

      <Card>
        <CardContent className="space-y-4 p-4">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={e => {
              e.preventDefault();
              setSearchQuery(search.trim() || undefined);
            }}
          >
            <Input
              placeholder="搜索公司名称、联系人、邮箱或手机"
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="admin-customers-search"
            />
            <Button type="submit" variant="secondary">
              搜索
            </Button>
          </form>

          {listQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-6 text-blue-600" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">暂无客户公司</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>公司名称</TableHead>
                    <TableHead>联系人</TableHead>
                    <TableHead>手机/邮箱</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>当前套餐</TableHead>
                    <TableHead>到期时间</TableHead>
                    <TableHead>项目数</TableHead>
                    <TableHead>交付状态</TableHead>
                    <TableHead>续费风险</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.id} data-testid={`admin-customer-${row.id}`}>
                      <TableCell className="font-medium">{row.companyName}</TableCell>
                      <TableCell>{row.contactName ?? "—"}</TableCell>
                      <TableCell>
                        <div className="text-sm">{row.contactPhone ?? "—"}</div>
                        <div className="text-xs text-gray-500">{row.contactEmail ?? "—"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {CUSTOMER_COMPANY_STATUS_LABELS[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.subscription?.planName ?? "未开通"}</TableCell>
                      <TableCell>
                        {row.subscription?.expiresAt
                          ? new Date(row.subscription.expiresAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>{row.projectCount}</TableCell>
                      <TableCell>{row.deliveryStage}</TableCell>
                      <TableCell>{RENEWAL_RISK_LABELS[row.renewalRisk]}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {row.status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={approve.isPending}
                                onClick={() => approve.mutate({ companyId: row.id })}
                              >
                                通过
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={reject.isPending}
                                onClick={() => reject.mutate({ companyId: row.id })}
                              >
                                拒绝
                              </Button>
                            </>
                          ) : null}
                          {row.status === "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={disable.isPending}
                              onClick={() => disable.mutate({ companyId: row.id })}
                            >
                              禁用
                            </Button>
                          ) : null}
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/admin/subscriptions?companyId=${row.id}`}>套餐</Link>
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/admin/projects?companyId=${row.id}`}>项目</Link>
                          </Button>
                        </div>
                      </TableCell>
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
