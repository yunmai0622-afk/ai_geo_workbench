import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { trpc } from "@/lib/trpc";
import {
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
} from "@shared/subscriptionPlans";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { toast } from "sonner";

export default function AdminSubscriptionPage() {
  const { user, loading: authLoading } = useAuth();
  const [emailQuery, setEmailQuery] = useState("");
  const [searchEmail, setSearchEmail] = useState<string | undefined>(undefined);
  const [planDraftByUserId, setPlanDraftByUserId] = useState<Record<number, SubscriptionPlanId>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const usersQuery = trpc.adminSubscription.listUsers.useQuery(
    { email: searchEmail, limit: 30 },
    { enabled: user?.role === "admin" },
  );
  const utils = trpc.useUtils();

  const setUserPlan = trpc.adminSubscription.setUserPlan.useMutation({
    onSuccess: async (_data, variables) => {
      setSaveError(null);
      await utils.adminSubscription.listUsers.invalidate();
      await utils.geo.subscription.usage.invalidate();
      toast.success(`已更新用户 #${variables.userId} 的套餐`);
    },
    onError: err => setSaveError(toUserFacingErrorFromUnknown(err, "保存失败，请稍后重试")),
  });

  useEffect(() => {
    document.title = "用户套餐管理 - GEO";
  }, []);

  useEffect(() => {
    if (!usersQuery.data) return;
    setPlanDraftByUserId(prev => {
      const next = { ...prev };
      for (const row of usersQuery.data) {
        if (next[row.id] == null) next[row.id] = row.planId;
      }
      return next;
    });
  }, [usersQuery.data]);

  if (authLoading || (user?.role === "admin" && usersQuery.isLoading && !usersQuery.data)) {
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

  const rows = usersQuery.data ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6" data-testid="admin-subscription-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">用户套餐管理</h1>
        <p className="text-sm text-gray-500">
          为指定账号手动设置订阅档位。专业版 / 企业版将豁免免费版的项目、T0 与内容生成篇数限制。
        </p>
      </header>

      <Card data-testid="admin-subscription-search-card">
        <CardHeader>
          <CardTitle>查找用户</CardTitle>
          <CardDescription>按邮箱模糊搜索；留空则显示最近登录的用户</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={e => {
              e.preventDefault();
              const trimmed = emailQuery.trim();
              setSearchEmail(trimmed || undefined);
            }}
            data-testid="admin-subscription-search-form"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="admin-subscription-email">邮箱</Label>
              <Input
                id="admin-subscription-email"
                type="search"
                placeholder="请输入客户邮箱"
                value={emailQuery}
                onChange={e => setEmailQuery(e.target.value)}
                data-testid="admin-subscription-email"
              />
            </div>
            <Button type="submit" variant="secondary" data-testid="admin-subscription-search">
              搜索
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEmailQuery("");
                setSearchEmail(undefined);
              }}
            >
              显示最近用户
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card data-testid="admin-subscription-users-card">
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>将开发者测试账号设为「专业版」或「企业版」即可解除 10 篇内容上限</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {usersQuery.isFetching ? (
            <p className="text-sm text-gray-500">刷新中…</p>
          ) : null}
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500">未找到匹配用户</p>
          ) : (
            <ul className="space-y-4">
              {rows.map(row => {
                const draftPlan = planDraftByUserId[row.id] ?? row.planId;
                const dirty = draftPlan !== row.planId;
                return (
                  <li
                    key={row.id}
                    className="rounded-lg border border-gray-200 p-4"
                    data-testid={`admin-subscription-user-${row.id}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">
                          {row.name?.trim() || "未填写姓名"}{" "}
                          <span className="text-sm font-normal text-gray-500">#{row.id}</span>
                        </p>
                        <p className="truncate text-sm text-gray-600">{row.email ?? "无邮箱"}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          当前：{row.planName} · 最近登录{" "}
                          {row.lastSignedIn ? new Date(row.lastSignedIn).toLocaleString() : "—"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={draftPlan}
                          onValueChange={value =>
                            setPlanDraftByUserId(prev => ({
                              ...prev,
                              [row.id]: value as SubscriptionPlanId,
                            }))
                          }
                        >
                          <SelectTrigger
                            className="w-[180px]"
                            data-testid={`admin-subscription-plan-select-${row.id}`}
                          >
                            <SelectValue placeholder="选择套餐" />
                          </SelectTrigger>
                          <SelectContent>
                            {SUBSCRIPTION_PLANS.map(plan => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          disabled={!dirty || setUserPlan.isPending}
                          onClick={() =>
                            setUserPlan.mutate({ userId: row.id, planId: draftPlan })
                          }
                          data-testid={`admin-subscription-save-${row.id}`}
                        >
                          保存
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
