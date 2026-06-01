import type { ReactNode } from "react";
import AuthMarketingPanel from "./AuthMarketingPanel";

type AuthPageLayoutProps = {
  children: ReactNode;
  footer?: ReactNode;
};

export default function AuthPageLayout({ children, footer }: AuthPageLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <aside className="relative hidden w-[46%] max-w-xl border-r border-gray-200 bg-gradient-to-br from-blue-50 via-white to-gray-50 lg:block xl:max-w-2xl">
        <AuthMarketingPanel />
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-8 w-full max-w-md lg:hidden">
          <AuthMarketingPanel compact />
        </div>

        <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-lg sm:p-8">
          {children}
        </div>

        {footer ? <div className="mt-6 w-full max-w-md text-center">{footer}</div> : null}
      </main>
    </div>
  );
}
