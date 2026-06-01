import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getPageUsageHelpContent, type PageUsageHelpId } from "@shared/pageUsageHelp";
import { CircleHelp } from "lucide-react";

type Props = {
  helpId: PageUsageHelpId;
  className?: string;
  testId?: string;
};

export function PageUsageHelpButton({ helpId, className, testId = "page-usage-help" }: Props) {
  const content = getPageUsageHelpContent(helpId);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("size-9 shrink-0 rounded-full border-gray-200 text-gray-500 hover:text-gray-900", className)}
          data-testid={`${testId}-trigger`}
          aria-label={`查看${content.title}`}
        >
          <CircleHelp className="h-4 w-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[min(85vh,640px)] max-w-lg overflow-y-auto border-gray-200"
        data-testid={testId}
      >
        <DialogHeader>
          <DialogTitle className="text-left text-base">{content.title}</DialogTitle>
          {content.intro ? (
            <DialogDescription className="text-left text-sm leading-relaxed text-gray-600">
              {content.intro}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="space-y-5 pr-1">
          {content.sections.map(section => (
            <section key={section.heading} data-testid={`${testId}-section-${section.heading}`}>
              <h3 className="text-sm font-semibold text-gray-900">{section.heading}</h3>
              <ul className="mt-2 space-y-1.5">
                {section.lines.map(line => (
                  <li key={line} className="text-sm leading-relaxed text-gray-700">
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
