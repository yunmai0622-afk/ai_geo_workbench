import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { toast } from "sonner";

function platformsToText(platforms: string[]): string {
  return platforms.join("\n");
}

function textToPlatforms(text: string): string[] {
  return text
    .split(/[\n,，]/)
    .map(s => s.trim())
    .filter(Boolean);
}

export default function AdminConfigPage() {
  const { user, loading: authLoading } = useAuth();
  const configQuery = trpc.adminConfig.get.useQuery(undefined, { enabled: user?.role === "admin" });
  const utils = trpc.useUtils();

  const [contentGenLimit, setContentGenLimit] = useState("3");
  const [t0Limit, setT0Limit] = useState("1");
  const [minPassScore, setMinPassScore] = useState("60");
  const [platformsText, setPlatformsText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "系统配置 - GEO";
  }, []);

  useEffect(() => {
    if (!configQuery.data) return;
    setContentGenLimit(String(configQuery.data.contentGenerationPerMinuteLimit));
    setT0Limit(String(configQuery.data.t0DetectionPerHourLimit));
    setMinPassScore(String(configQuery.data.qualityMinPassScore));
    setPlatformsText(platformsToText(configQuery.data.defaultPublishPlatforms));
  }, [configQuery.data]);

  const updateConfig = trpc.adminConfig.update.useMutation({
    onSuccess: async data => {
      utils.adminConfig.get.setData(undefined, data);
      setFormError(null);
      toast.success("系统配置已保存");
    },
    onError: err => setFormError(toUserFacingErrorFromUnknown(err, "保存失败，请稍后重试")),
  });

  if (authLoading || (user?.role === "admin" && configQuery.isLoading)) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const platforms = textToPlatforms(platformsText);
    if (platforms.length === 0) {
      setFormError("请至少填写一个默认发布平台");
      return;
    }
    updateConfig.mutate({
      contentGenerationPerMinuteLimit: Number.parseInt(contentGenLimit, 10),
      t0DetectionPerHourLimit: Number.parseInt(t0Limit, 10),
      qualityMinPassScore: Number.parseInt(minPassScore, 10),
      defaultPublishPlatforms: platforms,
    });
  };

  const sourceLabel =
    configQuery.data?.source === "database"
      ? "数据库"
      : configQuery.data?.source === "environment"
        ? "环境变量"
        : "内置默认";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6" data-testid="admin-config-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">系统配置</h1>
        <p className="text-sm text-gray-500">
          管理员专用 · 控制内容生成限流、T0 检测频率、质检及格线与默认发布平台
        </p>
        {configQuery.data ? (
          <p className="text-xs text-gray-400">
            当前生效来源：{sourceLabel}
            {configQuery.data.updatedAt ? ` · 最近更新 ${new Date(configQuery.data.updatedAt).toLocaleString()}` : null}
          </p>
        ) : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>运行参数</CardTitle>
          <CardDescription>保存后写入数据库；未配置项仍可由环境变量覆盖缺省值</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit} data-testid="admin-config-form">
            <div className="space-y-2">
              <Label htmlFor="content-gen-limit">内容生成每分钟限制次数</Label>
              <Input
                id="content-gen-limit"
                type="number"
                min={1}
                max={120}
                required
                value={contentGenLimit}
                onChange={e => setContentGenLimit(e.target.value)}
                data-testid="admin-config-content-gen-limit"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t0-limit">T0 检测每小时限制次数</Label>
              <Input
                id="t0-limit"
                type="number"
                min={1}
                max={100}
                required
                value={t0Limit}
                onChange={e => setT0Limit(e.target.value)}
                data-testid="admin-config-t0-limit"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="min-pass-score">质检最低通过分数</Label>
              <Input
                id="min-pass-score"
                type="number"
                min={0}
                max={100}
                required
                value={minPassScore}
                onChange={e => setMinPassScore(e.target.value)}
                data-testid="admin-config-min-pass-score"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publish-platforms">默认发布平台列表</Label>
              <Textarea
                id="publish-platforms"
                rows={8}
                required
                value={platformsText}
                onChange={e => setPlatformsText(e.target.value)}
                placeholder="每行一个平台名称"
                data-testid="admin-config-publish-platforms"
              />
              <p className="text-xs text-gray-500">每行一个平台，与人工发布登记下拉选项一致</p>
            </div>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <Button type="submit" disabled={updateConfig.isPending} data-testid="admin-config-save">
              {updateConfig.isPending ? "保存中…" : "保存配置"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
