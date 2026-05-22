import { useAuth } from "@/_core/hooks/useAuth";
import { DeliveryReportCustomerView } from "@/components/DeliveryReportCustomerView";
import { Button } from "@/components/ui/button";
import { getLoginUrl, isLoginConfigured } from "@/const";
import { mapPublishRecordsToItems } from "@/lib/deliveryReportDisplay";
import { trpc } from "@/lib/trpc";
import { aggregateAiTestEvidence, type AiTestEvidenceAggregate } from "@shared/aiTestEvidence";
import { BarChart3 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useLocation, useRoute } from "wouter";

type MonitoringRow = { id: number } & Record<string, unknown>;

function monitoringTestResults(row: MonitoringRow): Array<Record<string, unknown>> {
  const key = ["ai", "Test", "Results"].join("");
  const value = row[key];
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

const emptyAggregate: AiTestEvidenceAggregate = {
  questionCount: 0,
  engineCount: 0,
  mentionRate: 0,
  recommendRate: 0,
  averageRank: null,
  sentimentCounts: { positive: 0, neutral: 0, negative: 0 },
  competitorMentionCount: 0,
  citedUrlCount: 0,
  byEngine: [],
  keySamples: [],
  publishCompare: {
    before: { hasData: false, questionCount: 0, mentionRate: null, recommendRate: null, averageRank: null, citedUrlCount: null },
    after: { hasData: false, questionCount: 0, mentionRate: null, recommendRate: null, averageRank: null, citedUrlCount: null },
    changes: { mentionRateDelta: null, recommendRateDelta: null, averageRankDelta: null, citedUrlCountDelta: null },
    hasAnyStageData: false,
  },
};

function ShareLoginGate({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const utils = trpc.useUtils();
  const devLogin = trpc.auth.devLogin.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      window.location.reload();
    },
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        正在加载报告…
      </div>
    );
  }

  if (!user) {
    const loginConfigured = isLoginConfigured();
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex w-full max-w-md flex-col items-center gap-8 rounded-3xl border border-cyan-300/15 bg-white/[0.04] p-8 text-center shadow-[0_0_42px_rgba(56,189,248,0.14)]">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
              <BarChart3 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">登录后查看客户报告</h1>
            <p className="max-w-sm text-sm leading-6 text-slate-400">
              本页为登录后可访问的客户报告预览。对外分享请使用「复制客户报告链接」生成的匿名链接。
            </p>
          </div>
          {loginConfigured ? (
            <Button onClick={() => { window.location.href = getLoginUrl(); }} size="lg" className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">
              登录
            </Button>
          ) : (
            <Button onClick={() => devLogin.mutate()} disabled={devLogin.isPending} size="lg" className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">
              {devLogin.isPending ? "正在登录" : "本地开发登录"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function DeliveryReportShareContent() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/delivery-reports/share/:projectId");
  const projectId = Number(params?.projectId);
  const enabled = Number.isFinite(projectId) && projectId > 0;
  const projectInput = useMemo(() => ({ projectId }), [projectId]);

  const projectsQuery = trpc.geo.projects.list.useQuery(undefined, { enabled });
  const summaryQuery = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled });
  const scoreQuery = trpc.geo.scores.latest.useQuery(projectInput, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const monitoringQuery = trpc.geo.articles.inclusionMonitoringRecords.useQuery(projectInput, { enabled });
  const reportQuery = trpc.geo.reports.latest.useQuery(projectInput, { enabled });

  const project = (projectsQuery.data ?? []).find(p => p.id === projectId);
  const profile = summaryQuery.data?.profile as Record<string, unknown> | undefined;
  const brandName =
    (typeof profile?.brandName === "string" && profile.brandName.trim()) ||
    project?.enterpriseName ||
    "未填写品牌名称";
  const enterpriseName = project?.enterpriseName ?? "—";

  const score = scoreQuery.data as Record<string, unknown> | null | undefined;
  const analyses = (analysisQuery.data ?? []) as Array<Record<string, unknown>>;
  const articles = (articlesQuery.data ?? []) as Array<{ id: number; title?: string }>;
  const publishRecords = (publishRecordsQuery.data ?? []) as Array<Record<string, unknown>>;

  const totalScore = typeof score?.totalScore === "number" ? score.totalScore : typeof score?.total_score === "number" ? (score.total_score as number) : null;
  const aiVisibilityScore =
    typeof score?.aiVisibilityScore === "number"
      ? score.aiVisibilityScore
      : typeof score?.ai_visibility_score === "number"
        ? (score.ai_visibility_score as number)
        : null;
  const visibilityScore = aiVisibilityScore ?? totalScore;

  const firstAnalysis = analyses[0];
  const conclusionLine =
    totalScore != null && firstAnalysis
      ? `本轮内容综合评分 ${totalScore} 分；在典型 AI 问答场景下，品牌在 AI 回答中的提及与推荐表现存在可优化空间，建议用可公开、可引用的内容资产持续补齐证据链。`
      : totalScore != null
        ? `本轮内容综合评分 ${totalScore} 分；建议结合下方 AI 搜索实测结果，持续优化品牌可见度与推荐表现。`
        : "请先完成内容诊断与 AI 搜索实测，以便生成面向客户的 GEO 总体结论。";

  const reportGeneratedAt = (() => {
    const report = reportQuery.data as { createdAt?: Date | string } | null | undefined;
    if (report?.createdAt) return new Date(report.createdAt);
    const scoreAt = score?.createdAt ?? score?.created_at;
    if (scoreAt) return new Date(scoreAt as string | Date);
    return null;
  })();

  const articleTitleById = useMemo(() => {
    const m = new Map<number, string>();
    for (const a of articles) {
      if (typeof a.id === "number" && a.title) m.set(a.id, String(a.title));
    }
    return m;
  }, [articles]);

  const publishedItems = useMemo(
    () => mapPublishRecordsToItems(publishRecords, articleTitleById),
    [publishRecords, articleTitleById],
  );

  const aiTestAggregate = useMemo(() => {
    const rows = (monitoringQuery.data ?? []) as MonitoringRow[];
    if (rows.length === 0) return emptyAggregate;
    return aggregateAiTestEvidence(
      rows.map(r => ({
        monitoringRecordId: r.id,
        results: monitoringTestResults(r),
      })),
    );
  }, [monitoringQuery.data]);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-slate-300">
        <p>报告链接无效，请向交付人员索取正确的客户报告链接。</p>
      </div>
    );
  }

  const loading =
    projectsQuery.isLoading ||
    summaryQuery.isLoading ||
    monitoringQuery.isLoading ||
    publishRecordsQuery.isLoading;

  return (
    <DeliveryReportCustomerView
      brandName={brandName}
      enterpriseName={enterpriseName}
      reportGeneratedAt={reportGeneratedAt}
      conclusionLine={conclusionLine}
      visibilityScore={visibilityScore}
      publishCount={publishedItems.length}
      aiTestAggregate={aiTestAggregate}
      publishedItems={publishedItems}
      loading={loading}
      showEvidenceLinks
      onNavigateEvidence={path => setLocation(path)}
    />
  );
}

export default function DeliveryReportSharePage() {
  return (
    <ShareLoginGate>
      <DeliveryReportShareContent />
    </ShareLoginGate>
  );
}

export function buildDeliveryReportSharePath(projectId: number) {
  return `/delivery-reports/share/${projectId}`;
}
