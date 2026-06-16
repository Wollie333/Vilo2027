// Small at-a-glance indicator of which Paystack key pair Vilo is charging with.
// Reused on the Products hub and the Payment settings header.
export function PaystackModeBadge({
  enabled,
  mode,
}: {
  enabled: boolean;
  mode: "live" | "test";
}) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-brand-light px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-mute" />
        Paystack off
      </span>
    );
  }
  if (mode === "test") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill border border-status-pending/30 bg-status-pending/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-status-pending">
        <span className="h-1.5 w-1.5 rounded-full bg-status-pending" />
        Test mode
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-status-confirmed/30 bg-status-confirmed/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-status-confirmed">
      <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />
      Live mode
    </span>
  );
}
