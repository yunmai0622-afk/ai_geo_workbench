import {
  AdminLayout,
  AdminPageHeader,
} from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  COMPANY_PLAN_TYPE_LABELS,
  COMPANY_PLAN_TYPES,
  COMPANY_SUBSCRIPTION_STATUS_LABELS,
  PLATFORM_FEATURE_KEYS,
  PLATFORM_FEATURE_LABELS,
  type CompanyPlanType,
  type PlatformFeatureKey,
} from "@shared/platformAdmin";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export default function AdminSubscriptionsPage() {
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState<string | undefined>();
  const [editCompanyId, setEditCompanyId] = useState<number | null>(null);
  const [planType, setPlanType] = useState<CompanyPlanType>("basic");
  const [expiresAt, setExpiresAt] = useState("");
  const [features, setFeatures] = useState<Record<PlatformFeatureKey, boolean>>(() =>
    Object.fromEntries(PLATFORM_FEATURE_KEYS.map(k => [k, true])) as Record<
      PlatformFeatureKey,
      boolean
    >,
  );

  const utils = trpc.useUtils();
  const companiesQuery = trpc.admin.customers.list.useQuery({});
  const listQuery = trpc.admin.subscriptions.list.useQuery({ search: searchQuery });

  const upsert = trpc.admin.subscriptions.upsert.useMutation({
    onSuccess: async () => {
      await utils.admin.subscriptions.list.invalidate();
      toast.success("套餐已保存");
      setEditCompanyId(null);
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "保存失败")),
  });
  const pause = trpc.admin.subscriptions.pause.useMutation({
    onSuccess: async () => {
      await utils.admin.subscriptions.list.invalidate();
      toast.success("已暂停服务");
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
    document.title = "套餐与有效期管理 - 平台运营后台";
  }, []);

  const companiesWithoutSub = useMemo(() => {
    const existing = new Set((listQuery.data ?? []).map(r => r.companyId));
    return (companiesQuery.data ?? []).filter(c => !existing.has(c.id));
  }, [companiesQuery.data, listQuery.data]);

  const rows = listQuery.data ?? [];

  return (
    <AdminLayout>
      <AdminPageHeader
        title="套餐与有效期管理"
        description="管理客户套餐、功能权限、额度和到期时间。"
        actions={
          companiesWithoutSub.length > 0 ? (
            <Select
              value={editCompanyId ? String(editCompanyId) : ""}
              onValueChange={value => setEditCompanyId(Number(value))}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="选择客户开通套餐" />
              </SelectTrigger>
              <SelectContent>
                {companiesWithoutSub.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
      />

      {(editCompanyId != null || companiesWithoutSub.length > 0) && editCompanyId ? (
        <Card data-testid="admin-subscription-editor">
          <CardContent className="space-y-4 p-4">
            <p className="text-sm font-medium text-gray-900">开通 / 修改套餐</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>套餐类型</Label>
                <Select value={planType} onValueChange={v => setPlanType(v as CompanyPlanType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_PLAN_TYPES.map(type => (
                      <SelectItem key={type} value={type}>
                        {COMPANY_PLAN_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>到期时间</Label>
                <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PLATFORM_FEATURE_KEYS.map(key => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={features[key]}
                    onCheckedChange={checked =>
                      setFeatures(prev => ({ ...prev, [key]: checked === true }))
                    }
                  />
                  {PLATFORM_FEATURE_LABELS[key]}
                </label>
              ))}
            </div>
            <Button
              disabled={upsert.isPending}
              onClick={() =>
                upsert.mutate({
                  companyId: editCompanyId,
                  planType,
                  expiresAt: expiresAt ? new Date(expiresAt) : null,
                  enabledFeatures: features,
                  status: "active",
                })
              }
            >
              保存套餐
            </Button>
          </CardContent>
        </Card>
      ) : null}

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
            <p className="py-8 text-center text-sm text-gray-500">暂无套餐记录</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>公司名称</TableHead>
                    <TableHead>当前套餐</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>到期时间</TableHead>
                    <TableHead>剩余天数</TableHead>
                    <TableHead>项目额度</TableHead>
                    <TableHead>AI实测额度</TableHead>
                    <TableHead>内容任务额度</TableHead>
                    <TableHead>月报额度</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.id} data-testid={`admin-subscription-${row.companyId}`}>
                      <TableCell className="font-medium">{row.companyName}</TableCell>
                      <TableCell>{row.planName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {COMPANY_SUBSCRIPTION_STATUS_LABELS[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(row.startedAt)}</TableCell>
                      <TableCell>{formatDate(row.expiresAt)}</TableCell>
                      <TableCell>{row.daysRemaining ?? "—"}</TableCell>
                      <TableCell>{row.maxProjects}</TableCell>
                      <TableCell>{row.monthlyAiTests}</TableCell>
                      <TableCell>{row.monthlyContentTasks}</TableCell>
                      <TableCell>{row.monthlyReports}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditCompanyId(row.companyId);
                              setPlanType(row.planType);
                              setExpiresAt(
                                row.expiresAt
                                  ? new Date(row.expiresAt).toISOString().slice(0, 10)
                                  : "",
                              );
                              setFeatures(row.enabledFeatures);
                            }}
                          >
                            编辑
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pause.isPending}
                            onClick={() => pause.mutate({ companyId: row.companyId })}
                          >
                            暂停
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={extend.isPending}
                            onClick={() => {
                              const next = new Date();
                              next.setMonth(next.getMonth() + 1);
                              extend.mutate({ companyId: row.companyId, expiresAt: next });
                            }}
                          >
                            延长30天
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
