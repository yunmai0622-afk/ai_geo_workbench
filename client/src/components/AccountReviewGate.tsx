import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

export default function AccountReviewGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <>{children}</>;
  }

  if (user.role === "admin") {
    return <>{children}</>;
  }

  if (user.userStatus === "pending_review") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-lg" data-testid="account-review-gate">
          <CardHeader>
            <CardTitle>账号审核中</CardTitle>
            <CardDescription>账号审核中，请联系平台管理员开通服务。</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              您的注册申请已提交，平台管理员审核通过并分配客户公司后，即可进入客户工作台。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.userStatus === "rejected") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-lg" data-testid="account-rejected-gate">
          <CardHeader>
            <CardTitle>账号未通过审核</CardTitle>
            <CardDescription>您的注册申请未通过审核，请联系平台管理员了解详情。</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (user.userStatus === "disabled") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-lg" data-testid="account-disabled-gate">
          <CardHeader>
            <CardTitle>账号已禁用</CardTitle>
            <CardDescription>您的账号已被禁用，请联系平台管理员。</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
