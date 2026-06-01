import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [announcementBody, setAnnouncementBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "系统配置 - GEO";
  }, []);

  useEffect(() => {
    if (!configQuery.data) return;
    setContentGenLimit(String(configQuery.data.contentGenerationPerMinuteLimit));
    setT0Limit(String(configQuery.data.t0DetectionPerHourLimit));
    setMinPassScore(String(configQuery.data.qualityMinPassScore));
    setPlatformsText(platformsToText(configQuery.data.defaultPublishPlatforms));
    setAnnouncementEnabled(configQuery.data.systemAnnouncement.enabled);
    setAnnouncementBody(configQuery.data.systemAnnouncement.body);
  }, [configQuery.data]);

  const updateConfig = trpc.adminConfig.update.useMutation({
    onSuccess: async data => {
      utils.adminConfig.get.setData(undefined, data);
      setFormError(null);
      toast.success("系统配置已保存");
    },
    onError: err => setFormError(toUserFacingErrorFromUnknown(err, "保存失败，请稍后重试")),
  });

  const updateAnnouncement = trpc.adminConfig.updateAnnouncement.useMutation({
    onSuccess: async data => {
      utils.adminConfig.get.setData(undefined, data);
      void utils.adminConfig.systemAnnouncement.invalidate();
      setAnnouncementError(null);
      toast.success("系统公告已发布");
    },
    onError: err =>
      setAnnouncementError(toUserFacingErrorFromUnknown(err, "公告保存失败，请稍后重试")),
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
          管理员专用 · 控制内容生成限流、T0 检测频率、质检及格线、默认发布平台与全员顶部公告
        </p>
        {configQuery.data ? (
          <p className="text-xs text-gray-400">
            当前生效来源：{sourceLabel}
            {configQuery.data.updatedAt ? ` · 最近更新 ${new Date(configQuery.data.updatedAt).toLocaleString()}` : null}
          </p>
        ) : null}
      </header>

      <Card data-testid="admin-config-announcement-card">
        <CardHeader>
          <CardTitle>系统公告</CardTitle>
          <CardDescription>
            保存后展示在所有登录用户页面顶部；用户可关闭，您再次发布新内容后会重新出现
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            data-testid="admin-config-announcement-form"
            onSubmit={e => {
              e.preventDefault();
              setAnnouncementError(null);
              if (announcementEnabled && !announcementBody.trim()) {
                setAnnouncementError("请填写公告内容，或取消勾选「向所有用户展示」");
                return;
              }
              updateAnnouncement.mutate({
                enabled: announcementEnabled,
                body: announcementBody,
              });
            }}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                id="announcement-enabled"
                checked={announcementEnabled}
                onCheckedChange={checked => setAnnouncementEnabled(checked === true)}
                data-testid="admin-config-announcement-enabled"
              />
              <div className="space-y-1">
                <Label htmlFor="announcement-enabled" className="cursor-pointer font-medium">
                  向所有用户展示此公告
                </Label>
                <p className="text-xs text-gray-500">关闭后横幅立即下线，无需清空正文</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcement-body">公告内容</Label>
              <Textarea
                id="announcement-body"
                rows={5}
                value={announcementBody}
                onChange={e => setAnnouncementBody(e.target.value)}
                placeholder="例如：本周六 22:00–24:00 进行系统维护，期间内容生成可能短暂不可用。"
                data-testid="admin-config-announcement-body"
              />
            </div>
            {configQuery.data?.systemAnnouncement.versionKey ? (
              <p className="text-xs text-gray-400">
                当前公告版本：{new Date(configQuery.data.systemAnnouncement.versionKey).toLocaleString()}
              </p>
            ) : null}
            {announcementError ? <p className="text-sm text-red-600">{announcementError}</p> : null}
            <Button
              type="submit"
              disabled={updateAnnouncement.isPending}
              data-testid="admin-config-announcement-save"
            >
              {updateAnnouncement.isPending ? "发布中…" : "发布公告"}
            </Button>
          </form>
        </CardContent>
      </Card>

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
