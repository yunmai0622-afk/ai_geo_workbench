import AuthPageLayout from "@/components/auth/AuthPageLayout";
import ForgotPasswordDialog, { ForgotPasswordLink } from "@/components/auth/ForgotPasswordDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLoginUrl, isLoginConfigured } from "@/const";
import { trpc } from "@/lib/trpc";
import { toEmailLoginErrorMessage } from "@shared/emailLoginErrors";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useState } from "react";
import { Link } from "wouter";
import { WhiteLabelBrandMark } from "@/components/WhiteLabelBrandMark";
import { whiteLabel, whiteLabelPrimaryStyle } from "@/lib/whiteLabel";

export default function LoginGatePanel() {
  const utils = trpc.useUtils();
  const devLogin = trpc.auth.devLogin.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      window.location.reload();
    },
  });
  const [emailLogin, setEmailLogin] = useState({ email: "", password: "" });
  const [emailLoginError, setEmailLoginError] = useState<string | null>(null);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const loginWithEmail = trpc.auth.loginWithEmail.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      const me = await utils.auth.me.fetch();
      if (me?.role === "operator") {
        window.location.href = "/admin/customers";
        return;
      }
      window.location.href = "/";
    },
    onError: err => {
      setEmailLoginError(toEmailLoginErrorMessage(err));
    },
  });

  const loginConfigured = isLoginConfigured();

  return (
    <AuthPageLayout
      footer={
        <div className="space-y-3 text-sm text-gray-500">
          <p>
            <Link href="/landing" className="font-medium text-blue-600 hover:text-blue-700">
              了解更多
            </Link>
          </p>
          <p>
            还没有账号？{" "}
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-700">
              立即注册
            </Link>
          </p>
        </div>
      }
    >
      <div className="mb-6 flex flex-col items-center text-center">
        <WhiteLabelBrandMark className="mb-4 lg:hidden" />
        <h2 className="text-2xl font-semibold tracking-tight">{whiteLabel.loginTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          {whiteLabel.loginSubtitle}
        </p>
      </div>

      {loginConfigured ? (
        <Button
          onClick={() => {
            window.location.href = getLoginUrl();
          }}
          size="lg"
          className="w-full bg-blue-600 text-white hover:bg-blue-700"
          style={whiteLabelPrimaryStyle}
        >
          使用 OAuth 登录
        </Button>
      ) : import.meta.env.DEV ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            本地环境未配置外部 OAuth 登录参数。可使用本地开发登录进入系统验收页面；生产环境不会启用该入口。
          </div>
          <Button
            onClick={() => devLogin.mutate()}
            disabled={devLogin.isPending}
            size="lg"
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
            style={whiteLabelPrimaryStyle}
          >
            {devLogin.isPending ? "正在登录" : "本地开发登录"}
          </Button>
          {devLogin.error ? (
            <p className="text-sm leading-6 text-red-600">
              {toUserFacingErrorFromUnknown(devLogin.error, "开发登录失败，请稍后重试")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 space-y-3 border-t border-gray-100 pt-6">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-gray-400">
          或使用邮箱登录
        </p>
        <form
          className="space-y-3 text-left"
          data-testid="email-login-form"
          onSubmit={e => {
            e.preventDefault();
            setEmailLoginError(null);
            loginWithEmail.mutate(emailLogin);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="login-email">邮箱</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={emailLogin.email}
              onChange={e => setEmailLogin(s => ({ ...s, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="login-password">密码</Label>
              <ForgotPasswordLink onClick={() => setForgotPasswordOpen(true)} />
            </div>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={emailLogin.password}
              onChange={e => setEmailLogin(s => ({ ...s, password: e.target.value }))}
            />
          </div>
          {emailLoginError ? (
            <p className="text-sm text-red-600" data-testid="email-login-error">
              {emailLoginError}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={loginWithEmail.isPending}
          >
            {loginWithEmail.isPending ? "登录中…" : "邮箱登录"}
          </Button>
        </form>
      </div>

      <ForgotPasswordDialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen} />
    </AuthPageLayout>
  );
}
