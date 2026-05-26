import { Button } from "@/components/ui/button";
import { aiChipActive, aiChipIdle, aiOutlineBtn } from "@/lib/aiProductUi";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { SIDEBAR_GROUPS, type SidebarGroupKey } from "./constants";

type Props = {
  selectedGroup: SidebarGroupKey;
  groupCounts: Map<SidebarGroupKey, number>;
  onSelect: (key: SidebarGroupKey) => void;
  onAddGroup: () => void;
};

export function AccountGroupSidebar({ selectedGroup, groupCounts, onSelect, onAddGroup }: Props) {
  return (
    <aside
      className="w-full shrink-0 space-y-2 lg:w-[220px]"
      data-testid="platform-account-group-sidebar"
    >
      <p className="text-xs font-medium text-gray-500">账号组</p>
      <nav className="flex flex-row flex-wrap gap-2 lg:flex-col lg:gap-1">
        {SIDEBAR_GROUPS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            data-testid={`account-group-${key}`}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
              selectedGroup === key ? aiChipActive : aiChipIdle,
            )}
            onClick={() => onSelect(key)}
          >
            <span>{label}</span>
            <span className="text-xs opacity-80">{groupCounts.get(key) ?? 0}</span>
          </button>
        ))}
      </nav>
      <Button type="button" size="sm" variant="outline" className={cn(aiOutlineBtn, "w-full")} onClick={onAddGroup}>
        <Plus className="mr-1 size-3.5" />
        新建分组
      </Button>
    </aside>
  );
}
