import {
  AdminLayout,
  AdminPageHeader,
} from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import {
  COMPANY_PLAN_TYPE_LABELS,
  type CompanyPlanType,
} from "@shared/platformAdmin";
import {
  SUBSCRIPTION_CONFIG_PLAN_TYPES,
  subscriptionServiceStatusBadgeClass,
  type SubscriptionConfigPlanType,
  type SubscriptionServiceStatus,
} from "@shared/companySubscriptionServiceStatus";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { toast } from "sonner";

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("zh-CN");
}

function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function AdminSubscriptionsPage() {
  const searchString = useSearch();
  const initialCompanyId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("companyId") ?? "";
  }, [searchString]);

  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState<string | undefined>();
  const [editCompanyId, setEditCompanyId] = useState<number | null>(
    initialCompanyId ? Number(initialCompanyId) : null,
  );
  const [planType, setPlanType] = useState<SubscriptionConfigPlanType>("basic");
  const [startedAt, setStartedAt] = useState(toDateInputValue(new Date()));
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  const utils = trpc.useUtils();
  const companiesQuery = trpc.admin.customers.list.useQuery({});
  const listQuery = trpc.admin.subscriptions.list.useQuery({ search: searchQuery });

  const upsert = trpc.admin.subscriptions.upsert.useMutation({
    onSuccess: async () => {
      await utils.admin.subscriptions.list.invalidate();
      await utils.admin.customers.list.invalidate();
      await utils.admin.customers.metrics.invalidate();
      toast.success("套餐已保存");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "保存失败")),
  });
  const pause = trpc.admin.subscriptions.pause.useMutation({
    onSuccess: async () => {
      await utils.admin.subscriptions.list.invalidate();
      await utils.admin.customers.list.invalidate();
      toast.success("已停用套餐");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "操作失败")),
  });
  const extend = trpc.admin.subscriptions.extend.useMutation({
    onSuccess: async () => {
      await utils.admin.subscriptions.list.invalidate();
      toast.success("已延长有效期");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "操作失败")),
  });

  useEffect(() => {
    document.title = "套餐与有效期管理 - 代运营管理台";
  }, []);

  useEffect(() => {
    if (initialCompanyId) setEditCompanyId(Number(initialCompanyId));
  }, [initialCompanyId]);

  useEffect(() => {
    const existing = (listQuery.data ?? []).find(r => r.companyId === editCompanyId);
    if (existing) {
      setPlanType(existing.planType as SubscriptionConfigPlanType);
      setStartedAt(toDateInputValue(existing.startedAt));
      setExpiresAt(toDateInputValue(existing.expiresAt));
      setNotes(existing.notes ?? "");
    }
  }, [editCompanyId, listQuery.data]);

  const companies = companiesQuery.data ?? [];
  const rows = listQuery.data ?? [];
  const editingCompany = companies.find(c => c.id === editCompanyId);

  return (
    <AdminLayout>
      <AdminPageHeader
        title="套餐与有效期管理"
        description="为客户配置套餐类型、服务开始与到期时间；状态将根据时间自动判断。"
      />

      <Card data-testid="admin-subscription-editor">
        <CardContent className="space-y-4 p-4">
          <p className="text-sm font-medium text-gray-900">配置客户套餐</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>客户公司 *</Label>
              <Select
                value={editCompanyId ? String(editCompanyId) : ""}
                onValueChange={value => setEditCompanyId(Number(value))}
              >
                <SelectTrigger data-testid="subscription-company-select">
                  <SelectValue placeholder="选择客户公司" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>套餐类型 *</Label>
              <Select value={planType} onValueChange={v => setPlanType(v as SubscriptionConfigPlanType)}>
                <SelectTrigger data-testid="subscription-plan-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_CONFIG_PLAN_TYPES.map(type => (
                    <SelectItem key={type} value={type}>
                      {COMPANY_PLAN_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>服务开始时间 *</Label>
              <Input
                type="date"
                value={startedAt}
                onChange={e => setStartedAt(e.target.value)}
                data-testid="subscription-started-at"
              />
            </div>
            <div className="space-y-2">
              <Label>服务到期时间 *</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                data-testid="subscription-expires-at"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>备注</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="可选：续费约定、特殊权限说明等"
              data-testid="subscription-notes"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={upsert.isPending || !editCompanyId || !expiresAt || !startedAt}
              data-testid="subscription-save"
              onClick={() =>
                upsert.mutate({
                  companyId: editCompanyId!,
                  planType: planType as CompanyPlanType,
                  startedAt: new Date(startedAt),
                  expiresAt: new Date(expiresAt),
                  notes: notes.trim() || undefined,
                  status: "active",
                })
              }
            >
              保存套餐
            </Button>
            {editCompanyId ? (
              <Button
                variant="outline"
                disabled={pause.isPending}
                onClick={() => pause.mutate({ companyId: editCompanyId })}
              >
                手动停用
              </Button>
            ) : null}
          </div>
          {editingCompany ? (
            <p className="text-xs text-gray-500">
              当前编辑：{editingCompany.companyName}
              {editingCompany.serviceStatusLabel
                ? ` · 套餐状态：${editingCompany.serviceStatusLabel}`
                : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>

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
              placeholder="按公司名称搜索"
              value={search}
              onChange={e => setSearch(e.target.value)}
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
            <p className="py-8 text-center text-sm text-gray-500">暂无套餐记录，请先为客户配置套餐</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>公司名称</TableHead>
                    <TableHead>套餐类型</TableHead>
                    <TableHead>套餐状态</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>到期时间</TableHead>
                    <TableHead>剩余天数</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => {
                    const serviceStatus = row.serviceStatus as SubscriptionServiceStatus;
                    return (
                      <TableRow key={row.id} data-testid={`admin-subscription-${row.companyId}`}>
                        <TableCell className="font-medium">{row.companyName}</TableCell>
                        <TableCell>{COMPANY_PLAN_TYPE_LABELS[row.planType]}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(subscriptionServiceStatusBadgeClass(serviceStatus))}
                          >
                            {row.serviceStatusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(row.startedAt)}</TableCell>
                        <TableCell>{formatDate(row.expiresAt)}</TableCell>
                        <TableCell>{row.daysRemaining ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditCompanyId(row.companyId);
                                setPlanType(row.planType as SubscriptionConfigPlanType);
                                setStartedAt(toDateInputValue(row.startedAt));
                                setExpiresAt(toDateInputValue(row.expiresAt));
                                setNotes(row.notes ?? "");
                              }}
                            >
                              编辑
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={extend.isPending}
                              onClick={() => {
                                const next = new Date(row.expiresAt ?? new Date());
                                next.setDate(next.getDate() + 30);
                                extend.mutate({ companyId: row.companyId, expiresAt: next });
                              }}
                            >
                              延长30天
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
    </AdminLayout>
  );
}
