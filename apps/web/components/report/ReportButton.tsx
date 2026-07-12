"use client";

import { CheckCircle2, Flag, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { reportAction } from "@/lib/report/report-action";
import {
  REPORT_REASONS,
  REPORT_TARGET_META,
  type ReportTargetType,
} from "@/lib/report/report-constants";

const inputCls =
  "mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10";

/**
 * ONE report modal for listings, deals and users — scoped by `targetType` so the
 * report is categorised by where it was clicked. Same fields everywhere; wording
 * adapts. The trigger can be restyled per placement via `triggerClassName` /
 * `triggerLabel`.
 */
export function ReportButton({
  targetType,
  targetId,
  targetLabel,
  triggerLabel,
  triggerClassName,
  prefillName = "",
  prefillEmail = "",
}: {
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  triggerLabel?: string;
  triggerClassName?: string;
  prefillName?: string;
  prefillEmail?: string;
}) {
  const meta = REPORT_TARGET_META[targetType];
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const [name, setName] = useState(prefillName);
  const [email, setEmail] = useState(prefillEmail);
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState<string>("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState("");

  function reset() {
    setDone(false);
    setName(prefillName);
    setEmail(prefillEmail);
    setPhone("");
    setReason("");
    setMessage("");
    setHp("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!reason) {
      toast.error("Pick a reason for reporting.");
      return;
    }
    setPending(true);
    try {
      const res = await reportAction({
        targetType,
        targetId,
        reporterName: name.trim(),
        reporterEmail: email.trim(),
        reporterPhone: phone.trim(),
        reason,
        message: message.trim(),
        hp,
      });
      if (res.ok) {
        setPending(false);
        setDone(true);
        return;
      }
      toast.error(res.error);
      setPending(false);
    } catch {
      toast.error("Couldn't reach the server. Try again.");
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className={
          triggerClassName ??
          "inline-flex items-center gap-1.5 text-xs text-brand-mute underline underline-offset-2 hover:text-brand-ink"
        }
      >
        <Flag className="h-3.5 w-3.5" /> {triggerLabel ?? meta.triggerLabel}
      </button>

      <FormModal
        open={open}
        onOpenChange={(v) => {
          if (!pending) setOpen(v);
        }}
        size="md"
        title={done ? "Report received" : meta.triggerLabel}
        description={
          done
            ? undefined
            : `Tell us what's wrong with ${targetLabel}. Our team reviews every report.`
        }
      >
        {done ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-status-confirmed/10 text-status-confirmed">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="mt-3 font-display text-lg font-bold text-brand-ink">
              Thanks for letting us know
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-brand-mute">
              Our team will review this {meta.noun}. We may email you at{" "}
              <span className="font-medium text-brand-ink">{email}</span> if we
              need more detail.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 inline-flex items-center justify-center rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
            >
              Done
            </button>
          </div>
        ) : (
          <form id="report-form" onSubmit={onSubmit} className="space-y-4">
            {/* Honeypot — off-screen; bots fill it. */}
            <input
              type="text"
              name="wielo_hp"
              tabIndex={-1}
              autoComplete="off"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
              aria-hidden="true"
            />

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-brand-mute">
                Reason
              </span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={inputCls}
                required
              >
                <option value="" disabled>
                  Choose a reason…
                </option>
                {REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-brand-mute">
                What&rsquo;s the problem?
              </span>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                placeholder="Tell us what you noticed so our team can look into it."
                className={inputCls}
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-brand-mute">
                  Your name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  required
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-brand-mute">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  required
                />
              </label>
            </div>
            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-brand-mute">
                Phone (optional)
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
              />
            </label>

            <FormModalFooter>
              <FormModalCancel>Cancel</FormModalCancel>
              <button
                type="submit"
                form="report-form"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Flag className="h-4 w-4" />
                )}
                {pending ? "Sending…" : "Submit report"}
              </button>
            </FormModalFooter>
          </form>
        )}
      </FormModal>
    </>
  );
}
