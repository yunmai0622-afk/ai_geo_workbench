import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { geoP0Surfaces } from "@/lib/geoP0Visual";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { Link } from "wouter";

export function ClientsHubTopBar() {
  const { user, logout } = useAuth();
  return (
    <header className={`-mx-4 -mt-4 mb-8 flex items-center justify-between px-6 md:-mx-6 lg:-mx-8 lg:px-8 ${geoP0Surfaces.topBar}`} data-testid="clients-hub-top-bar">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-sm shadow-blue-600/20"><span className="text-sm font-bold text-white">G</span></div>
        <div><p className="text-[15px] font-bold tracking-tight text-gray-900">GEO 增长工作台</p><p className="text-[11px] text-gray-400">AI 搜索增长系统</p></div>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/settings" className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-blue-600" data-testid="clients-hub-settings-link">设置</Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5" data-testid="clients-hub-user-menu">
              <Avatar className="h-7 w-7 border border-gray-100"><AvatarFallback className="bg-gradient-to-br from-blue-50 to-blue-100 text-xs font-semibold text-blue-700">{user?.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback></Avatar>
              <span className="hidden max-w-[120px] truncate text-sm font-medium text-gray-700 sm:inline">{user?.name ?? "用户"}</span>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl border-gray-200 shadow-lg">
            <DropdownMenuItem asChild className="cursor-pointer rounded-lg"><Link href="/settings" className="flex w-full items-center"><Settings className="mr-2 h-4 w-4" />设置</Link></DropdownMenuItem>
            <DropdownMenuItem onClick={logout} className="cursor-pointer rounded-lg text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />退出登录</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
