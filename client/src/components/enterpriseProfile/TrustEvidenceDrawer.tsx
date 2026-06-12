import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  TRUST_EVIDENCE_TYPES,
  TRUST_EVIDENCE_VERIFICATION_STATUSES,
  type TrustEvidenceType,
  type TrustEvidenceVerificationStatus,
} from "@shared/trustEvidence";
import { useEffect, useState } from "react";

export type TrustEvidenceFormState = {
  evidenceType: TrustEvidenceType;
  title: string;
  summary: string;
  content: string;
  sourceUrl: string;
  isPublic: boolean;
  verificationStatus: TrustEvidenceVerificationStatus;
};

export function defaultTrustEvidenceForm(): TrustEvidenceFormState {
  return {
    evidenceType: "media_coverage",
    title: "",
    summary: "",
    content: "",
    sourceUrl: "",
    isPublic: true,
    verificationStatus: "draft",
  };
}

type Props = {
  open: boolean;
  mode: "create" | "edit";
  saving: boolean;
  initial: TrustEvidenceFormState;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: TrustEvidenceFormState) => void;
};

export function TrustEvidenceDrawer({ open, mode, saving, initial, onOpenChange, onSubmit }: Props) {
  const [form, setForm] = useState<TrustEvidenceFormState>(initial);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="flex max-h-[80vh] flex-col"
        data-testid="trust-evidence-drawer"
      >
        <DrawerHeader className="shrink-0">
          <DrawerTitle>{mode === "create" ? "添加信任证据" : "编辑信任证据"}</DrawerTitle>
          <DrawerDescription>录入媒体报道、客户评价、资质证书等，帮助 AI 判断为什么应该推荐你。</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 max-h-[calc(80vh-11rem)] flex-1 space-y-4 overflow-y-auto px-4 pb-2">
          <div className="space-y-2">
            <Label htmlFor="trust-evidence-type">证据类型</Label>
            <Select
              value={form.evidenceType}
              onValueChange={value =>
                setForm(current => ({ ...current, evidenceType: value as TrustEvidenceType }))
              }
            >
              <SelectTrigger id="trust-evidence-type" data-testid="trust-evidence-form-type">
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                {TRUST_EVIDENCE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trust-evidence-title">
              标题 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="trust-evidence-title"
              data-testid="trust-evidence-form-title"
              value={form.title}
              onChange={e => setForm(current => ({ ...current, title: e.target.value }))}
              placeholder="例如：XX 媒体报道标题"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trust-evidence-summary">摘要</Label>
            <Textarea
              id="trust-evidence-summary"
              value={form.summary}
              onChange={e => setForm(current => ({ ...current, summary: e.target.value }))}
              placeholder="一句话说明这条证据的价值"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trust-evidence-content">详细内容</Label>
            <Textarea
              id="trust-evidence-content"
              className="min-h-[6rem]"
              value={form.content}
              onChange={e => setForm(current => ({ ...current, content: e.target.value }))}
              placeholder="可粘贴报道正文、评价原文或证书说明"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trust-evidence-source-url">来源链接</Label>
            <Input
              id="trust-evidence-source-url"
              value={form.sourceUrl}
              onChange={e => setForm(current => ({ ...current, sourceUrl: e.target.value }))}
              placeholder="https://"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
            <Label htmlFor="trust-evidence-is-public" className="cursor-pointer">
              是否公开
            </Label>
            <Switch
              id="trust-evidence-is-public"
              checked={form.isPublic}
              onCheckedChange={checked => setForm(current => ({ ...current, isPublic: checked }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trust-evidence-verification">验证状态</Label>
            <Select
              value={form.verificationStatus}
              onValueChange={value =>
                setForm(current => ({
                  ...current,
                  verificationStatus: value as TrustEvidenceVerificationStatus,
                }))
              }
            >
              <SelectTrigger id="trust-evidence-verification" data-testid="trust-evidence-form-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRUST_EVIDENCE_VERIFICATION_STATUSES.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DrawerFooter className="sticky bottom-0 shrink-0 border-t border-gray-100 bg-white">
          <Button
            type="button"
            data-testid="trust-evidence-form-submit"
            disabled={saving || !form.title.trim()}
            onClick={() => onSubmit(form)}
          >
            {saving ? "保存中…" : mode === "create" ? "添加" : "保存"}
          </Button>
          <DrawerClose asChild>
            <Button type="button" variant="outline">
              取消
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
