import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import {
  formatDiscoverySignals,
  resolveDiscoveryConfidenceLabel,
  type DiscoveryCandidateType,
  type DiscoveryDetectedSignals,
} from "@shared/discoveryLogic";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { Check, ExternalLink, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Props = {
  projectId: number;
  candidateType: DiscoveryCandidateType;
  title: string;
  description: string;
  discoverButtonLabel: string;
  acceptButtonLabel: string;
  testIdPrefix: string;
  onAccepted?: () => void | Promise<void>;
};

type CandidateRow = {
  id: number;
  title: string;
  url: string;
  sourceDomain: string | null;
  suggestedRecordType: string;
  confidence: string;
  detectedSignals: Record<string, boolean> | null;
  status: string;
};

function confidenceBadgeClass(confidence: string): string {
  if (confidence === "high") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (confidence === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

export function DiscoveryCandidatesPanel({
  projectId,
  candidateType,
  title,
  description,
  discoverButtonLabel,
  acceptButtonLabel,
  testIdPrefix,
  onAccepted,
}: Props) {
  const utils = trpc.useUtils();
  const projectQueryInput = { projectId };
  const providerQueryInput = { type: candidateType };

  const providerQuery = trpc.geo.discovery.getProviderStatus.useQuery(providerQueryInput, {
    staleTime: 0,
    refetchOnMount: true,
  });
  const listQuery = trpc.geo.discovery.listCandidates.useQuery(
    { projectId, type: candidateType, status: "pending" },
    { enabled: Boolean(projectId) },
  );

  const discoverMutation =
    candidateType === "source"
      ? trpc.geo.discovery.discoverSources.useMutation()
      : trpc.geo.discovery.discoverTrustEvidence.useMutation();

  const acceptMutation = trpc.geo.discovery.acceptCandidate.useMutation();
  const ignoreMutation = trpc.geo.discovery.ignoreCandidate.useMutation();

  const [discoverConfigured, setDiscoverConfigured] = useState<boolean | null>(null);

  const pendingCandidates = useMemo(() => {
    return (listQuery.data ?? []) as CandidateRow[];
  }, [listQuery.data]);

  const providerConfigured = providerQuery.data?.configured;
  const configured =
    discoverConfigured ?? (providerConfigured === undefined ? true : providerConfigured);
  const showNotConfigured = configured === false;
  const notConfiguredMessage =
    providerQuery.data?.message ??
    (candidateType === "trust_evidence"
      ? "自动发现服务暂未配置，你可以先手动添加信任证据"
      : "自动发现服务暂未配置，你可以先手动添加已知信源");

  const invalidate = async () => {
    await utils.geo.discovery.listCandidates.invalidate({ projectId, type: candidateType });
  };

  const handleDiscover = async () => {
    try {
      const result = await discoverMutation.mutateAsync(projectQueryInput);
      await invalidate();
      if (!result.configured) {
        setDiscoverConfigured(false);
        await utils.geo.discovery.getProviderStatus.invalidate(providerQueryInput);
        toast.message(result.message ?? notConfiguredMessage);
        return;
      }
      setDiscoverConfigured(true);
      await utils.geo.discovery.getProviderStatus.invalidate(providerQueryInput);
      toast.success(result.message ?? "发现完成");
    } catch (error) {
      toast.error(toUserFacingErrorFromUnknown(error, "发现失败，请稍后重试"));
    }
  };

  const handleAccept = async (candidateId: number) => {
    try {
      await acceptMutation.mutateAsync({
        projectId,
        candidateId,
        targetType: candidateType,
      });
      await invalidate();
      await onAccepted?.();
      toast.success("已采纳到正式库");
    } catch (error) {
      toast.error(toUserFacingErrorFromUnknown(error, "采纳失败"));
    }
  };

  const handleIgnore = async (candidateId: number) => {
    try {
      await ignoreMutation.mutateAsync({ projectId, candidateId });
      await invalidate();
      toast.success("已忽略该候选");
    } catch (error) {
      toast.error(toUserFacingErrorFromUnknown(error, "操作失败"));
    }
  };

  const busy =
    discoverMutation.isPending || acceptMutation.isPending || ignoreMutation.isPending || listQuery.isLoading;

  return (
    <section
      className="rounded-xl border border-blue-100 bg-blue-50/40 p-4"
      data-testid={`${testIdPrefix}-discovery-panel`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900" data-testid={`${testIdPrefix}-discovery-title`}>
              {title}
            </h3>
          </div>
          <p className="mt-1 text-sm text-gray-600" data-testid={`${testIdPrefix}-discovery-description`}>
            {description}
          </p>
          {showNotConfigured ? (
            <p className="mt-2 text-xs text-amber-700" data-testid={`${testIdPrefix}-discovery-not-configured`}>
              {notConfiguredMessage}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          className="bg-blue-600 text-white hover:bg-blue-700"
          disabled={busy}
          onClick={() => void handleDiscover()}
          data-testid={`${testIdPrefix}-discovery-start`}
        >
          {discoverMutation.isPending ? <Spinner className="mr-1 size-3.5" /> : <Sparkles className="mr-1 size-3.5" />}
          {discoverButtonLabel}
        </Button>
      </div>

      {listQuery.isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Spinner className="size-4" />
          加载候选列表…
        </div>
      ) : pendingCandidates.length > 0 ? (
        <div className="mt-4 space-y-2" data-testid={`${testIdPrefix}-discovery-candidate-list`}>
          {pendingCandidates.map(candidate => {
            const signals = formatDiscoverySignals((candidate.detectedSignals ?? {}) as DiscoveryDetectedSignals);
            return (
              <div
                key={candidate.id}
                className="rounded-lg border border-white bg-white p-3 shadow-sm"
                data-testid={`${testIdPrefix}-discovery-candidate-${candidate.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{candidate.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>{candidate.sourceDomain || "未知域名"}</span>
                      <span>·</span>
                      <span>建议类型：{candidate.suggestedRecordType}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 ${confidenceBadgeClass(candidate.confidence)}`}
                      >
                        置信度 {resolveDiscoveryConfidenceLabel(candidate.confidence)}
                      </span>
                    </div>
                    {signals.length > 0 ? (
                      <p className="mt-1 text-xs text-gray-500">识别信号：{signals.join("、")}</p>
                    ) : null}
                    <a
                      href={candidate.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      查看链接
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void handleAccept(candidate.id)}
                      data-testid={`${testIdPrefix}-discovery-accept-${candidate.id}`}
                    >
                      <Check className="mr-1 size-3.5" />
                      {acceptButtonLabel}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void handleIgnore(candidate.id)}
                      data-testid={`${testIdPrefix}-discovery-ignore-${candidate.id}`}
                    >
                      <X className="mr-1 size-3.5" />
                      忽略
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500" data-testid={`${testIdPrefix}-discovery-empty`}>
          暂无待处理候选。点击上方按钮开始自动发现，或继续使用手动添加入口。
        </p>
      )}
    </section>
  );
}
