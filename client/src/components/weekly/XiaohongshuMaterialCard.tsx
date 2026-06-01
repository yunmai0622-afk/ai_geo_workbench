import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import {
  buildXiaohongshuPublishPackage,
  type XiaohongshuMaterialView,
  XIAOHONGSHU_NOTE_TITLE_MAX_LEN,
} from "@shared/xiaohongshuMaterial";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Props = {
  material: XiaohongshuMaterialView;
  disabled?: boolean;
  className?: string;
};

export function XiaohongshuMaterialCard({ material, disabled, className }: Props) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copyPublishPackage = async () => {
    const payload = buildXiaohongshuPublishPackage(material);
    if (!payload.trim()) {
      toast.error("发布包为空，无法复制");
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      if (timerRef.current) clearTimeout(timerRef.current);
      setCopied(true);
      toast.success("已复制发布包（标题+正文+话题标签）");
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败，请检查浏览器剪贴板权限");
    }
  };

  return (
    <div
      className={`rounded-xl border border-rose-100 bg-rose-50/60 p-4 ${className ?? ""}`}
      data-testid="xiaohongshu-material-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-rose-900">小红书人工发布素材</p>
          <p className="mt-0.5 text-xs text-rose-800/80">请复制后到小红书 App 人工发布，系统不会自动登录或代发。</p>
        </div>
        <Button
          type="button"
          size="sm"
          className={geoP0Brand.primary}
          disabled={disabled}
          data-testid="xiaohongshu-copy-publish-package"
          onClick={() => void copyPublishPackage()}
        >
          {copied ? "已复制发布包" : "一键复制发布包"}
        </Button>
      </div>

      <div className="mt-3 space-y-3 text-sm text-gray-800">
        <div data-testid="xiaohongshu-note-title">
          <p className="text-xs font-medium text-gray-500">
            笔记标题（{XIAOHONGSHU_NOTE_TITLE_MAX_LEN} 字以内）
          </p>
          <p className="mt-1 font-semibold text-gray-900">{material.noteTitle}</p>
        </div>

        <div data-testid="xiaohongshu-body">
          <p className="text-xs font-medium text-gray-500">正文内容</p>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-rose-100 bg-white/80 p-3 text-xs leading-relaxed">
            {material.body}
          </pre>
        </div>

        <div data-testid="xiaohongshu-image-suggestions">
          <p className="text-xs font-medium text-gray-500">建议配图说明</p>
          <ul className="mt-1 list-decimal space-y-1 pl-5 text-xs leading-relaxed">
            {material.imageSuggestions.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div data-testid="xiaohongshu-hashtags">
          <p className="text-xs font-medium text-gray-500">话题标签建议</p>
          <p className="mt-1 text-xs leading-relaxed text-rose-900">{material.hashtags.join(" ")}</p>
        </div>
      </div>
    </div>
  );
}
