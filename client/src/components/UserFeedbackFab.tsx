import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getActiveProjectId } from "@/lib/activeProject";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";
import { useState } from "react";

const FEEDBACK_TYPE_OPTIONS = [
  { value: "bug" as const, label: "Bug" },
  { value: "suggestion" as const, label: "建议" },
  { value: "other" as const, label: "其他" },
];

/** 登录用户可见：右下角「反馈」入口 */
export function UserFeedbackFab() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"bug" | "suggestion" | "other">("suggestion");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setDescription("");
    },
  });

  if (!user) return null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSubmitted(false);
      setDescription("");
      setType("suggestion");
      submitMutation.reset();
    }
  };

  const handleSubmit = () => {
    const trimmed = description.trim();
    if (!trimmed) return;
    const projectId = getActiveProjectId();
    submitMutation.mutate({
      type,
      description: trimmed,
      projectId: projectId ?? undefined,
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "fixed bottom-5 right-5 z-50 h-10 gap-1.5 rounded-full border-gray-200 bg-white px-4 shadow-md",
          "hover:bg-gray-50",
        )}
        data-testid="user-feedback-fab"
        onClick={() => setOpen(true)}
      >
        <MessageSquare className="size-4" aria-hidden />
        反馈
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md" data-testid="user-feedback-dialog">
          {submitted ? (
            <>
              <DialogHeader>
                <DialogTitle>感谢反馈</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-gray-600">我们已收到你的反馈，会尽快处理。</p>
              <DialogFooter>
                <Button type="button" onClick={() => handleOpenChange(false)}>
                  关闭
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>提交反馈</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="feedback-type">反馈类型</Label>
                  <Select value={type} onValueChange={v => setType(v as typeof type)}>
                    <SelectTrigger id="feedback-type" data-testid="user-feedback-type">
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {FEEDBACK_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="feedback-description">描述</Label>
                  <Textarea
                    id="feedback-description"
                    data-testid="user-feedback-description"
                    rows={5}
                    placeholder="请描述你遇到的问题或建议…"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>
                {submitMutation.error ? (
                  <p className="text-sm text-red-600">{submitMutation.error.message}</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  disabled={!description.trim() || submitMutation.isPending}
                  data-testid="user-feedback-submit"
                  onClick={handleSubmit}
                >
                  {submitMutation.isPending ? "提交中…" : "提交"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
