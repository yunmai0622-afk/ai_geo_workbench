import {
  AdminLayout,
  AdminMetricCards,
  AdminPageHeader,
} from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CUSTOMER_COMPANY_STATUS_LABELS,
  COMPANY_PLAN_TYPE_LABELS,
  RENEWAL_RISK_LABELS,
} from "@shared/platformAdmin";
import {
  formatSubscriptionExpiryLabel,
  subscriptionServiceStatusBadgeClass,
  type SubscriptionServiceStatus,
} from "@shared/companySubscriptionServiceStatus";
import { cn } from "@/lib/utils";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const emptyCreateForm = {
  companyName: "",
  industry: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  notes: "",
};

export default function AdminCustomersPage() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const utils = trpc.useUtils();

  const metricsQuery = trpc.admin.customers.metrics.useQuery();
  const listQuery = trpc.admin.customers.list.useQuery({ search: searchQuery });

  const createCustomer = trpc.admin.customers.create.useMutation({
    onSuccess: async () => {
      await utils.admin.customers.list.invalidate();
      await utils.admin.customers.metrics.invalidate();
      toast.success("客户公司已创建");
      setCreateOpen(false);
      setCreateForm(emptyCreateForm);
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "创建失败")),
  });

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
    document.title = isPlatformAdmin ? "客户公司管理 - 平台运营后台" : "我的客户 - 代运营管理台";
  }, [isPlatformAdmin]);

  const metrics = metricsQuery.data;
  const rows = listQuery.data ?? [];

  return (
    <AdminLayout>
      <AdminPageHeader
        title={isPlatformAdmin ? "客户公司管理" : "我的客户公司"}
        description={
          isPlatformAdmin
            ? "管理客户公司、审核状态、套餐状态和项目绑定。"
            : "创建并管理您负责的客户公司，数据与其他代运营公司隔离。"
        }
        actions={
          <Button onClick={() => setCreateOpen(true)} data-testid="admin-customers-create-btn">
            新增客户
          </Button>
        }
      />

      {metricsQuery.isLoading ? (
        <Spinner className="size-5 text-blue-600" />
      ) : (
        <AdminMetricCards
          items={[
            { label: "客户总数", value: metrics?.totalCompanies ?? 0 },
            ...(isPlatformAdmin
              ? [{ label: "待审核客户", value: metrics?.pendingReview ?? 0 }]
              : []),
            { label: "正常服务中", value: metrics?.activeService ?? 0 },
            { label: "即将到期", value: metrics?.expiringSoon ?? 0 },
            ...(isPlatformAdmin ? [{ label: "高续费风险", value: metrics?.highRisk ?? 0 }] : []),
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
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500">暂无客户公司</p>
              <Button className="mt-3" variant="secondary" onClick={() => setCreateOpen(true)}>
                创建第一个客户
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>公司名称</TableHead>
                    <TableHead>联系人</TableHead>
                    <TableHead>手机/邮箱</TableHead>
                    <TableHead>套餐状态</TableHead>
                    <TableHead>当前套餐</TableHead>
                    <TableHead>到期时间</TableHead>
                    <TableHead>项目数</TableHead>
                    {isPlatformAdmin ? <TableHead>交付状态</TableHead> : null}
                    {isPlatformAdmin ? <TableHead>续费风险</TableHead> : null}
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => {
                    const serviceStatus = (row.serviceStatus ?? "not_configured") as SubscriptionServiceStatus;
                    const expiryLabel = formatSubscriptionExpiryLabel(
                      row.subscription?.expiresAt ?? null,
                      serviceStatus,
                    );
                    return (
                    <TableRow key={row.id} data-testid={`admin-customer-${row.id}`}>
                      <TableCell className="font-medium">{row.companyName}</TableCell>
                      <TableCell>{row.contactName ?? "—"}</TableCell>
                      <TableCell>
                        <div className="text-sm">{row.contactPhone ?? "—"}</div>
                        <div className="text-xs text-gray-500">{row.contactEmail ?? "—"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(subscriptionServiceStatusBadgeClass(serviceStatus))}
                        >
                          {row.serviceStatusLabel ?? "未开通"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.subscription?.planType
                          ? COMPANY_PLAN_TYPE_LABELS[row.subscription.planType]
                          : "未开通"}
                      </TableCell>
                      <TableCell>{expiryLabel}</TableCell>
                      <TableCell>{row.projectCount}</TableCell>
                      {isPlatformAdmin ? <TableCell>{row.deliveryStage}</TableCell> : null}
                      {isPlatformAdmin ? (
                        <TableCell>{RENEWAL_RISK_LABELS[row.renewalRisk]}</TableCell>
                      ) : null}
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {isPlatformAdmin && row.status === "pending" ? (
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
                          {isPlatformAdmin && row.status === "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={disable.isPending}
                              onClick={() => disable.mutate({ companyId: row.id })}
                            >
                              禁用
                            </Button>
                          ) : null}
                          {isPlatformAdmin ? (
                            <Button size="sm" variant="ghost" asChild>
                              <Link href={`/admin/subscriptions?companyId=${row.id}`}>套餐</Link>
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" asChild>
                              <Link href={`/admin/subscriptions?companyId=${row.id}`}>配置套餐</Link>
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/admin/projects?companyId=${row.id}`}>项目</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="admin-customers-create-dialog">
          <DialogHeader>
            <DialogTitle>新增客户公司</DialogTitle>
            <DialogDescription>
              填写客户基础信息，创建后可直接绑定项目并进入工作台。
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={e => {
              e.preventDefault();
              if (!createForm.companyName.trim()) {
                toast.error("请填写客户公司名称");
                return;
              }
              createCustomer.mutate({
                companyName: createForm.companyName.trim(),
                industry: createForm.industry.trim() || undefined,
                contactName: createForm.contactName.trim() || undefined,
                contactEmail: createForm.contactEmail.trim() || undefined,
                contactPhone: createForm.contactPhone.trim() || undefined,
                notes: createForm.notes.trim() || undefined,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="create-company-name">客户公司名称 *</Label>
              <Input
                id="create-company-name"
                required
                value={createForm.companyName}
                onChange={e => setCreateForm(f => ({ ...f, companyName: e.target.value }))}
                data-testid="create-company-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-industry">行业</Label>
              <Input
                id="create-industry"
                value={createForm.industry}
                onChange={e => setCreateForm(f => ({ ...f, industry: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-contact-name">联系人姓名</Label>
                <Input
                  id="create-contact-name"
                  value={createForm.contactName}
                  onChange={e => setCreateForm(f => ({ ...f, contactName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-contact-phone">联系电话</Label>
                <Input
                  id="create-contact-phone"
                  value={createForm.contactPhone}
                  onChange={e => setCreateForm(f => ({ ...f, contactPhone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-contact-email">联系邮箱</Label>
              <Input
                id="create-contact-email"
                type="email"
                value={createForm.contactEmail}
                onChange={e => setCreateForm(f => ({ ...f, contactEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-notes">备注</Label>
              <Textarea
                id="create-notes"
                rows={3}
                value={createForm.notes}
                onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createCustomer.isPending} data-testid="create-company-submit">
                {createCustomer.isPending ? "创建中…" : "创建客户"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
