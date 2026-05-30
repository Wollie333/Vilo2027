"use client";

import { CalendarDays, Check, Pencil } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

function fmtLong(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function nightsBetween(a: string, b: string): number {
  const f = new Date(`${a}T00:00:00Z`).getTime();
  const t = new Date(`${b}T00:00:00Z`).getTime();
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (1000 * 60 * 60 * 24));
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Editable check-in / check-out for the checkout page. Changing the dates
 * navigates to the same URL with new ?from/?to (preserving every other param),
 * so the SERVER re-renders with fresh pricing + availability — nothing about
 * the trip total is computed or trusted on the client.
 */
export function CheckoutDateEditor({
  checkIn,
  checkOut,
  minNights,
}: {
  checkIn: string;
  checkOut: string;
  minNights: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(checkIn);
  const [to, setTo] = useState(checkOut);
  const [applying, setApplying] = useState(false);

  const minStay = Math.max(1, minNights);
  const draftNights = from && to ? nightsBetween(from, to) : 0;
  const valid = draftNights >= minStay;
  const changed = from !== checkIn || to !== checkOut;

  // Keep check-out at least one night after check-in as the picker changes.
  function onFromChange(next: string) {
    setFrom(next);
    if (next && (!to || nightsBetween(next, to) < 1)) {
      setTo(addDays(next, Math.max(1, minStay)));
    }
  }

  function apply() {
    if (!valid || !changed) {
      setOpen(false);
      return;
    }
    setApplying(true);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("from", from);
    params.set("to", to);
    // Dropping per-room guest counts is fine — the server re-derives them; but
    // keep room_ids/guests so the same rooms stay selected after the reload.
    router.push(`${pathname}?${params.toString()}`);
  }

  const tile =
    "flex items-center justify-between gap-3 rounded-card border p-4 text-left transition";

  return (
    <div className="p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`${tile} ${open ? "border-brand-primary bg-brand-accent/20" : "border-brand-line hover:border-brand-primary/50"}`}
          aria-expanded={open}
        >
          <span>
            <span className="block text-[11px] font-medium uppercase tracking-wider text-brand-mute">
              Check-in
            </span>
            <span className="mt-1 block font-display text-lg font-semibold text-brand-ink">
              {fmtLong(checkIn)}
            </span>
          </span>
          <Pencil className="h-4 w-4 shrink-0 text-brand-mute" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`${tile} ${open ? "border-brand-primary bg-brand-accent/20" : "border-brand-line hover:border-brand-primary/50"}`}
          aria-expanded={open}
        >
          <span>
            <span className="block text-[11px] font-medium uppercase tracking-wider text-brand-mute">
              Check-out
            </span>
            <span className="mt-1 block font-display text-lg font-semibold text-brand-ink">
              {fmtLong(checkOut)}
            </span>
          </span>
          <Pencil className="h-4 w-4 shrink-0 text-brand-mute" />
        </button>
      </div>

      {open ? (
        <div className="mt-3 rounded-card border border-brand-line bg-brand-light/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-brand-ink">
            <CalendarDays className="h-4 w-4 text-brand-primary" />
            Change your dates
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-brand-mute">
                Check-in
              </span>
              <input
                type="date"
                value={from}
                min={todayIso()}
                onChange={(e) => onFromChange(e.target.value)}
                disabled={applying}
                className="w-full rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-brand-mute">
                Check-out
              </span>
              <input
                type="date"
                value={to}
                min={from ? addDays(from, 1) : todayIso()}
                onChange={(e) => setTo(e.target.value)}
                disabled={applying}
                className="w-full rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-brand-mute">
              {valid ? (
                <span>
                  <span className="font-semibold text-brand-ink">
                    {draftNights}
                  </span>{" "}
                  {draftNights === 1 ? "night" : "nights"}
                </span>
              ) : (
                <span className="text-status-cancelled">
                  Minimum stay is {minStay} {minStay === 1 ? "night" : "nights"}
                  .
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFrom(checkIn);
                  setTo(checkOut);
                  setOpen(false);
                }}
                disabled={applying}
                className="rounded px-3.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={!valid || !changed || applying}
                className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {applying ? "Updating…" : "Update dates"}
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-brand-mute">
            Updating re-checks availability and recalculates your total.
          </p>
        </div>
      ) : null}
    </div>
  );
}
