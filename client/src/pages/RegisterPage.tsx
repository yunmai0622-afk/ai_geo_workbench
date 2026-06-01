import AuthPageLayout from "@/components/auth/AuthPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

function registerErrorMessage(err: unknown): string {
  return toUserFacingErrorFromUnknown(err, "注册失败，请稍后重试");
}

export default function RegisterPage() {
  useEffect(() => {
    document.title = "注册账号 - GEO增长工作台";
  }, []);

  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
  });
  const [error, setError] = useState<string | null>(null);

  const register = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setLocation("/onboarding");
    },
    onError: err => setError(registerErrorMessage(err)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    if (form.password.length < 8) {
      setError("密码至少需要 8 位");
      return;
    }
    register.mutate(form);
  };

  return (
    <AuthPageLayout
      footer={
        <p className="text-sm text-gray-500">
          已有账号？{" "}
          <Link href="/" className="font-medium text-blue-600 hover:text-blue-700">
            返回登录
          </Link>
        </p>
      }
    >
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">创建账号</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          使用邮箱注册，即可开始管理企业 GEO 项目
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit} data-testid="register-form">
        <div className="space-y-2">
          <Label htmlFor="register-email">邮箱</Label>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            data-testid="register-email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-name">姓名</Label>
          <Input
            id="register-name"
            autoComplete="name"
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            data-testid="register-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-password">密码</Label>
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            data-testid="register-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-confirm-password">确认密码</Label>
          <Input
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.confirmPassword}
            onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
            data-testid="register-confirm-password"
          />
        </div>

        {error ? (
          <p className="text-sm leading-6 text-red-600" data-testid="register-error">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full bg-blue-600 text-white hover:bg-blue-700"
          disabled={register.isPending}
          data-testid="register-submit"
        >
          {register.isPending ? "注册中…" : "注册并进入系统"}
        </Button>
      </form>
    </AuthPageLayout>
  );
}
