"use client";

import {
  CalendarRange,
  ChevronRight,
  Loader2,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/ui/date-picker";
import { SubmitSuccess } from "@/components/portal/SubmitSuccess";
import { formatMoney } from "@/lib/format";

import {
  cancelBookingChangeAction,
  previewGuestUpdateAction,
  requestBookingChangeAction,
} from "./actions";

/** Add `days` to an ISO yyyy-mm-dd date (UTC-safe). */
function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nightsBetweenIso(a: string, b: string): number {
  if (!a || !b) return 0;
  const ms =
    new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86400000);
}

export type PendingRequest = {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

const inputCls =
  "mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10";
const labelCls =
  "text-[11px] font-semibold uppercase tracking-wider text-brand-mute";

function Row({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-5 py-3 text-left text-[13px] text-brand-ink transition hover:bg-brand-light/60"
    >
      {icon}
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-brand-mute" />
    </button>
  );
}

/**
 * "Manage booking" request rows — a guest ASKS the host to change dates or add a
 * guest; nothing changes until the host approves via their GuestRequestBanner.
 * Shows any pending request with a Cancel control. Writes booking_requests, which
 * the shared activity aggregator surfaces on both timelines.
 */
export function ManageBookingRequests({
  bookingId,
  checkIn,
  checkOut,
  hostName,
  pending,
  variant = "rail",
}: {
  bookingId: string;
  checkIn: string | null;
  checkOut: string | null;
  hostName: string;
  pending: PendingRequest[];
  /** "rail" = full-width rows + pending list (Manage-booking section);
   *  "toolbar" = compact header buttons (top of the trip page). */
  variant?: "rail" | "toolbar";
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<null | "date" | "guest">(null);
  const [sent, setSent] = React.useState(false);
  const [busy, start] = React.useTransition();

  // Date form
  const [newIn, setNewIn] = React.useState(checkIn ?? "");
  const [newOut, setNewOut] = React.useState(checkOut ?? "");
  const [dateMsg, setDateMsg] = React.useState("");
  const [dateConsent, setDateConsent] = React.useState(false);

  const originalNights = nightsBetweenIso(checkIn ?? "", checkOut ?? "");
  const todayIso = React.useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );

  // Live estimate for the proposed dates — read-only, host confirms the final price.
  type Estimate = {
    newTotal: number | null;
    delta: number | null;
    currency: string;
    available: boolean;
  };
  const [estimate, setEstimate] = React.useState<Estimate | null>(null);
  const [estimating, setEstimating] = React.useState(false);

  // Debounced: recompute whenever the proposed window changes (and differs from
  // the current one). Guards against races by tagging each request.
  const estimateSeq = React.useRef(0);
  React.useEffect(() => {
    if (mode !== "date") return;
    const changed = newIn !== (checkIn ?? "") || newOut !== (checkOut ?? "");
    if (!changed || nightsBetweenIso(newIn, newOut) <= 0) {
      setEstimate(null);
      setEstimating(false);
      return;
    }
    const seq = ++estimateSeq.current;
    setEstimating(true);
    const t = setTimeout(async () => {
      const res = await previewGuestUpdateAction({
        bookingId,
        checkIn: newIn,
        checkOut: newOut,
      });
      if (seq !== estimateSeq.current) return; // superseded
      setEstimating(false);
      if (res.ok) {
        setEstimate({
          newTotal: res.newTotal,
          delta: res.delta,
          currency: res.currency,
          available: res.available,
        });
      } else {
        setEstimate(null);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [mode, newIn, newOut, checkIn, checkOut, bookingId]);

  // Picking a new check-in keeps the ORIGINAL night count by default (the guest
  // can still drag check-out to add or drop nights).
  function onDateRangeChange(from: string, to: string) {
    if (from && from !== newIn && (!to || to <= from) && originalNights > 0) {
      setNewIn(from);
      setNewOut(addDaysIso(from, originalNights));
      return;
    }
    setNewIn(from);
    setNewOut(to);
  }

  // Guest form
  const [gName, setGName] = React.useState("");
  const [gEmail, setGEmail] = React.useState("");
  const [gPhone, setGPhone] = React.useState("");
  const [gConsent, setGConsent] = React.useState(false);
  const [gMsg, setGMsg] = React.useState("");

  // Close the active modal, reset its form + the success screen, then refresh so
  // any new pending row shows. Refresh runs on close so it never blocks success.
  function close() {
    setMode(null);
    setSent(false);
    setNewIn(checkIn ?? "");
    setNewOut(checkOut ?? "");
    setDateMsg("");
    setDateConsent(false);
    setEstimate(null);
    setEstimating(false);
    setGName("");
    setGEmail("");
    setGPhone("");
    setGConsent(false);
    setGMsg("");
    router.refresh();
  }

  function submitDate() {
    if (nightsBetweenIso(newIn, newOut) <= 0) {
      toast.error("Pick a check-out date after your check-in.");
      return;
    }
    if (!dateConsent) {
      toast.error(
        "Please confirm you understand the price may change and will be quoted.",
      );
      return;
    }
    start(async () => {
      const res = await requestBookingChangeAction({
        bookingId,
        type: "date_change",
        checkIn: newIn,
        checkOut: newOut,
        message: dateMsg.trim() || null,
      });
      if (res.ok) {
        setSent(true);
      } else {
        toast.error(res.error);
      }
    });
  }

  function submitGuest() {
    if (!gConsent) {
      toast.error("Please confirm you have their consent.");
      return;
    }
    start(async () => {
      const res = await requestBookingChangeAction({
        bookingId,
        type: "guest_change",
        fullName: gName.trim(),
        email: gEmail.trim(),
        phone: gPhone.trim(),
        consent: true,
        message: gMsg.trim() || null,
      });
      if (res.ok) {
        setSent(true);
      } else {
        toast.error(res.error);
      }
    });
  }

  function cancelPending(id: string) {
    start(async () => {
      const res = await cancelBookingChangeAction(id);
      if (res.ok) {
        toast.success("Request cancelled.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const toolbarBtn =
    "inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-brand-ink transition hover:bg-brand-light/60";

  return (
    <>
      {variant === "toolbar" ? (
        <>
          <button
            type="button"
            onClick={() => setMode("date")}
            className={toolbarBtn}
          >
            <CalendarRange className="h-3.5 w-3.5 text-brand-primary" /> Change
            dates
          </button>
          <button
            type="button"
            onClick={() => setMode("guest")}
            className={toolbarBtn}
          >
            <UserPlus className="h-3.5 w-3.5 text-brand-primary" /> Add a guest
          </button>
        </>
      ) : (
        <div className="divide-y divide-brand-line">
          <Row
            icon={<CalendarRange className="h-4 w-4 text-brand-mute" />}
            label="Change dates"
            onClick={() => setMode("date")}
          />
          <Row
            icon={<UserPlus className="h-4 w-4 text-brand-mute" />}
            label="Add a guest to the trip"
            onClick={() => setMode("guest")}
          />
        </div>
      )}

      {variant === "rail" && pending.length > 0 ? (
        <div className="space-y-2 border-t border-brand-line bg-brand-light/40 p-4">
          {pending.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[12px] shadow-sm ring-1 ring-brand-line"
            >
              <span className="inline-flex items-center rounded-pill bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-amber-700">
                Pending
              </span>
              <span className="flex-1 text-brand-ink">
                {p.type === "date_change"
                  ? `Date change → ${String(p.payload?.check_in ?? "?")} → ${String(
                      p.payload?.check_out ?? "?",
                    )}`
                  : `Add guest: ${String(p.payload?.full_name ?? "—")}`}
              </span>
              <button
                type="button"
                onClick={() => cancelPending(p.id)}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-[8px] border border-brand-line px-2 py-1 text-[11px] font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink disabled:opacity-60"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Date-change modal */}
      <Dialog open={mode === "date"} onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-w-md gap-0 rounded-card border-brand-line bg-white p-0">
          {sent ? (
            <SubmitSuccess
              title={`Date-change request sent to ${hostName}`}
              primaryHref="/portal/inbox"
              onClose={close}
            >
              {hostName} reviews and confirms — your booking only moves once
              they approve.
            </SubmitSuccess>
          ) : (
            <>
              <DialogHeader className="border-b border-brand-line px-5 py-4 text-left">
                <DialogTitle className="flex items-center gap-2 text-brand-ink">
                  <CalendarRange className="h-4 w-4 text-brand-primary" />
                  Request new dates
                </DialogTitle>
                <DialogDescription className="text-brand-mute">
                  {hostName} reviews and confirms — your booking only moves once
                  they approve.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 px-5 py-4">
                <div>
                  <span className={labelCls}>New dates</span>
                  <div className="mt-1.5">
                    <DateRangePicker
                      from={newIn}
                      to={newOut}
                      min={todayIso}
                      onChange={onDateRangeChange}
                    />
                  </div>
                  {originalNights > 0 ? (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-brand-mute">
                      You booked {originalNights} night
                      {originalNights === 1 ? "" : "s"}. Pick a new check-in and
                      we keep the same length — move check-out to add or drop
                      nights.
                    </p>
                  ) : null}
                </div>

                {nightsBetweenIso(newIn, newOut) > 0 &&
                (newIn !== (checkIn ?? "") || newOut !== (checkOut ?? "")) ? (
                  <div className="rounded-[10px] border border-brand-line bg-brand-light/50 p-3 text-[12.5px]">
                    {estimating ? (
                      <span className="inline-flex items-center gap-1.5 text-brand-mute">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                        Estimating…
                      </span>
                    ) : estimate && estimate.newTotal != null ? (
                      !estimate.available ? (
                        <span className="text-amber-700">
                          Those dates aren&apos;t available — try another
                          window.
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-brand-mute">
                              Estimated new total
                            </span>
                            <span className="font-semibold text-brand-ink">
                              {formatMoney(
                                estimate.newTotal,
                                estimate.currency,
                              )}
                            </span>
                          </div>
                          {estimate.delta != null &&
                          Math.abs(estimate.delta) >= 0.01 ? (
                            <div className="flex items-center justify-between">
                              <span className="text-brand-mute">
                                {estimate.delta > 0
                                  ? "You'd pay extra"
                                  : "Back to you"}
                              </span>
                              <span
                                className={
                                  estimate.delta > 0
                                    ? "font-semibold text-brand-ink"
                                    : "font-semibold text-emerald-700"
                                }
                              >
                                {formatMoney(
                                  Math.abs(estimate.delta),
                                  estimate.currency,
                                )}
                              </span>
                            </div>
                          ) : null}
                          <p className="pt-0.5 text-[11px] leading-relaxed text-brand-mute">
                            Estimate only — your host confirms the final price.
                          </p>
                        </div>
                      )
                    ) : null}
                  </div>
                ) : null}

                <label className="block">
                  <span className={labelCls}>Note to host (optional)</span>
                  <textarea
                    rows={2}
                    value={dateMsg}
                    onChange={(e) => setDateMsg(e.target.value.slice(0, 1000))}
                    placeholder="Anything that helps your host decide."
                    className={inputCls}
                  />
                </label>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] bg-brand-light/60 px-3 py-2.5 text-[12px] leading-relaxed text-brand-ink">
                  <input
                    type="checkbox"
                    checked={dateConsent}
                    onChange={(e) => setDateConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-line text-brand-primary focus:ring-brand-primary/30"
                  />
                  <span>
                    I understand this may change the price. {hostName} will send
                    a quote and I can accept or decline before anything changes.
                  </span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-brand-line px-5 py-3">
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitDate}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Send request
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add-a-guest modal */}
      <Dialog open={mode === "guest"} onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-w-md gap-0 rounded-card border-brand-line bg-white p-0">
          {sent ? (
            <SubmitSuccess
              title={`Request sent to ${hostName}`}
              primaryHref="/portal/inbox"
              onClose={close}
            >
              We&apos;ll create them a guest profile for this booking once{" "}
              {hostName} approves.
            </SubmitSuccess>
          ) : (
            <>
              <DialogHeader className="border-b border-brand-line px-5 py-4 text-left">
                <DialogTitle className="flex items-center gap-2 text-brand-ink">
                  <UserPlus className="h-4 w-4 text-brand-primary" />
                  Add a guest to the trip
                </DialogTitle>
                <DialogDescription className="text-brand-mute">
                  We&apos;ll create them a guest profile for this booking once{" "}
                  {hostName} approves. All fields are required.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 px-5 py-4">
                <label className="block">
                  <span className={labelCls}>Full name</span>
                  <input
                    value={gName}
                    onChange={(e) => setGName(e.target.value)}
                    placeholder="Their full name"
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Email</span>
                  <input
                    type="email"
                    value={gEmail}
                    onChange={(e) => setGEmail(e.target.value)}
                    placeholder="their@email.com"
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Contact number</span>
                  <input
                    type="tel"
                    value={gPhone}
                    onChange={(e) => setGPhone(e.target.value)}
                    placeholder="+27…"
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Note to host (optional)</span>
                  <textarea
                    rows={2}
                    value={gMsg}
                    onChange={(e) => setGMsg(e.target.value.slice(0, 1000))}
                    className={inputCls}
                  />
                </label>
                <label className="flex items-start gap-2.5 rounded-[10px] bg-brand-light/60 px-3 py-2.5 text-[12px] text-brand-ink">
                  <input
                    type="checkbox"
                    checked={gConsent}
                    onChange={(e) => setGConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-line text-brand-primary focus:ring-brand-primary/30"
                  />
                  <span>
                    I confirm I have this person&apos;s permission to share
                    their details with {hostName}, and for Wielo to create them
                    a guest profile so they can access this booking, per
                    Wielo&apos;s terms and privacy policy.
                  </span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-brand-line px-5 py-3">
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitGuest}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Send request
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
