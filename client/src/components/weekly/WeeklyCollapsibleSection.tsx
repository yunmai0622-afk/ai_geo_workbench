import type { ReactNode } from "react";

type Props = {
  testId: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function WeeklyCollapsibleSection({ testId, title, defaultOpen = false, children }: Props) {
  return (
    <details
      className="rounded-xl border border-gray-200 bg-white shadow-sm"
      data-testid={testId}
      open={defaultOpen ? undefined : false}
    >
      <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-gray-800 [&::-webkit-details-marker]:hidden">
        {title}
      </summary>
      <div className="space-y-4 border-t border-gray-100 p-4">{children}</div>
    </details>
  );
}
