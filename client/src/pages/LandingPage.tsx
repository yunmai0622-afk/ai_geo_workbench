import { Button } from "@/components/ui/button";
import { AUTH_PRODUCT_NAME } from "@/components/auth/authMarketing";
import { SUBSCRIPTION_CONTACT_EMAIL } from "@shared/subscriptionPlans";
import { BarChart3, LineChart, Search, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";

const VALUE_POINTS = [
  {
    title: "诊断",
    description: "检测 AI 是否认识你的品牌",
    icon: Search,
  },
  {
    title: "优化",
    description: "生成针对 AI 的内容资产",
    icon: Sparkles,
  },
  {
    title: "追踪",
    description: "监测 AI 提及率变化",
    icon: LineChart,
  },
] as const;

export default function LandingPage() {
  useEffect(() => {
    document.title = `${AUTH_PRODUCT_NAME} - 让你的企业被 AI 搜索推荐`;
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
              <Link href="/pricing">套餐定价</Link>
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
          <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              让你的企业被AI搜索推荐
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
              帮助企业在豆包、Kimi、DeepSeek等AI平台被识别、提及和推荐
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="bg-blue-600 px-8 text-white hover:bg-blue-700" asChild>
                <Link href="/register">免费开始</Link>
              </Button>
              <Button size="lg" variant="outline" className="px-8" asChild>
                <Link href="/demo">先看演示</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="grid gap-6 sm:grid-cols-3">
            {VALUE_POINTS.map(({ title, description, icon: Icon }) => (
              <div
                key={title}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm text-gray-500 sm:px-6">
          <p className="font-medium text-gray-700">联系我们</p>
          <p className="mt-2">商务合作与产品咨询：{SUBSCRIPTION_CONTACT_EMAIL}</p>
        </div>
      </footer>
    </div>
  );
}
