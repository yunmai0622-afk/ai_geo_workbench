import { AiPageHero } from "@/components/ai/ProductUi";
import type { ReactNode } from "react";

export type AiPageHeaderProps = {
  title: string;
  description: string;
  badge?: string;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** @deprecated 使用 AiPageHero；保留别名兼容旧引用 */
export function AiPageHeader({ title, description, badge, meta, children, className }: AiPageHeaderProps) {
  return (
    <AiPageHero title={title} description={description} badge={badge} meta={meta} className={className}>
      {children}
    </AiPageHero>
  );
}
