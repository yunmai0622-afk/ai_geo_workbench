import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { getSubscriptionPlanById } from "@shared/subscriptionPlans";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  useEffect(() => { setName(user?.name ?? ""); }, [user?.name]);
  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: async data => { utils.auth.me.setData(undefined, data.user); setProfileError(null); toast.success("姓名已更新"); },
    onError: err => setProfileError(toUserFacingErrorFromUnknown(err, "更新失败，请稍后重试")),
  });
  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => { setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" }); setPasswordError(null); toast.success("密码已更新"); },
    onError: err => setPasswordError(toUserFacingErrorFromUnknown(err, "密码修改失败，请稍后重试")),
  });
  const canChangePassword = Boolean(user?.passwordHash);
  const subscriptionUsageQuery = trpc.geo.subscription.usage.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const currentPlan = getSubscriptionPlanById(
    subscriptionUsageQuery.data?.planId ?? "basic",
  );
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-1"><h1 className="text-2xl font-semibold text-gray-900">账号设置</h1><p className="text-sm text-gray-500">管理您的基本信息与登录密码</p></header>
      <Card data-testid="settings-subscription-plan">
        <CardHeader>
          <CardTitle>当前套餐</CardTitle>
          <CardDescription>展示您的订阅档位；在线升级与支付功能即将开放</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-base font-semibold text-gray-900" data-testid="settings-plan-name">
              {currentPlan.name}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {currentPlan.priceLabel}
              {currentPlan.priceNote ?? ""}
              {" · "}
              {currentPlan.projectLimitLabel}
            </p>
            <p className="mt-2 text-sm text-gray-600">{currentPlan.features.join(" · ")}</p>
          </div>
          <Button type="button" variant="outline" asChild>
            <a href="/pricing">查看全部套餐</a>
          </Button>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>基本信息</CardTitle><CardDescription>邮箱用于登录，不可修改；您可以更新显示姓名</CardDescription></CardHeader><CardContent>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); const t = name.trim(); if (!t) { setProfileError("请填写姓名"); return; } setProfileError(null); updateProfile.mutate({ name: t }); }} data-testid="settings-profile-form">
          <div className="space-y-2"><Label htmlFor="settings-email">邮箱</Label><Input id="settings-email" type="email" value={user?.email ?? ""} disabled /></div>
          <div className="space-y-2"><Label htmlFor="settings-name">姓名</Label><Input id="settings-name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} data-testid="settings-name" /></div>
          {profileError ? <p className="text-sm text-red-600">{profileError}</p> : null}
          <Button type="submit" disabled={updateProfile.isPending}>{updateProfile.isPending ? "保存中…" : "保存姓名"}</Button>
        </form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>修改密码</CardTitle><CardDescription>{canChangePassword ? "请输入旧密码并设置新密码" : "当前账号未设置本地密码，无法在此修改"}</CardDescription></CardHeader><CardContent>
        {canChangePassword ? (
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); setPasswordError(null); if (passwordForm.newPassword !== passwordForm.confirmPassword) { setPasswordError("两次输入的新密码不一致"); return; } changePassword.mutate(passwordForm); }} data-testid="settings-password-form">
            <div className="space-y-2"><Label htmlFor="settings-current-password">旧密码</Label><Input id="settings-current-password" type="password" required value={passwordForm.currentPassword} onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="settings-new-password">新密码</Label><Input id="settings-new-password" type="password" required minLength={8} value={passwordForm.newPassword} onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="settings-confirm-password">确认新密码</Label><Input id="settings-confirm-password" type="password" required minLength={8} value={passwordForm.confirmPassword} onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))} /></div>
            {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
            <Button type="submit" disabled={changePassword.isPending}>{changePassword.isPending ? "更新中…" : "更新密码"}</Button>
          </form>
        ) : null}
      </CardContent></Card>
      {user?.role === "admin" ? (
        <>
          <Card data-testid="settings-admin-platform-link">
            <CardHeader>
              <CardTitle>平台运营后台</CardTitle>
              <CardDescription>管理客户公司、注册审核、套餐权限、项目绑定与交付进度</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" asChild>
                <a href="/admin/customers">进入平台运营后台</a>
              </Button>
            </CardContent>
          </Card>
          <Card data-testid="settings-admin-stats-link">
            <CardHeader>
              <CardTitle>系统使用统计</CardTitle>
              <CardDescription>查看注册用户、活跃项目、发布与内容生成等汇总数据</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" asChild>
                <a href="/admin/stats">打开使用统计</a>
              </Button>
            </CardContent>
          </Card>
          <Card data-testid="settings-admin-config-link">
            <CardHeader>
              <CardTitle>系统配置</CardTitle>
              <CardDescription>管理员可调整限流、质检及格线与默认发布平台</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" asChild>
                <a href="/admin/config">打开系统配置</a>
              </Button>
            </CardContent>
          </Card>
          <Card data-testid="settings-admin-subscription-link">
            <CardHeader>
              <CardTitle>用户套餐管理</CardTitle>
              <CardDescription>为指定账号手动升级套餐，豁免免费版内容生成等限制</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" asChild>
                <a href="/admin/subscription">打开套餐管理</a>
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}
      <Card data-testid="settings-data-export-section">
        <CardHeader>
          <CardTitle>数据导出</CardTitle>
          <CardDescription>以下数据可在对应页面导出为 CSV 文件，保存到本地备份</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-3 pl-5 text-sm text-gray-700">
            <li>
              <span className="font-medium text-gray-900">交付报告</span>
              （交付报告页 → 导出 CSV）：检测问题列表、各平台 AI 提及与推荐情况、优化前基线与复测对比数据
            </li>
            <li>
              <span className="font-medium text-gray-900">发布记录</span>
              （内容发布页 → 导出发布记录）：文章标题、发布平台、发布时间、链接、发布状态
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
