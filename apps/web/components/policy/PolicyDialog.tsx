"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type PolicyDialogData = {
  type: "cancellation" | "check_in_out" | "house_rules";
  name: string;
  summary?: string | null;
  isNonRefundable?: boolean;
  rules?: { days_before: number; refund_percent: number; label: string }[];
  checkInTime?: string | null;
  checkOutTime?: string | null;
  bodyHtml?: string | null;
};

// Replicates just enough typography for the sanitised policy body to read well
// (Tailwind prose plugin isn't installed) — mirrors RichTextEditor's classes.
const PROSE =
  "text-sm leading-relaxed text-brand-ink [&_h2]:mt-3 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:font-display [&_h3]:text-sm [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-primary [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-brand-mute [&_strong]:font-semibold [&_p]:my-2";

function time(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "—";
}

export function PolicyDialog({
  data,
  trigger,
}: {
  data: PolicyDialogData;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="text-sm font-medium text-brand-primary underline underline-offset-4 hover:text-brand-secondary"
          >
            Read full policy
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-brand-ink">
            {data.name}
          </DialogTitle>
          {data.summary ? (
            <DialogDescription className="text-brand-mute">
              {data.summary}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {data.type === "cancellation" ? (
          <div className="space-y-3">
            {data.isNonRefundable ? (
              <p className="rounded border border-brand-line bg-brand-light/50 px-3 py-2 text-sm font-medium text-brand-ink">
                This booking is non-refundable.
              </p>
            ) : data.rules && data.rules.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-brand-mute">
                    <th className="pb-1.5 font-semibold">If cancelled</th>
                    <th className="pb-1.5 text-right font-semibold">Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rules.map((r, i) => (
                    <tr key={i} className="border-t border-brand-line">
                      <td className="py-1.5 text-brand-ink">
                        {r.days_before > 0
                          ? `${r.days_before}+ day${r.days_before === 1 ? "" : "s"} before check-in`
                          : "On or after check-in"}
                      </td>
                      <td className="py-1.5 text-right font-medium text-brand-ink">
                        {r.refund_percent}% · {r.label}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        ) : null}

        {data.type === "check_in_out" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-card border border-brand-line p-3">
              <div className="text-[11px] uppercase tracking-wider text-brand-mute">
                Check-in
              </div>
              <div className="num mt-1 font-display text-lg font-bold text-brand-ink">
                {time(data.checkInTime)}
              </div>
            </div>
            <div className="rounded-card border border-brand-line p-3">
              <div className="text-[11px] uppercase tracking-wider text-brand-mute">
                Check-out
              </div>
              <div className="num mt-1 font-display text-lg font-bold text-brand-ink">
                {time(data.checkOutTime)}
              </div>
            </div>
          </div>
        ) : null}

        {data.bodyHtml ? (
          <div
            className={PROSE}
            // Sanitised at write time via sanitiseListingHtml.
            dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
