import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatNotificationTime, NOTIFICATION_POLL_INTERVAL_MS, SYSTEM_NOTIFICATION_TYPE_LABELS, type SystemNotificationType } from "@shared/systemNotificationDisplay";
import { Bell } from "lucide-react";
import { useState } from "react";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const listQuery = trpc.notifications.list.useQuery({ limit: 30 }, { refetchInterval: NOTIFICATION_POLL_INTERVAL_MS, refetchIntervalInBackground: true });
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => void utils.notifications.list.invalidate() });
  const markAllRead = trpc.notifications.markAllRead.useMutation({ onSuccess: () => void utils.notifications.list.invalidate() });
  const unreadCount = listQuery.data?.unreadCount ?? 0;
  const items = listQuery.data?.items ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50" aria-label="系统通知" data-testid="notification-bell-trigger">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white" data-testid="notification-unread-badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-2rem,380px)] rounded-xl border-gray-200 p-0 shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div><p className="text-sm font-semibold text-gray-900">系统通知</p><p className="text-xs text-gray-500">{unreadCount > 0 ? `${unreadCount} 条未读` : "暂无未读"}</p></div>
          {unreadCount > 0 ? <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" disabled={markAllRead.isPending} data-testid="notification-mark-all-read" onClick={() => markAllRead.mutate()}>全部已读</Button> : null}
        </div>
        <ScrollArea className="max-h-[min(60vh,420px)]">
          <ul className="space-y-2 p-3" data-testid="notification-list">
            {listQuery.isLoading ? <li className="px-2 py-6 text-center text-sm text-gray-500">加载中…</li> : items.length === 0 ? <li className="px-2 py-6 text-center text-sm text-gray-500">暂无通知</li> : items.map((item: (typeof items)[number]) => {
              const type = item.type as SystemNotificationType;
              const unread = item.readAt == null;
              return (
                <li key={item.id} className={cn("rounded-lg border px-3 py-2.5", unread ? "border-blue-100 bg-blue-50/60" : "border-gray-100 bg-white")} data-testid={`notification-item-${item.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-blue-700" data-testid="notification-type">{SYSTEM_NOTIFICATION_TYPE_LABELS[type]}</p>
                      <p className="mt-0.5 text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-gray-600">{item.content}</p>
                      <p className="mt-1.5 text-[11px] text-gray-400">{formatNotificationTime(item.createdAt)}</p>
                    </div>
                    {unread ? <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs text-blue-700" disabled={markRead.isPending} data-testid={`notification-mark-read-${item.id}`} onClick={() => markRead.mutate({ id: item.id })}>标为已读</Button> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
