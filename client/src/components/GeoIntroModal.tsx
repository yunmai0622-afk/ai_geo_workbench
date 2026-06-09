import { useAuth } from "@/_core/hooks/useAuth";
import { PLATFORM_PRODUCT_NAME } from "@/components/auth/authMarketing";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dismissGeoIntroModal, isGeoIntroModalDismissed } from "@/lib/geoIntroModal";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const INTRO_STEPS = [
  "填写企业资料",
  "执行AI基线检测",
  "生成并发布内容",
  "追踪AI提及率变化",
] as const;

/** 用户在本浏览器首次登录后展示一次的系统介绍弹窗 */
export function GeoIntroModal() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (!isGeoIntroModalDismissed()) {
      setOpen(true);
    }
  }, [loading, user]);

  if (!user) return null;

  const handleStart = () => {
    dismissGeoIntroModal();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        showCloseButton={false}
        className="rounded-2xl border-gray-200 bg-white text-gray-900 shadow-xl sm:max-w-md"
        data-testid="geo-intro-modal"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader className="space-y-3 text-left">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <DialogTitle className="text-xl font-bold text-gray-900">欢迎使用{PLATFORM_PRODUCT_NAME}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed text-gray-600">
          <p>
            GEO（生成式引擎优化）帮助你的企业在豆包、Kimi、DeepSeek等AI搜索中被识别、提及和推荐。
          </p>
          <div>
            <p className="font-medium text-gray-800">开始你的第一步：</p>
            <ul className="mt-2 space-y-1.5">
              {INTRO_STEPS.map(step => (
                <li key={step} className="flex gap-2 text-gray-600">
                  <span className="shrink-0 text-blue-600" aria-hidden>
                    →
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            className={cn("w-full rounded-xl sm:w-auto", geoP0Brand.primary)}
            data-testid="geo-intro-modal-start"
            onClick={handleStart}
          >
            开始使用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
