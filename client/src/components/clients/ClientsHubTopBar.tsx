import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { geoP0Surfaces } from "@/lib/geoP0Visual";
import { LogOut } from "lucide-react";

/** /clients 专用：56px 白底顶栏，不展示企业项目信息 */
export function ClientsHubTopBar() {
  const { user, logout } = useAuth();
  return (
    <header
      className={`-mx-4 -mt-4 mb-6 flex items-center justify-between px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 ${geoP0Surfaces.topBar}`}
      data-testid="clients-hub-top-bar"
    >
      <p className="text-base font-bold text-slate-900">GEO 增长工作台</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 hover:bg-slate-50"
            data-testid="clients-hub-user-menu"
          >
            <Avatar className="h-8 w-8 border border-slate-200">
              <AvatarFallback className="bg-blue-50 text-xs font-medium text-blue-700">
                {user?.name?.charAt(0).toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[140px] truncate text-sm text-slate-700 sm:inline">{user?.name ?? "用户"}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
