export type BookingStatus =
  | "pending"
  | "pending_eft"
  | "pending_eft_review"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled_by_host"
  | "cancelled_by_guest"
  | "declined"
  | "expired"
  | "no_show";

const STYLES: Record<BookingStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-800" },
  pending_eft: { label: "Awaiting EFT", cls: "bg-amber-100 text-amber-800" },
  pending_eft_review: {
    label: "EFT review",
    cls: "bg-amber-100 text-amber-800",
  },
  confirmed: { label: "Confirmed", cls: "bg-green-100 text-green-800" },
  checked_in: { label: "Checked in", cls: "bg-emerald-100 text-emerald-800" },
  completed: { label: "Completed", cls: "bg-indigo-100 text-indigo-800" },
  cancelled_by_host: { label: "Cancelled", cls: "bg-red-100 text-red-800" },
  cancelled_by_guest: {
    label: "Guest cancelled",
    cls: "bg-red-100 text-red-800",
  },
  declined: { label: "Declined", cls: "bg-red-100 text-red-800" },
  expired: { label: "Expired", cls: "bg-slate-100 text-slate-700" },
  no_show: { label: "No show", cls: "bg-slate-100 text-slate-700" },
};

export function StatusPill({ status }: { status: string }) {
  const s = STYLES[status as BookingStatus] ?? {
    label: status,
    cls: "bg-brand-line text-brand-mute",
  };
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
