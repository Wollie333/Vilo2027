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

import {
  cancelBookingChangeAction,
  requestBookingChangeAction,
} from "./actions";

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
}: {
  bookingId: string;
  checkIn: string | null;
  checkOut: string | null;
  hostName: string;
  pending: PendingRequest[];
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<null | "date" | "guest">(null);
  const [busy, start] = React.useTransition();

  // Date form
  const [newIn, setNewIn] = React.useState(checkIn ?? "");
  const [newOut, setNewOut] = React.useState(checkOut ?? "");
  const [dateMsg, setDateMsg] = React.useState("");

  // Guest form
  const [gName, setGName] = React.useState("");
  const [gEmail, setGEmail] = React.useState("");
  const [gPhone, setGPhone] = React.useState("");
  const [gConsent, setGConsent] = React.useState(false);
  const [gMsg, setGMsg] = React.useState("");

  const close = () => setMode(null);

  function submitDate() {
    start(async () => {
      const res = await requestBookingChangeAction({
        bookingId,
        type: "date_change",
        checkIn: newIn,
        checkOut: newOut,
        message: dateMsg.trim() || null,
      });
      if (res.ok) {
        toast.success("Date-change request sent to your host.");
        close();
        router.refresh();
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
        toast.success("Request to add a guest sent to your host.");
        close();
        setGName("");
        setGEmail("");
        setGPhone("");
        setGConsent(false);
        setGMsg("");
        router.refresh();
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

  return (
    <>
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

      {pending.length > 0 ? (
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
          <div className="space-y-3 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Check-in</span>
                <input
                  type="date"
                  value={newIn}
                  onChange={(e) => setNewIn(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Check-out</span>
                <input
                  type="date"
                  value={newOut}
                  onChange={(e) => setNewOut(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
            <label className="block">
              <span className={labelCls}>Note to host (optional)</span>
              <textarea
                rows={3}
                value={dateMsg}
                onChange={(e) => setDateMsg(e.target.value.slice(0, 1000))}
                placeholder="Anything that helps your host decide."
                className={inputCls}
              />
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
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Send request
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add-a-guest modal */}
      <Dialog open={mode === "guest"} onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-w-md gap-0 rounded-card border-brand-line bg-white p-0">
          <DialogHeader className="border-b border-brand-line px-5 py-4 text-left">
            <DialogTitle className="flex items-center gap-2 text-brand-ink">
              <UserPlus className="h-4 w-4 text-brand-primary" />
              Add a guest to the trip
            </DialogTitle>
            <DialogDescription className="text-brand-mute">
              We'll create them a guest profile for this booking once {hostName}{" "}
              approves. All fields are required.
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
                I confirm I have this person&apos;s permission to share their
                details with {hostName}, and for Wielo to create them a guest
                profile so they can access this booking, per Wielo&apos;s terms
                and privacy policy.
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
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Send request
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
