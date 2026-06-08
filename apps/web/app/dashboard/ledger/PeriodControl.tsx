"use client";

import { Lock, LockOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { modal } from "@/components/ui/modal-host";

import { closePeriodAction, reopenPeriodAction } from "./actions";

// The last 6 months as { key: "YYYY-MM", label: "Jun 2026" }, newest first.
function recentMonths(): { key: string; label: string }[] {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      key,
      label: d.toLocaleDateString("en-ZA", {
        month: "short",
        year: "numeric",
      }),
    });
  }
  return out;
}

export function PeriodControl({ closedMonths }: { closedMonths: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const months = recentMonths();
  const closed = new Set(closedMonths);

  useEffect(() => {
    const close = () => setOpen(false);
    if (open) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  function toggle(month: string, isClosed: string | boolean) {
    start(async () => {
      if (isClosed) {
        const ok = await modal.confirm({
          title: "Reopen this month?",
          description:
            "Reopening lets you edit or void transactions in this period again. The reopen is recorded in the audit trail.",
          confirmLabel: "Reopen month",
        });
        if (!ok) return;
        const r = await reopenPeriodAction({ month });
        if (r.ok) {
          toast.success("Month reopened.");
          router.refresh();
        } else toast.error(r.error);
      } else {
        const ok = await modal.confirm({
          title: "Close this month?",
          description:
            "Once closed, no transactions dated in this month can be created or voided — you'd post a reversing entry in the open period instead. You can reopen it later.",
          confirmLabel: "Close month",
        });
        if (!ok) return;
        const r = await closePeriodAction({ month });
        if (r.ok) {
          toast.success("Month closed.");
          router.refresh();
        } else toast.error(r.error);
      }
    });
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-medium text-brand-ink transition hover:bg-brand-light"
        title="Close or reopen accounting months"
      >
        <Lock className="h-3.5 w-3.5 text-brand-mute" /> Periods
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-64 overflow-hidden rounded-[12px] border border-brand-line bg-white shadow-lift">
          <div className="border-b border-brand-line px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-brand-mute">
            Accounting periods
          </div>
          {months.map((m) => {
            const isClosed = closed.has(m.key);
            return (
              <div
                key={m.key}
                className="flex items-center justify-between px-3 py-2 text-[12.5px]"
              >
                <span className="flex items-center gap-1.5 text-brand-ink">
                  {isClosed ? (
                    <Lock className="h-3 w-3 text-red-500" />
                  ) : (
                    <LockOpen className="h-3 w-3 text-emerald-600" />
                  )}
                  {m.label}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(m.key, isClosed)}
                  disabled={pending}
                  className={`rounded-pill px-2 py-0.5 text-[11px] font-semibold transition disabled:opacity-50 ${
                    isClosed
                      ? "text-brand-secondary hover:underline"
                      : "text-red-600 hover:underline"
                  }`}
                >
                  {isClosed ? "Reopen" : "Close"}
                </button>
              </div>
            );
          })}
          <p className="border-t border-brand-line px-3 py-2 text-[10.5px] text-brand-mute">
            Closing locks a month against edits & voids — accountant-safe.
          </p>
        </div>
      ) : null}
    </div>
  );
}
