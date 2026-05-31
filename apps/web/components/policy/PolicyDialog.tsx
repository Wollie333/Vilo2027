"use client";

import { cloneElement, isValidElement, useState } from "react";

import { FormModal } from "@/components/ui/form-modal";

export type PolicyDialogData = {
  type:
    | "cancellation"
    | "check_in_out"
    | "house_rules"
    | "booking_terms"
    | "privacy";
  name: string;
  summary?: string | null;
  isNonRefundable?: boolean;
  rules?: { days_before: number; refund_percent: number; label: string }[];
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkInMethod?: "self" | "host" | "reception" | null;
  petsAllowed?: boolean | null;
  smokingAllowed?: boolean | null;
  partiesAllowed?: boolean | null;
  childrenWelcome?: boolean | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  bodyHtml?: string | null;
};

const CHECK_IN_METHOD_LABEL: Record<
  NonNullable<PolicyDialogData["checkInMethod"]>,
  string
> = {
  self: "Self check-in (lockbox / smart lock)",
  host: "Host greets you on arrival",
  reception: "Reception check-in",
};

/** A yes/no house rule → a labelled chip. NULL/undefined = unspecified (hidden). */
function ruleChips(data: PolicyDialogData) {
  const out: { label: string; ok: boolean }[] = [];
  if (data.petsAllowed != null)
    out.push({
      label: data.petsAllowed ? "Pets allowed" : "No pets",
      ok: data.petsAllowed,
    });
  if (data.smokingAllowed != null)
    out.push({
      label: data.smokingAllowed ? "Smoking allowed" : "No smoking",
      ok: data.smokingAllowed,
    });
  if (data.partiesAllowed != null)
    out.push({
      label: data.partiesAllowed ? "Parties allowed" : "No parties or events",
      ok: data.partiesAllowed,
    });
  if (data.childrenWelcome != null)
    out.push({
      label: data.childrenWelcome
        ? "Children welcome"
        : "Not suitable for children",
      ok: data.childrenWelcome,
    });
  return out;
}

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

  const triggerNode =
    trigger && isValidElement(trigger) ? (
      cloneElement(trigger as React.ReactElement, {
        onClick: () => setOpen(true),
      })
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-brand-primary underline underline-offset-4 hover:text-brand-secondary"
      >
        Read full policy
      </button>
    );

  return (
    <>
      {triggerNode}
      <FormModal
        open={open}
        onOpenChange={setOpen}
        title={data.name}
        description={data.summary ?? undefined}
      >
        <div className="space-y-4">
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
                      <th className="pb-1.5 text-right font-semibold">
                        Refund
                      </th>
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
            <div className="space-y-3">
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
              {data.checkInMethod ? (
                <div className="inline-flex items-center gap-1.5 rounded-pill bg-brand-accent px-3 py-1 text-xs font-medium text-brand-secondary">
                  {CHECK_IN_METHOD_LABEL[data.checkInMethod]}
                </div>
              ) : null}
            </div>
          ) : null}

          {data.type === "house_rules" &&
          (ruleChips(data).length > 0 ||
            (data.quietHoursStart && data.quietHoursEnd)) ? (
            <div className="flex flex-wrap gap-2">
              {ruleChips(data).map((c) => (
                <span
                  key={c.label}
                  className={`inline-flex items-center rounded-pill border px-2.5 py-1 text-xs font-medium ${
                    c.ok
                      ? "border-brand-line bg-brand-accent text-brand-secondary"
                      : "border-brand-line bg-brand-light text-brand-mute"
                  }`}
                >
                  {c.label}
                </span>
              ))}
              {data.quietHoursStart && data.quietHoursEnd ? (
                <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2.5 py-1 text-xs font-medium text-brand-mute">
                  Quiet hours {time(data.quietHoursStart)}–
                  {time(data.quietHoursEnd)}
                </span>
              ) : null}
            </div>
          ) : null}

          {data.bodyHtml ? (
            <div
              className={PROSE}
              // Sanitised at write time via sanitiseListingHtml.
              dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
            />
          ) : null}
        </div>
      </FormModal>
    </>
  );
}
