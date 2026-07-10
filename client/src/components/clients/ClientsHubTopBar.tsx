import { useAuth } from "@/_core/hooks/useAuth";
import {
  PLATFORM_PRODUCT_NAME,
  PLATFORM_PRODUCT_SUBTITLE,
} from "@/components/auth/authMarketing";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { geoP0Surfaces } from "@/lib/geoP0Visual";
import { canAccessOperatorAdminConsole } from "@shared/platformAdmin";
import { ChevronDown, Building2, LogOut, Settings } from "lucide-react";
import { Link } from "wouter";
import { WhiteLabelBrandMark } from "@/components/WhiteLabelBrandMark";

export function ClientsHubTopBar() {
  const { user, logout } = useAuth();
  return (
    <header className={`-mx-4 -mt-4 mb-8 flex items-center justify-between px-6 md:-mx-6 lg:-mx-8 lg:px-8 ${geoP0Surfaces.topBar}`} data-testid="clients-hub-top-bar">
      <div className="flex items-center gap-2.5">
        <WhiteLabelBrandMark className="h-8 w-8 rounded-lg shadow-sm" />
        <div><p className="text-[15px] font-bold tracking-tight text-gray-900">{PLATFORM_PRODUCT_NAME}</p><p className="text-[11px] text-gray-400">{PLATFORM_PRODUCT_SUBTITLE}</p></div>
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
            {canAccessOperatorAdminConsole(user?.role) ? (
              <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                <Link href="/admin/customers" className="flex w-full items-center">
                  <Building2 className="mr-2 h-4 w-4" />
                  {user?.role === "admin" ? "平台运营后台" : "代运营管理台"}
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={logout} className="cursor-pointer rounded-lg text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />退出登录</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
