// KPI card matching the host Guests/Listings KPI strip.
export function AdminKpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {label}
      </div>
      <div className="num mt-1 font-display text-[20px] font-bold leading-none text-brand-ink">
        {value}
      </div>
      {sub ? (
        <div className="mt-1.5 text-[11.5px] text-brand-mute">{sub}</div>
      ) : null}
    </div>
  );
}
