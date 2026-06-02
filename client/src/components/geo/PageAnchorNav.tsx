import { cn } from "@/lib/utils";

export type PageAnchorNavItem = {
  id: string;
  label: string;
};

export function PageAnchorNav({
  items,
  className,
  testId = "page-anchor-nav",
}: {
  items: PageAnchorNavItem[];
  className?: string;
  testId?: string;
}) {
  if (items.length === 0) return null;
  return (
    <nav
      className={cn("flex flex-wrap gap-2 print:hidden", className)}
      data-testid={testId}
      aria-label="页面章节导航"
    >
      {items.map(item => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
