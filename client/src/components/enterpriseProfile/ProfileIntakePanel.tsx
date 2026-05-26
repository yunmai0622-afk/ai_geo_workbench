import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ENTERPRISE_INDUSTRY_OPTIONS } from "@shared/enterpriseProfileIndustry";
import { FileUp, Sparkles, CheckCircle2, AlertTriangle, MinusCircle } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

export type EnterpriseProfileAnalysisResult = {
  brandName: string | null;
  industry: string | null;
  customIndustry: string | null;
  businessSummary: string | null;
  mainPlatforms: string | null;
  targetCustomers: string | null;
  customerPainPoints: string[];
  competitors: string[];
  caseSummary: string | null;
  caseActions: string | null;
  caseResults: string | null;
  confidenceNotes: string[];
};

export type ProfileApplyPatch = {
  brandName?: string;
  industrySelect?: string;
  industryCustom?: string;
  productDesc?: string;
  mainChannel?: string;
  targetCustomer?: string;
  customerPains?: string[];
  competitors?: string[];
  caseDraft?: { customerBackground: string; executionProcess: string; resultData: string };
  aiFilledKeys: string[];
};

type ApplyFieldKey =
  | "brandName"
  | "industry"
  | "productDesc"
  | "mainChannel"
  | "targetCustomer"
  | "customerPains"
  | "competitors"
  | "case";

const DOC_TYPE_HINTS = [
  "企业介绍文档",
  "产品介绍文档",
  "客户案例文档",
  "销售话术",
  "官网 / 公众号文章",
  "其他说明材料",
] as const;

const APPLY_FIELD_LABELS: Record<ApplyFieldKey, string> = {
  brandName: "企业/品牌名称",
  industry: "行业方向",
  productDesc: "主营业务",
  mainChannel: "主要平台/阵地",
  targetCustomer: "目标客户",
  customerPains: "客户痛点",
  competitors: "主要竞品",
  case: "客户案例",
};

function hasText(v: string | string[] | undefined): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v?.trim());
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file, "UTF-8");
  });
}

type Props = {
  projectId: number | undefined;
  enterpriseName: string;
  disabled?: boolean;
  showPendingSaveHint?: boolean;
  current: {
    brandName: string;
    industryTagValue: string;
    productDesc: string;
    mainChannel: string;
    targetCustomer: string;
    customerPains: string[];
    competitors: string[];
    hasCaseContent: boolean;
  };
  onApply: (patch: ProfileApplyPatch) => void;
  sectionTitle?: string;
  sectionDescription?: string;
};

const INTAKE_RECOGNIZED_ITEMS = [
  "品牌与业务",
  "目标客户",
  "客户痛点",
  "案例素材",
  "信任背书",
] as const;

export function ProfileIntakePanel({
  projectId,
  enterpriseName,
  disabled,
  showPendingSaveHint,
  current,
  onApply,
  sectionTitle = "先上传企业资料",
  sectionDescription = "系统会从企业介绍、官网文案、招商资料、案例文档中自动识别品牌信息、客户画像和信任素材。应用后仅填入表单，不会自动保存。",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docText, setDocText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<EnterpriseProfileAnalysisResult | null>(null);
  const [applyMode, setApplyMode] = useState<"empty" | "selected">("empty");
  const [overwriteConfirm, setOverwriteConfirm] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Record<ApplyFieldKey, boolean>>({
    brandName: true,
    industry: true,
    productDesc: true,
    mainChannel: true,
    targetCustomer: true,
    customerPains: true,
    competitors: true,
    case: true,
  });
  const [localError, setLocalError] = useState<string>();
  const [localMessage, setLocalMessage] = useState<string>();

  const analyzeMutation = trpc.geo.assetLibrary.analyzeDocument.useMutation();

  const proposed = useMemo(() => {
    if (!analysis) return null;
    const industrySelect =
      analysis.industry && (ENTERPRISE_INDUSTRY_OPTIONS as readonly string[]).includes(analysis.industry)
        ? analysis.industry
        : analysis.industry
          ? "其他"
          : null;
    const industryCustom =
      industrySelect === "其他" ? analysis.customIndustry || analysis.industry || "" : analysis.customIndustry || "";
    const hasCase =
      Boolean(analysis.caseSummary?.trim()) ||
      Boolean(analysis.caseActions?.trim()) ||
      Boolean(analysis.caseResults?.trim());
    return {
      brandName: analysis.brandName,
      industrySelect,
      industryCustom,
      productDesc: analysis.businessSummary,
      mainChannel: analysis.mainPlatforms,
      targetCustomer: analysis.targetCustomers,
      customerPains: analysis.customerPainPoints,
      competitors: analysis.competitors,
      hasCase,
      case: hasCase
        ? {
            customerBackground: analysis.caseSummary ?? "",
            executionProcess: analysis.caseActions ?? "",
            resultData: analysis.caseResults ?? "",
          }
        : null,
    };
  }, [analysis]);

  const fieldRows = useMemo(() => {
    if (!proposed) return [];
    const rows: Array<{ key: ApplyFieldKey; label: string; preview: string; status: "fill" | "overwrite" | "missing" }> = [];
    const push = (key: ApplyFieldKey, preview: string, hasValue: boolean, currentHas: boolean) => {
      if (!hasValue) {
        rows.push({ key, label: APPLY_FIELD_LABELS[key], preview: "未识别，请手动补充", status: "missing" });
        return;
      }
      rows.push({
        key,
        label: APPLY_FIELD_LABELS[key],
        preview,
        status: currentHas ? "overwrite" : "fill",
      });
    };
    push("brandName", proposed.brandName ?? "", Boolean(proposed.brandName), hasText(current.brandName));
    const indPreview =
      proposed.industrySelect === "其他"
        ? `其他：${proposed.industryCustom || "—"}`
        : proposed.industrySelect ?? "未识别";
    push("industry", indPreview, Boolean(proposed.industrySelect), hasText(current.industryTagValue));
    push("productDesc", proposed.productDesc ?? "", Boolean(proposed.productDesc), hasText(current.productDesc));
    push("mainChannel", proposed.mainChannel ?? "", Boolean(proposed.mainChannel), hasText(current.mainChannel));
    push("targetCustomer", proposed.targetCustomer ?? "", Boolean(proposed.targetCustomer), hasText(current.targetCustomer));
    push(
      "customerPains",
      proposed.customerPains.length ? proposed.customerPains.join("、") : "",
      proposed.customerPains.length > 0,
      current.customerPains.length > 0,
    );
    push(
      "competitors",
      proposed.competitors.length ? proposed.competitors.join("、") : "",
      proposed.competitors.length > 0,
      current.competitors.length > 0,
    );
    if (proposed.hasCase && proposed.case) {
      push(
        "case",
        [proposed.case.customerBackground, proposed.case.executionProcess, proposed.case.resultData].filter(Boolean).join(" / "),
        true,
        current.hasCaseContent,
      );
    } else {
      rows.push({ key: "case", label: APPLY_FIELD_LABELS.case, preview: "未识别，请手动补充", status: "missing" });
    }
    return rows;
  }, [proposed, current]);

  const handleFile = useCallback(async (file: File) => {
    setFileNotice(null);
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".docx") || lower.endsWith(".pdf") || lower.endsWith(".doc")) {
      setFileName(file.name);
      setFileNotice("即将支持 Word / PDF 自动解析，本轮请先粘贴文本或上传 .txt / .md 文件。");
      return;
    }
    if (!lower.endsWith(".txt") && !lower.endsWith(".md")) {
      setFileNotice("当前支持 .txt / .md，或使用下方粘贴区。");
      return;
    }
    const text = await readFileAsText(file);
    setDocText(prev => (prev.trim() ? `${prev.trim()}\n\n${text.trim()}` : text.trim()));
    setFileName(file.name);
  }, []);

  async function runAnalyze() {
    if (!projectId) {
      setLocalError("请先选择项目");
      return;
    }
    const text = docText.trim();
    if (text.length < 20) {
      setLocalError("请上传或粘贴至少 20 字的企业资料");
      return;
    }
    setLocalError(undefined);
    setLocalMessage(undefined);
    setAnalysis(null);
    try {
      const res = await analyzeMutation.mutateAsync({ projectId, documentText: text });
      setAnalysis(res.analysis as EnterpriseProfileAnalysisResult);
      setLocalMessage("AI 已识别品牌与业务、客户画像、案例与信任素材，请预览后应用到表单。");
      setApplyMode("empty");
      setOverwriteConfirm(false);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "解析失败");
    }
  }

  function applyToForm() {
    if (!proposed) return;
    const needsOverwrite = fieldRows.some(r => r.status === "overwrite");
    if (needsOverwrite && !overwriteConfirm) {
      setLocalError("部分字段已有内容，请勾选「覆盖已有内容」后再应用");
      return;
    }
    const shouldApply = (key: ApplyFieldKey) => {
      if (applyMode === "selected") return selectedFields[key];
      const row = fieldRows.find(r => r.key === key);
      if (!row || row.status === "missing") return false;
      if (row.status === "overwrite") return overwriteConfirm;
      return row.status === "fill";
    };

    const aiFilledKeys: string[] = [];
    const patch: ProfileApplyPatch = { aiFilledKeys };

    if (shouldApply("brandName") && proposed.brandName) {
      patch.brandName = proposed.brandName;
      aiFilledKeys.push("brandName");
    }
    if (shouldApply("industry") && proposed.industrySelect) {
      patch.industrySelect = proposed.industrySelect;
      patch.industryCustom = proposed.industryCustom;
      aiFilledKeys.push("industry");
    }
    if (shouldApply("productDesc") && proposed.productDesc) {
      patch.productDesc = proposed.productDesc.slice(0, 200);
      aiFilledKeys.push("productDesc");
    }
    if (shouldApply("mainChannel") && proposed.mainChannel) {
      patch.mainChannel = proposed.mainChannel;
      aiFilledKeys.push("mainChannel");
    }
    if (shouldApply("targetCustomer") && proposed.targetCustomer) {
      patch.targetCustomer = proposed.targetCustomer;
      aiFilledKeys.push("targetCustomer");
    }
    if (shouldApply("customerPains") && proposed.customerPains.length) {
      patch.customerPains = proposed.customerPains;
      aiFilledKeys.push("customerPains");
    }
    if (shouldApply("competitors") && proposed.competitors.length) {
      patch.competitors = proposed.competitors;
      aiFilledKeys.push("competitors");
    }
    if (shouldApply("case") && proposed.case) {
      patch.caseDraft = proposed.case;
      aiFilledKeys.push("case");
    }

    if (aiFilledKeys.length === 0) {
      setLocalError("没有可应用的字段，请手动补充或重新上传资料");
      return;
    }
    patch.aiFilledKeys = aiFilledKeys;
    onApply(patch);
    setLocalMessage(`已应用 ${aiFilledKeys.length} 项到表单，请核对后点击各区块保存。`);
    setLocalError(undefined);
  }

  const missingFields = useMemo(() => fieldRows.filter(r => r.status === "missing").map(r => r.label), [fieldRows]);

  return (
    <div className="scroll-mt-24 space-y-4" data-testid="profile-intake-panel">
      {/* Section Header */}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-gray-900">{sectionTitle}</h3>
        <p className="text-sm text-gray-500">{sectionDescription}</p>
      </div>

      {/* Main Upload Card */}
      <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
        {enterpriseName.trim() ? (
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
            当前资料将应用到：<span className="font-semibold text-blue-900">{enterpriseName}</span>
          </p>
        ) : (
          <p className="text-sm text-amber-700">请先创建或选择企业项目，再上传资料进行 AI 建档。</p>
        )}
        {showPendingSaveHint ? (
          <p className="text-xs text-blue-600">已应用到表单的内容尚未保存，请在下方档案确认区点击对应「保存」按钮。</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {DOC_TYPE_HINTS.map(t => (
            <span key={t} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] text-gray-600">
              {t}
            </span>
          ))}
        </div>
        <div
          className={cn(
            "flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 px-4 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50",
            disabled && "pointer-events-none opacity-50",
          )}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={e => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
        >
          <FileUp className="h-8 w-8 text-blue-500" />
          <p className="text-sm font-medium text-gray-900">拖拽文件到此处，或点击上传</p>
          <p className="text-xs text-gray-500">P0 支持 .txt / .md；Word / PDF 即将支持</p>
          {fileName ? <p className="text-xs text-blue-600">已选文件：{fileName}</p> : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        {fileNotice ? <p className="text-xs text-amber-600">{fileNotice}</p> : null}
        <label className="block space-y-2 text-sm">
          <span className="font-medium text-gray-700">或粘贴企业资料全文</span>
          <textarea
            value={docText}
            onChange={e => setDocText(e.target.value)}
            rows={8}
            placeholder="粘贴企业介绍、官网文案、产品说明、案例摘要等…"
            className="w-full max-w-none resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            disabled={disabled}
          />
          <span className="text-xs text-gray-500">{docText.trim().length} 字</span>
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={disabled || !projectId || analyzeMutation.isPending}
            onClick={() => void runAnalyze()}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {analyzeMutation.isPending ? "AI 解析中…" : "AI 解析并填充档案"}
          </Button>
        </div>
        {localError ? <p className="text-sm text-red-600">{localError}</p> : null}
        {localMessage ? <p className="text-sm text-emerald-600">{localMessage}</p> : null}
      </div>

      {/* Analysis Result Preview */}
      {analysis ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-gray-900">AI 识别结果预览</h3>
            <p className="text-sm text-gray-500">确认后再写入下方表单；默认只填充空字段，不会静默覆盖已有内容。</p>
          </div>
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
            {analysis.confidenceNotes.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                <p className="font-medium text-amber-900">可信度提示</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {analysis.confidenceNotes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="space-y-3">
              {fieldRows.map(row => (
                <div key={row.key} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{row.label}</p>
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                      row.status === "fill" && "bg-emerald-50 text-emerald-700",
                      row.status === "overwrite" && "bg-amber-50 text-amber-700",
                      row.status === "missing" && "bg-gray-100 text-gray-500",
                    )}>
                      {row.status === "fill" && <><CheckCircle2 className="h-3 w-3" /> 将填充</>}
                      {row.status === "overwrite" && <><AlertTriangle className="h-3 w-3" /> 已有内容，将覆盖</>}
                      {row.status === "missing" && <><MinusCircle className="h-3 w-3" /> 未识别</>}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{row.preview}</p>
                  {applyMode === "selected" ? (
                    <label className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={selectedFields[row.key]}
                        onChange={e => setSelectedFields(s => ({ ...s, [row.key]: e.target.checked }))}
                        disabled={row.status === "missing"}
                        className="accent-blue-600"
                      />
                      应用此字段
                    </label>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4 border-t border-gray-200 pt-4 text-sm">
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="radio"
                  checked={applyMode === "empty"}
                  onChange={() => setApplyMode("empty")}
                  className="accent-blue-600"
                />
                只应用空字段（默认）
              </label>
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="radio"
                  checked={applyMode === "selected"}
                  onChange={() => setApplyMode("selected")}
                  className="accent-blue-600"
                />
                手动勾选应用字段
              </label>
              <label className="flex items-center gap-2 text-amber-700">
                <input type="checkbox" checked={overwriteConfirm} onChange={e => setOverwriteConfirm(e.target.checked)} className="accent-amber-600" />
                覆盖已有内容
              </label>
            </div>
            {missingFields.length > 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
                <p className="font-medium text-gray-700">未识别字段（请手动补充）</p>
                <p className="mt-1">{missingFields.join("、")}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => setApplyMode("empty")}>
                全部应用（仅空字段）
              </Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={applyToForm}>
                应用到企业档案
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AiFilledMark({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="ml-2 text-[10px] font-normal text-blue-600">AI 已填充</span>;
}
