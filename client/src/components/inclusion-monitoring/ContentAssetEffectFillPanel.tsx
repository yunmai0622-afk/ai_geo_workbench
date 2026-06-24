import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { trpc } from "@/lib/trpc";
import {
  EFFECT_DATA_SOURCES,
  EFFECT_DATA_SOURCE_LABEL_CN,
  EFFECT_INCLUSION_STATUSES,
  EFFECT_INCLUSION_STATUS_LABEL_CN,
  parseKeywordList,
  type EffectDataSource,
  type EffectInclusionStatus,
} from "@shared/contentAssetEffectTracking";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export type ContentAssetEffectRecord = {
  id: number;
  effectInclusionStatus?: EffectInclusionStatus | string | null;
  inclusionVerifiedAt?: Date | string | null;
  inclusionKeywords?: string[] | null;
  readCount?: number | null;
  impressionCount?: number | null;
  interactionCount?: number | null;
  searchTriggerKeywords?: string[] | null;
  effectDataSource?: EffectDataSource | string | null;
  evidenceScreenshotUrl?: string | null;
  evidenceNotes?: string | null;
};

type Props = {
  projectId: number;
  record: ContentAssetEffectRecord;
  onSaved: () => void;
};

function toDateInputValue(value?: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toNumberInput(value?: number | null) {
  return value == null ? "" : String(value);
}

export function ContentAssetEffectFillPanel({ projectId, record, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [effectInclusionStatus, setEffectInclusionStatus] = useState<EffectInclusionStatus>("pending");
  const [inclusionVerifiedAt, setInclusionVerifiedAt] = useState("");
  const [inclusionKeywords, setInclusionKeywords] = useState("");
  const [readCount, setReadCount] = useState("");
  const [impressionCount, setImpressionCount] = useState("");
  const [interactionCount, setInteractionCount] = useState("");
  const [searchTriggerKeywords, setSearchTriggerKeywords] = useState("");
  const [effectDataSource, setEffectDataSource] = useState<EffectDataSource | "">("manual");
  const [evidenceScreenshotUrl, setEvidenceScreenshotUrl] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");

  useEffect(() => {
    setEffectInclusionStatus((record.effectInclusionStatus as EffectInclusionStatus) ?? "pending");
    setInclusionVerifiedAt(toDateInputValue(record.inclusionVerifiedAt));
    setInclusionKeywords((record.inclusionKeywords ?? []).join("，"));
    setReadCount(toNumberInput(record.readCount));
    setImpressionCount(toNumberInput(record.impressionCount));
    setInteractionCount(toNumberInput(record.interactionCount));
    setSearchTriggerKeywords((record.searchTriggerKeywords ?? []).join("，"));
    setEffectDataSource((record.effectDataSource as EffectDataSource) ?? "manual");
    setEvidenceScreenshotUrl(record.evidenceScreenshotUrl ?? "");
    setEvidenceNotes(record.evidenceNotes ?? "");
  }, [record]);

  const saveMutation = trpc.geo.inclusionMonitoring.updateEffectData.useMutation({
    onSuccess: async () => {
      toast.success("效果数据已保存");
      setOpen(false);
      onSaved();
    },
    onError: error => toast.error(toUserFacingErrorFromUnknown(error, "保存失败")),
  });

  const handleSave = () => {
    saveMutation.mutate({
      projectId,
      recordId: record.id,
      effectInclusionStatus,
      inclusionVerifiedAt: inclusionVerifiedAt || null,
      inclusionKeywords,
      readCount: readCount === "" ? null : Number(readCount),
      impressionCount: impressionCount === "" ? null : Number(impressionCount),
      interactionCount: interactionCount === "" ? null : Number(interactionCount),
      searchTriggerKeywords,
      effectDataSource: effectDataSource || null,
      evidenceScreenshotUrl: evidenceScreenshotUrl || null,
      evidenceNotes: evidenceNotes || null,
    });
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-3" data-testid={`content-asset-effect-fill-${record.id}`}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={`h-7 px-2 text-xs ${geoP0Brand.primaryOutline}`}
        onClick={() => setOpen(value => !value)}
        data-testid={`content-asset-effect-fill-toggle-${record.id}`}
      >
        {open ? "收起填写面板" : "填写效果数据"}
      </Button>
      {open ? (
        <div className="mt-3 grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            收录状态
            <select
              value={effectInclusionStatus}
              onChange={e => setEffectInclusionStatus(e.target.value as EffectInclusionStatus)}
              className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
              data-testid={`effect-inclusion-status-${record.id}`}
            >
              {EFFECT_INCLUSION_STATUSES.map(status => (
                <option key={status} value={status}>
                  {EFFECT_INCLUSION_STATUS_LABEL_CN[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            收录时间
            <input
              type="date"
              value={inclusionVerifiedAt}
              onChange={e => setInclusionVerifiedAt(e.target.value)}
              className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
              data-testid={`effect-inclusion-verified-at-${record.id}`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 sm:col-span-2">
            收录验证关键词（多个用逗号分隔）
            <input
              value={inclusionKeywords}
              onChange={e => setInclusionKeywords(e.target.value)}
              className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
              placeholder="例如：品牌名, 产品关键词"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            阅读量
            <input
              type="number"
              min={0}
              value={readCount}
              onChange={e => setReadCount(e.target.value)}
              className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            曝光量
            <input
              type="number"
              min={0}
              value={impressionCount}
              onChange={e => setImpressionCount(e.target.value)}
              className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            互动量
            <input
              type="number"
              min={0}
              value={interactionCount}
              onChange={e => setInteractionCount(e.target.value)}
              className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            搜索触发关键词
            <input
              value={searchTriggerKeywords}
              onChange={e => setSearchTriggerKeywords(e.target.value)}
              className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            数据来源
            <select
              value={effectDataSource}
              onChange={e => setEffectDataSource(e.target.value as EffectDataSource)}
              className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
            >
              <option value="">未选择</option>
              {EFFECT_DATA_SOURCES.map(source => (
                <option key={source} value={source}>
                  {EFFECT_DATA_SOURCE_LABEL_CN[source]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 sm:col-span-2">
            截图凭证 URL
            <input
              value={evidenceScreenshotUrl}
              onChange={e => setEvidenceScreenshotUrl(e.target.value)}
              className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
              placeholder="上传图片链接或截图地址"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 sm:col-span-2">
            备注
            <textarea
              value={evidenceNotes}
              onChange={e => setEvidenceNotes(e.target.value)}
              rows={2}
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className={geoP0Brand.primary}
              disabled={saveMutation.isPending}
              onClick={handleSave}
              data-testid={`content-asset-effect-save-${record.id}`}
            >
              {saveMutation.isPending ? "保存中…" : "保存效果数据"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}