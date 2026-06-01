import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
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
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-1"><h1 className="text-2xl font-semibold text-gray-900">账号设置</h1><p className="text-sm text-gray-500">管理您的基本信息与登录密码</p></header>
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
    </div>
  );
}
