import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  values: string[];
  draft: string;
  onDraftChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (v: string) => void;
  placeholder?: string;
  maxItems?: number;
  testId?: string;
};

export function MultiValueInput({
  values,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
  placeholder = "输入后回车或点击添加",
  maxItems = 20,
  testId,
}: Props) {
  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex flex-wrap gap-2">
        {values.map(v => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
          >
            {v}
            <button type="button" className="text-gray-400 hover:text-red-500" onClick={() => onRemove(v)} aria-label="移除">
              ×
            </button>
          </span>
        ))}
      </div>
      {values.length < maxItems ? (
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-md"
            value={draft}
            onChange={e => onDraftChange(e.target.value)}
            placeholder={placeholder}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
          />
          <Button type="button" size="sm" variant="outline" onClick={onAdd}>
            添加
          </Button>
        </div>
      ) : null}
    </div>
  );
}
