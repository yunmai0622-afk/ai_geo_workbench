import { DiscoveryCandidatesPanel } from "@/components/discovery/DiscoveryCandidatesPanel";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  TrustEvidenceDrawer,
  defaultTrustEvidenceForm,
  type TrustEvidenceFormState,
} from "@/components/enterpriseProfile/TrustEvidenceDrawer";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { useMaturityAutoCalculate } from "@/hooks/useMaturityAutoCalculate";
import { trpc } from "@/lib/trpc";
import {
  TRUST_EVIDENCE_TYPE_GROUPS,
  resolveTrustEvidenceTypeLabel,
  resolveTrustEvidenceVerificationLabel,
  type TrustEvidenceItemRow,
  type TrustEvidenceType,
} from "@shared/trustEvidence";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import {
  BarChart3,
  Briefcase,
  ExternalLink,
  FileText,
  Handshake,
  MessageSquareQuote,
  Newspaper,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Trophy,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const TRUST_EVIDENCE_EMPTY_MESSAGE =
  "还没有信任证据。添加媒体报道、客户评价、资质证书等，帮助 AI 判断为什么应该推荐你。";

function typeIcon(type: string) {
  switch (type) {
    case "case":
      return Briefcase;
    case "certificate":
      return ShieldCheck;
    case "media_coverage":
      return Newspaper;
    case "customer_review":
      return MessageSquareQuote;
    case "partnership":
      return Handshake;
    case "award":
      return Trophy;
    case "data_proof":
      return BarChart3;
    default:
      return FileText;
  }
}

function verificationBadgeClass(status: string): string {
  if (status === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function itemToForm(item: TrustEvidenceItemRow): TrustEvidenceFormState {
  return {
    evidenceType: item.evidenceType as TrustEvidenceType,
    title: item.title,
    summary: item.summary ?? "",
    content: item.content ?? "",
    sourceUrl: item.sourceUrl ?? "",
    isPublic: item.isPublic,
    verificationStatus: item.verificationStatus,
  };
}

function buildPayload(form: TrustEvidenceFormState) {
  return {
    evidenceType: form.evidenceType,
    title: form.title.trim(),
    summary: form.summary.trim() || null,
    content: form.content.trim() || null,
    sourceUrl: form.sourceUrl.trim() || null,
    isPublic: form.isPublic,
    verificationStatus: form.verificationStatus,
  };
}

type Props = {
  projectId?: number;
  embedded?: boolean;
};

export function TrustEvidenceManager({ projectId: projectIdProp, embedded = false }: Props) {
  const { selectedProjectId, enabled } = useActiveProjectSelection();
  const projectId = projectIdProp ?? selectedProjectId;
  const projectQueryInput = { projectId: projectId! };

  const utils = trpc.useUtils();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editItem, setEditItem] = useState<TrustEvidenceItemRow | null>(null);
  const [formInitial, setFormInitial] = useState<TrustEvidenceFormState>(() => defaultTrustEvidenceForm());

  const listQuery = trpc.geo.trustEvidence.getTrustEvidence.useQuery(projectQueryInput, {
    enabled: enabled && Boolean(projectId),
  });
  const summaryQuery = trpc.geo.trustEvidence.getTrustEvidenceSummary.useQuery(projectQueryInput, {
    enabled: enabled && Boolean(projectId),
  });

  const { triggerMaturityCalculate } = useMaturityAutoCalculate(projectId);
  const createMutation = trpc.geo.trustEvidence.createTrustEvidence.useMutation();
  const updateMutation = trpc.geo.trustEvidence.updateTrustEvidence.useMutation();
  const deleteMutation = trpc.geo.trustEvidence.deleteTrustEvidence.useMutation();

  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const groupedItems = useMemo(() => {
    const items = listQuery.data ?? [];
    return TRUST_EVIDENCE_TYPE_GROUPS.map(group => ({
      ...group,
      items: items.filter(item => (group.types as readonly string[]).includes(item.evidenceType)),
    })).filter(group => group.items.length > 0);
  }, [listQuery.data]);

  const invalidate = async () => {
    await Promise.all([
      utils.geo.trustEvidence.getTrustEvidence.invalidate(projectQueryInput),
      utils.geo.trustEvidence.getTrustEvidenceSummary.invalidate(projectQueryInput),
      utils.geo.trustEvidence.getTrustEvidenceMaturityScore.invalidate(projectQueryInput),
    ]);
  };

  const openCreate = () => {
    setDrawerMode("create");
    setEditItem(null);
    setFormInitial(defaultTrustEvidenceForm());
    setDrawerOpen(true);
  };

  const openEdit = (item: TrustEvidenceItemRow) => {
    setDrawerMode("edit");
    setEditItem(item);
    setFormInitial(itemToForm(item));
    setDrawerOpen(true);
  };

  const handleSubmit = async (form: TrustEvidenceFormState) => {
    if (!projectId) return;
    try {
      const payload = buildPayload(form);
      if (drawerMode === "create") {
        await createMutation.mutateAsync({ projectId, data: payload });
        toast.success("信任证据已添加");
      } else if (editItem) {
        await updateMutation.mutateAsync({ id: editItem.id, data: payload });
        toast.success("信任证据已更新");
      }
      setDrawerOpen(false);
      await invalidate();
      void triggerMaturityCalculate({ silent: true });
    } catch (error) {
      toast.error(toUserFacingErrorFromUnknown(error));
    }
  };

  const handleDelete = async (item: TrustEvidenceItemRow) => {
    if (!window.confirm(`确定删除「${item.title}」？`)) return;
    try {
      await deleteMutation.mutateAsync({ id: item.id });
      toast.success("已删除");
      await invalidate();
      void triggerMaturityCalculate({ silent: true });
    } catch (error) {
      toast.error(toUserFacingErrorFromUnknown(error));
    }
  };

  if (!projectId) {
    return <p className="text-sm text-gray-500">请先选择项目后再管理信任证据。</p>;
  }

  const wrapperClass = embedded ? "space-y-4" : "space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm";

  return (
    <section className={wrapperClass} data-testid="trust-evidence-manager">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">信任证据库</h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            管理媒体报道、客户评价、资质证书等信任证据。
            点击「手动添加证据」录入已有证据，
            或点击「开始发现证据」让 AI 自动搜索公开证据。
          </p>
          {summaryQuery.data ? (
            <p className="mt-2 text-xs text-gray-500" data-testid="trust-evidence-summary">
              共 {summaryQuery.data.totalCount} 条 · 已验证 {summaryQuery.data.verifiedCount} 条 · 客户案例已确认{" "}
              {summaryQuery.data.confirmedCustomerCaseCount} 条
            </p>
          ) : null}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={openCreate}>
          <Plus className="mr-1 size-3.5" />
          手动添加证据
        </Button>
      </div>

      <DiscoveryCandidatesPanel
        projectId={projectId}
        candidateType="trust_evidence"
        title="AI 自动发现信任证据"
        description="尝试发现媒体报道、客户评价等公开证据，帮助 AI 判断为什么应该推荐你"
        discoverButtonLabel="开始发现证据"
        acceptButtonLabel="采纳为证据"
        testIdPrefix="trust-evidence"
        onAccepted={invalidate}
      />

      {listQuery.isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
          <Spinner className="size-4" />
          加载信任证据…
        </div>
      ) : (listQuery.data?.length ?? 0) === 0 ? (
        <div
          className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500"
          data-testid="trust-evidence-empty"
        >
          {TRUST_EVIDENCE_EMPTY_MESSAGE}
          <div className="mt-4">
            <Button type="button" size="sm" variant="outline" onClick={openCreate}>
              <Plus className="mr-1 size-3.5" />
              添加第一条证据
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5" data-testid="trust-evidence-grouped-list">
          {groupedItems.map(group => (
            <div key={group.key} data-testid={`trust-evidence-group-${group.key}`}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{group.label}</p>
              <div className="space-y-2">
                {group.items.map(item => {
                  const Icon = typeIcon(item.evidenceType);
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-start gap-3 rounded-lg border border-gray-200 bg-white p-3"
                      data-testid={`trust-evidence-item-${item.id}`}
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-900">{item.title}</p>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${verificationBadgeClass(item.verificationStatus)}`}
                          >
                            {resolveTrustEvidenceVerificationLabel(item.verificationStatus)}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {resolveTrustEvidenceTypeLabel(item.evidenceType)}
                          </span>
                        </div>
                        {item.summary ? <p className="mt-1 text-sm text-gray-600">{item.summary}</p> : null}
                        {item.sourceUrl ? (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            来源链接
                            <ExternalLink className="size-3" />
                          </a>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => openEdit(item)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 text-gray-400 hover:text-red-500"
                          disabled={saving}
                          onClick={() => void handleDelete(item)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <TrustEvidenceDrawer
        open={drawerOpen}
        mode={drawerMode}
        saving={saving}
        initial={formInitial}
        onOpenChange={setDrawerOpen}
        onSubmit={form => void handleSubmit(form)}
      />
    </section>
  );
}

/** Step 6 建档向导可复用区块 */
export function TrustEvidenceStep6Section(props: Props) {
  return <TrustEvidenceManager {...props} />;
}
