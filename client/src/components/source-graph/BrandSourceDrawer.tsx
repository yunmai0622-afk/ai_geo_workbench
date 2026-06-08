import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  BRAND_SOURCE_INDICATORS,
  BRAND_SOURCE_PLATFORMS,
  type BrandSourceIndicatorKey,
  type BrandSourceRecordRow,
} from "@shared/brandSourceGraph";
import { useEffect, useState } from "react";

export type BrandSourceFormState = {
  platform: string;
  platformName: string;
  url: string;
  isPubliclyAccessible: boolean;
  containsBrandName: boolean;
  containsOfficialSite: boolean;
  containsCoreKeywords: boolean;
  aiCitationConfirmed: boolean;
  isCrossSourceConsistent: boolean;
  notes: string;
  lastVerifiedAt: string;
};

export function defaultBrandSourceForm(): BrandSourceFormState {
  return {
    platform: "official_site",
    platformName: "",
    url: "",
    isPubliclyAccessible: false,
    containsBrandName: false,
    containsOfficialSite: false,
    containsCoreKeywords: false,
    aiCitationConfirmed: false,
    isCrossSourceConsistent: false,
    notes: "",
    lastVerifiedAt: "",
  };
}

export function recordToBrandSourceForm(record: BrandSourceRecordRow): BrandSourceFormState {
  return {
    platform: record.platform,
    platformName: record.platformName ?? "",
    url: record.url ?? "",
    isPubliclyAccessible: record.isPubliclyAccessible,
    containsBrandName: record.containsBrandName,
    containsOfficialSite: record.containsOfficialSite,
    containsCoreKeywords: record.containsCoreKeywords,
    aiCitationConfirmed: record.aiCitationConfirmed,
    isCrossSourceConsistent: record.isCrossSourceConsistent,
    notes: record.notes ?? "",
    lastVerifiedAt: record.lastVerifiedAt
      ? new Date(record.lastVerifiedAt).toISOString().slice(0, 16)
      : "",
  };
}

type Props = {
  open: boolean;
  mode: "create" | "edit";
  saving: boolean;
  initial: BrandSourceFormState;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: BrandSourceFormState) => void;
};

export function BrandSourceDrawer({ open, mode, saving, initial, onOpenChange, onSubmit }: Props) {
  const [form, setForm] = useState<BrandSourceFormState>(initial);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  function toggleIndicator(key: BrandSourceIndicatorKey, checked: boolean) {
    setForm(current => ({ ...current, [key]: checked }));
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent data-testid="brand-source-drawer">
        <DrawerHeader>
          <DrawerTitle>{mode === "create" ? "添加信源" : "编辑信源"}</DrawerTitle>
          <DrawerDescription>录入平台信源 URL 与六项一致性指标，供人工验证与评分。</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 px-4 pb-2">
          <div className="space-y-2">
            <Label htmlFor="brand-source-platform">平台</Label>
            <Select
              value={form.platform}
              onValueChange={value => setForm(current => ({ ...current, platform: value }))}
            >
              <SelectTrigger id="brand-source-platform" data-testid="brand-source-form-platform">
                <SelectValue placeholder="选择平台" />
              </SelectTrigger>
              <SelectContent>
                {BRAND_SOURCE_PLATFORMS.map(platform => (
                  <SelectItem key={platform.value} value={platform.value}>
                    {platform.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.platform === "other" ? (
            <div className="space-y-2">
              <Label htmlFor="brand-source-platform-name">自定义平台名</Label>
              <Input
                id="brand-source-platform-name"
                data-testid="brand-source-form-platform-name"
                value={form.platformName}
                onChange={e => setForm(current => ({ ...current, platformName: e.target.value }))}
                placeholder="例如：行业垂直社区"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="brand-source-url">信源 URL</Label>
            <Input
              id="brand-source-url"
              data-testid="brand-source-form-url"
              value={form.url}
              onChange={e => setForm(current => ({ ...current, url: e.target.value }))}
              placeholder="https://"
            />
          </div>

          <div className="space-y-2">
            <Label>六项指标</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {BRAND_SOURCE_INDICATORS.map(indicator => (
                <label
                  key={indicator.key}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={form[indicator.key]}
                    onCheckedChange={checked => toggleIndicator(indicator.key, checked === true)}
                    data-testid={`brand-source-indicator-${indicator.key}`}
                  />
                  <span>{indicator.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand-source-notes">备注</Label>
            <Textarea
              id="brand-source-notes"
              data-testid="brand-source-form-notes"
              value={form.notes}
              onChange={e => setForm(current => ({ ...current, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand-source-verified-at">最近验证时间</Label>
            <Input
              id="brand-source-verified-at"
              type="datetime-local"
              data-testid="brand-source-form-verified-at"
              value={form.lastVerifiedAt}
              onChange={e => setForm(current => ({ ...current, lastVerifiedAt: e.target.value }))}
            />
          </div>
        </div>
        <DrawerFooter>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={saving}
            data-testid="brand-source-form-submit"
            onClick={() => onSubmit(form)}
          >
            {saving ? "保存中…" : "保存"}
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
