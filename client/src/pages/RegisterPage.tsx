import AuthPageLayout from "@/components/auth/AuthPageLayout";
import { PLATFORM_PRODUCT_NAME } from "@/components/auth/authMarketing";
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

type AccountType = "operator" | "customer";

export default function RegisterPage() {
  useEffect(() => {
    document.title = `注册账号 - ${PLATFORM_PRODUCT_NAME}`;
  }, []);

  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [accountType, setAccountType] = useState<AccountType>("operator");
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    operatorCompanyName: "",
  });
  const [error, setError] = useState<string | null>(null);

  const register = trpc.auth.register.useMutation({
    onSuccess: async data => {
      await utils.auth.me.invalidate();
      if (data.role === "operator") {
        setLocation("/admin/customers");
        return;
      }
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
    if (accountType === "operator" && !form.operatorCompanyName.trim()) {
      setError("请填写代运营公司名称");
      return;
    }
    register.mutate({
      ...form,
      accountType,
      operatorCompanyName:
        accountType === "operator" ? form.operatorCompanyName.trim() : undefined,
    });
  };

  return (
    <AuthPageLayout
      footer={
        <div className="space-y-3 text-sm text-gray-500">
          <p>
            想先了解产品能力？{" "}
            <Link href="/demo" className="font-medium text-blue-600 hover:text-blue-700">
              查看演示
            </Link>
          </p>
          <p>
            已有账号？{" "}
            <Link href="/" className="font-medium text-blue-600 hover:text-blue-700">
              返回登录
            </Link>
          </p>
        </div>
      }
    >
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">创建账号</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          代运营公司注册后可自助创建客户公司与项目
        </p>
      </div>

      <div className="mb-4 flex rounded-lg border border-gray-200 p-1">
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            accountType === "operator"
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-50"
          }`}
          onClick={() => setAccountType("operator")}
          data-testid="register-type-operator"
        >
          代运营公司
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            accountType === "customer"
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-50"
          }`}
          onClick={() => setAccountType("customer")}
          data-testid="register-type-customer"
        >
          企业客户
        </button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit} data-testid="register-form">
        {accountType === "operator" ? (
          <div className="space-y-2">
            <Label htmlFor="register-company">代运营公司名称</Label>
            <Input
              id="register-company"
              required
              value={form.operatorCompanyName}
              onChange={e => setForm(f => ({ ...f, operatorCompanyName: e.target.value }))}
              data-testid="register-company"
            />
          </div>
        ) : null}
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
          <Label htmlFor="register-name">
            {accountType === "operator" ? "联系人姓名" : "姓名"}
          </Label>
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
          {register.isPending ? "注册中…" : accountType === "operator" ? "注册并进入管理台" : "注册并进入系统"}
        </Button>
      </form>
    </AuthPageLayout>
  );
}
