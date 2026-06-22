import { trpc } from "@/lib/trpc";
import { AlertTriangle } from "lucide-react";

export function CompanyServiceBanner() {
  const usageQuery = trpc.geo.subscription.usage.useQuery();
  const companyService = usageQuery.data?.companyService;

  if (!companyService?.bannerMessage) {
    return null;
  }

  return (
    <div
      className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 md:px-6"
      data-testid="company-service-banner"
      role="status"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{companyService.bannerMessage}</p>
      </div>
    </div>
  );
}
