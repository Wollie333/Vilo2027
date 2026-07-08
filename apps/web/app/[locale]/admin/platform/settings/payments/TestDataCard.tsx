"use client";

import { FlaskConical, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";

import { clearTestData } from "./actions";

export function TestDataCard({
  counts,
}: {
  counts: { ledger: number; invoices: number; orders: number };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const total = counts.ledger + counts.invoices + counts.orders;

  function clear() {
    if (pending) return;
    start(async () => {
      const res = await clearTestData();
      setConfirming(false);
      if (res.ok) {
        const d = res.deleted;
        toast.success(
          `Cleared test data — ${d.orders} orders, ${d.ledger} ledger, ${d.invoices} invoices.`,
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-status-pending" />
        <h2 className="font-display text-base font-bold text-brand-ink">
          Test data
        </h2>
      </div>
      <p className="mt-1 max-w-2xl text-[13px] text-brand-mute">
        While Paystack is in <span className="font-medium">test mode</span>,
        purchases are tagged <span className="font-medium">test</span> and kept
        out of live revenue — but they still show in{" "}
        <Link
          href="/admin/payments?env=test"
          className="text-brand-primary hover:underline"
        >
          Payments → Test
        </Link>{" "}
        so you can confirm the flow works. Clear them any time (e.g. at launch);
        live records are never touched.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Pill label="Orders" n={counts.orders} />
        <Pill label="Ledger" n={counts.ledger} />
        <Pill label="Invoices" n={counts.invoices} />
      </div>

      <div className="mt-5">
        {total === 0 ? (
          <span className="text-[13px] font-medium text-status-confirmed">
            No test transactions — you&apos;re clean.
          </span>
        ) : !confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex h-[42px] items-center gap-1.5 rounded-[10px] border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> Clear test data ({total})
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-brand-ink">
              Permanently delete {total} test record{total === 1 ? "" : "s"}?
            </span>
            <button
              type="button"
              onClick={clear}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-red-600 px-3.5 text-[13px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Yes, clear
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-[10px] border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-ink hover:bg-brand-light"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Pill({ label, n }: { label: string; n: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[12px] font-semibold ${
        n > 0
          ? "border-status-pending/30 bg-status-pending/10 text-status-pending"
          : "border-brand-line bg-brand-light text-brand-mute"
      }`}
    >
      {label} <span className="num">{n}</span>
    </span>
  );
}
