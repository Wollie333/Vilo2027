import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";

import { sanitizeHelpHtml } from "@/lib/help/sanitize";
import type { HelpFaqRow } from "@/lib/help/types";

type Props = {
  faqs: HelpFaqRow[];
  basePath: string;
};

export function FAQAccordion({ faqs, basePath }: Props) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Quick answers
          </div>
          <h3 className="mt-1 font-display text-xl font-bold text-brand-ink">
            Frequently asked
          </h3>
        </div>
        <Link
          href={`${basePath}/faqs`}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:text-brand-secondary"
        >
          All FAQs <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {faqs.length === 0 ? (
        <p className="mt-4 rounded border border-dashed border-brand-line px-4 py-6 text-center text-sm text-brand-mute">
          No FAQs published yet.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-brand-line border-t border-brand-line">
          {faqs.map((f, idx) => (
            <details key={f.id} className="group py-4" open={idx === 0}>
              <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-4 w-4 shrink-0 text-brand-mute transition-transform group-open:rotate-90" />
                <span className="text-sm font-medium text-brand-ink">
                  {f.question}
                </span>
              </summary>
              <div
                className="prose prose-sm mt-3 max-w-none pl-7 text-sm leading-relaxed text-brand-mute [&_em]:text-brand-ink [&_strong]:text-brand-ink"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHelpHtml(f.answer_html),
                }}
              />
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
