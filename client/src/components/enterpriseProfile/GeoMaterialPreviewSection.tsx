import { Button } from "@/components/ui/button";
import { aiGlassPanel, aiPrimaryBtn } from "@/lib/aiProductUi";
import { cn } from "@/lib/utils";
import { ProfileSectionShell } from "./ProfileSectionShell";

type PreviewModel = {
  brandName: string;
  industry: string;
  oneLiner: string;
  productDesc: string;
  keyPoints: string[];
  targetCustomer: string;
  customerPains: string[];
  searchQuestions: string[];
  caseSnippets: string[];
  trustSummary: string;
};

type Props = {
  model: PreviewModel;
  onGoProduction: () => void;
};

export function GeoMaterialPreviewSection({ model, onGoProduction }: Props) {
  return (
    <ProfileSectionShell
      id="profile-geo-preview"
      title="GEO 建档预览"
      description="汇总将用于内容生成的关键信息；缺项会标注「待补充」。"
      status="已完成"
      extraActions={
        <Button type="button" size="sm" className={aiPrimaryBtn} data-testid="geo-onboarding-go-production" onClick={onGoProduction}>
          进入内容生产
        </Button>
      }
    >
      <div className={cn(aiGlassPanel, "grid gap-4 p-5 md:grid-cols-2")} data-testid="geo-onboarding-preview">
        <PreviewBlock title="品牌实体" lines={lineOrPending([model.brandName, model.industry, model.oneLiner])} />
        <PreviewBlock title="主营服务" lines={lineOrPending([model.productDesc])} />
        <PreviewBlock title="核心卖点" lines={model.keyPoints.length ? model.keyPoints : ["待补充"]} />
        <PreviewBlock title="目标客户" lines={lineOrPending([model.targetCustomer])} />
        <PreviewBlock title="目标搜索问题" lines={model.searchQuestions.length ? model.searchQuestions : ["待补充"]} />
        <PreviewBlock title="客户案例" lines={model.caseSnippets.length ? model.caseSnippets : ["待补充"]} />
        <PreviewBlock title="信任素材完整度" lines={[model.trustSummary]} />
      </div>
    </ProfileSectionShell>
  );
}

function lineOrPending(parts: string[]): string[] {
  const lines = parts.map(p => p.trim()).filter(Boolean);
  return lines.length ? lines : ["待补充"];
}

function PreviewBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div>
      <p className="text-sm font-medium text-blue-600">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-gray-600">
        {lines.map((l, i) => (
          <li key={`${title}-${i}`} className="leading-relaxed">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
