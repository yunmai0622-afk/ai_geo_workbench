import { Button } from "@/components/ui/button";
import { AUTH_PRODUCT_NAME } from "@/components/auth/authMarketing";
import { cn } from "@/lib/utils";
import {
  SUBSCRIPTION_CONTACT_EMAIL,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
} from "@shared/subscriptionPlans";
import { BarChart3, Check } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";

function planCtaHref(planId: SubscriptionPlanId): string {
  if (planId === "enterprise") return `mailto:${SUBSCRIPTION_CONTACT_EMAIL}`;
  if (planId === "basic") return "/register";
  return "/register";
}

export default function PricingPage() {
  useEffect(() => {
    document.title = `套餐与定价 - ${AUTH_PRODUCT_NAME}`;
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/landing" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <BarChart3 className="h-5 w-5" aria-hidden />
            </div>
            <span className="text-sm font-semibold text-gray-900">{AUTH_PRODUCT_NAME}</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/demo">查看演示</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">登录</Link>
            </Button>
            <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" asChild>
              <Link href="/register">注册</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 sm:py-16">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">选择适合您的套餐</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600">
              从免费基础版起步，按需升级专业版或联系商务定制企业方案。当前暂未开通在线支付，升级请联系商务。
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16" data-testid="pricing-plans">
          <div className="grid gap-6 lg:grid-cols-3">
            {SUBSCRIPTION_PLANS.map(plan => (
              <div
                key={plan.id}
                data-testid={`pricing-plan-${plan.id}`}
                className={cn(
                  "flex flex-col rounded-2xl border bg-white p-6 shadow-sm",
                  plan.highlighted ? "border-blue-600 ring-2 ring-blue-100" : "border-gray-200",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">{plan.name}</h2>
                  {plan.highlighted ? (
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      推荐
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight text-gray-900">{plan.priceLabel}</span>
                  {plan.priceNote ? <span className="text-sm text-gray-500">{plan.priceNote}</span> : null}
                </div>
                <p className="mt-3 text-sm font-medium text-gray-700">{plan.projectLimitLabel}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm leading-6 text-gray-600">
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden />
                    <span>{plan.featureSummary}</span>
                  </li>
                </ul>
                {plan.id === "enterprise" ? (
                  <Button variant="outline" className="mt-6 w-full" asChild>
                    <a href={planCtaHref(plan.id)} data-testid={`pricing-cta-${plan.id}`}>
                      {plan.ctaLabel}
                    </a>
                  </Button>
                ) : plan.id === "professional" ? (
                  <Button variant="outline" className="mt-6 w-full" disabled data-testid={`pricing-cta-${plan.id}`}>
                    {plan.ctaLabel}
                  </Button>
                ) : (
                  <Button className="mt-6 w-full bg-blue-600 text-white hover:bg-blue-700" asChild>
                    <Link href={planCtaHref(plan.id)} data-testid={`pricing-cta-${plan.id}`}>
                      {plan.ctaLabel}
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-gray-500">
            企业版与专业版升级：{SUBSCRIPTION_CONTACT_EMAIL}（占位邮箱，接入支付前请通过商务开通）
          </p>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm text-gray-500 sm:px-6">
          <Link href="/landing" className="text-blue-600 hover:text-blue-700">
            返回产品介绍
          </Link>
        </div>
      </footer>
    </div>
  );
}
