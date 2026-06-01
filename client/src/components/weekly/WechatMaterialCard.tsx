import { Button } from "@/components/ui/button";
import { geoP0Brand } from "@/lib/geoP0Visual";
import {
  copyWechatFormattedBody,
  type WechatMaterialView,
  WECHAT_SUMMARY_MAX_LEN,
} from "@shared/wechatMaterial";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Props = {
  material: WechatMaterialView;
  disabled?: boolean;
  className?: string;
};

export function WechatMaterialCard({ material, disabled, className }: Props) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const summaryLen = Array.from(material.summary).length;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copyBody = async () => {
    if (!material.bodyPlain.trim()) {
      toast.error("正文为空，无法复制");
      return;
    }
    try {
      await copyWechatFormattedBody(material);
      if (timerRef.current) clearTimeout(timerRef.current);
      setCopied(true);
      toast.success("已复制正文（含基本排版格式，可直接粘贴到公众号编辑器）");
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败，请检查浏览器剪贴板权限");
    }
  };

  return (
    <div
      className={`rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 ${className ?? ""}`}
      data-testid="wechat-material-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-emerald-900">微信公众号人工发布素材</p>
          <p className="mt-0.5 text-xs text-emerald-800/80">
            请复制后到公众号后台新建图文并粘贴，系统不会自动登录或代发。
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className={geoP0Brand.primary}
          disabled={disabled}
          data-testid="wechat-copy-body"
          onClick={() => void copyBody()}
        >
          {copied ? "已复制正文" : "一键复制正文"}
        </Button>
      </div>

      <div className="mt-3 space-y-3 text-sm text-gray-800">
        <div data-testid="wechat-article-title">
          <p className="text-xs font-medium text-gray-500">文章标题</p>
          <p className="mt-1 font-semibold text-gray-900">{material.articleTitle}</p>
        </div>

        <div data-testid="wechat-summary">
          <p className="text-xs font-medium text-gray-500">
            摘要（{WECHAT_SUMMARY_MAX_LEN} 字以内，当前 {summaryLen} 字）
          </p>
          <p className="mt-1 leading-relaxed text-gray-800">{material.summary}</p>
        </div>

        <div data-testid="wechat-body">
          <p className="text-xs font-medium text-gray-500">正文（公众号排版预览）</p>
          <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-emerald-100 bg-white/80 p-3 text-xs leading-relaxed">
            {material.bodyDisplay}
          </pre>
        </div>

        <div data-testid="wechat-cover-hint">
          <p className="text-xs font-medium text-gray-500">封面图建议尺寸</p>
          <p className="mt-1 text-xs leading-relaxed text-emerald-900">{material.coverSizeHint}</p>
        </div>
      </div>
    </div>
  );
}
