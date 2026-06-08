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
  formatTargetKeywordsInput,
  parseTargetKeywordsInput,
  REQUIRED_ENTITY_ANCHORS,
  REQUIRED_SOURCE_TYPES,
  SEARCH_POOL_PRIORITY_LEVELS,
  SEARCH_POOL_QUESTION_TYPES,
  type SearchPoolQuestionRow,
  type SearchPoolQuestionType,
} from "@shared/questionSearchPool";
import { useEffect, useState } from "react";

export type QuestionPoolFormState = {
  questionText: string;
  searchPoolType: SearchPoolQuestionType | "";
  targetKeywordsText: string;
  targetCustomerScene: string;
  relatedGeoGap: string;
  priorityLevel: "" | "high" | "medium" | "low";
  requiredSourceTypes: string[];
  requiredEntityAnchors: string[];
};

export function defaultQuestionPoolForm(): QuestionPoolFormState {
  return {
    questionText: "",
    searchPoolType: "",
    targetKeywordsText: "",
    targetCustomerScene: "",
    relatedGeoGap: "",
    priorityLevel: "",
    requiredSourceTypes: [],
    requiredEntityAnchors: [],
  };
}

export function questionToPoolForm(question: SearchPoolQuestionRow): QuestionPoolFormState {
  return {
    questionText: question.questionText,
    searchPoolType: (question.searchPoolType as SearchPoolQuestionType) ?? "",
    targetKeywordsText: formatTargetKeywordsInput(question.targetKeywords),
    targetCustomerScene: question.targetCustomerScene ?? "",
    relatedGeoGap: question.relatedGeoGap ?? "",
    priorityLevel: (question.priorityLevel as QuestionPoolFormState["priorityLevel"]) ?? "",
    requiredSourceTypes: question.requiredSourceTypes ?? [],
    requiredEntityAnchors: question.requiredEntityAnchors ?? [],
  };
}

type Props = {
  open: boolean;
  mode: "create" | "edit";
  saving: boolean;
  initial: QuestionPoolFormState;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: QuestionPoolFormState) => void;
};

export function QuestionSearchPoolDrawer({
  open,
  mode,
  saving,
  initial,
  onOpenChange,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<QuestionPoolFormState>(initial);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  function toggleListValue(key: "requiredSourceTypes" | "requiredEntityAnchors", value: string) {
    setForm(current => {
      const list = current[key];
      const next = list.includes(value) ? list.filter(item => item !== value) : [...list, value];
      return { ...current, [key]: next };
    });
  }

  function handleSubmit() {
    onSubmit(form);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader>
          <DrawerTitle>{mode === "create" ? "新增问题" : "编辑问题"}</DrawerTitle>
          <DrawerDescription>配置 AI 搜索问题池字段，用于诊断缺口与内容任务关联。</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-2">
          <div className="space-y-2">
            <Label htmlFor="pool-question-text">问题内容</Label>
            <Textarea
              id="pool-question-text"
              data-testid="question-pool-form-text"
              value={form.questionText}
              onChange={e => setForm(s => ({ ...s, questionText: e.target.value }))}
              placeholder="例如：XX 行业有哪些值得推荐的品牌？"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>问题类型</Label>
            <Select
              value={form.searchPoolType}
              onValueChange={v => setForm(s => ({ ...s, searchPoolType: v as SearchPoolQuestionType }))}
            >
              <SelectTrigger data-testid="question-pool-form-type">
                <SelectValue placeholder="选择问题类型" />
              </SelectTrigger>
              <SelectContent>
                {SEARCH_POOL_QUESTION_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pool-target-keywords">目标关键词</Label>
            <Input
              id="pool-target-keywords"
              data-testid="question-pool-form-keywords"
              value={form.targetKeywordsText}
              onChange={e => setForm(s => ({ ...s, targetKeywordsText: e.target.value }))}
              placeholder="多个关键词用逗号或顿号分隔"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pool-target-scene">目标客户场景</Label>
            <Textarea
              id="pool-target-scene"
              value={form.targetCustomerScene}
              onChange={e => setForm(s => ({ ...s, targetCustomerScene: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pool-related-gap">关联诊断缺口</Label>
            <Textarea
              id="pool-related-gap"
              value={form.relatedGeoGap}
              onChange={e => setForm(s => ({ ...s, relatedGeoGap: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>优先级</Label>
            <Select
              value={form.priorityLevel || "none"}
              onValueChange={v =>
                setForm(s => ({
                  ...s,
                  priorityLevel: v === "none" ? "" : (v as QuestionPoolFormState["priorityLevel"]),
                }))
              }
            >
              <SelectTrigger data-testid="question-pool-form-priority">
                <SelectValue placeholder="选择优先级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未设置</SelectItem>
                {SEARCH_POOL_PRIORITY_LEVELS.map(level => (
                  <SelectItem key={level} value={level}>
                    {level === "high" ? "高" : level === "medium" ? "中" : "低"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>需要支撑的信源类型</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {REQUIRED_SOURCE_TYPES.map(item => (
                <label key={item.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.requiredSourceTypes.includes(item.value)}
                    onCheckedChange={() => toggleListValue("requiredSourceTypes", item.value)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>需要强化的实体锚点</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {REQUIRED_ENTITY_ANCHORS.map(item => (
                <label key={item.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.requiredEntityAnchors.includes(item.value)}
                    onCheckedChange={() => toggleListValue("requiredEntityAnchors", item.value)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DrawerFooter>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={saving}
            data-testid="question-pool-form-submit"
            onClick={handleSubmit}
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

export function buildQuestionPoolMutationPayload(
  form: QuestionPoolFormState,
  projectId: number,
  enabled: boolean,
) {
  return {
    projectId,
    questionText: form.questionText.trim(),
    searchPoolType: form.searchPoolType as SearchPoolQuestionType,
    targetKeywords: parseTargetKeywordsInput(form.targetKeywordsText),
    targetCustomerScene: form.targetCustomerScene.trim() || null,
    relatedGeoGap: form.relatedGeoGap.trim() || null,
    priorityLevel: form.priorityLevel || null,
    requiredSourceTypes: form.requiredSourceTypes as Array<(typeof REQUIRED_SOURCE_TYPES)[number]["value"]>,
    requiredEntityAnchors: form.requiredEntityAnchors as Array<(typeof REQUIRED_ENTITY_ANCHORS)[number]["value"]>,
    source: "manual" as const,
    enabled,
  };
}
