import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Calendar,
  ChevronRight,
  Clock3,
  DoorOpen,
  LogIn,
  LogOut,
  MessageSquare,
  Package,
  Plus,
  Star,
  Tag,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

import { formatMoney } from "@/lib/format";

type ToneKey = "green" | "amber" | "red" | "indigo" | "sky" | "gray";
const TAG: Record<ToneKey, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50 text-red-600",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-600",
  sky: "border-sky-200 bg-sky-50 text-sky-600",
  gray: "border-brand-line bg-brand-light text-brand-mute",
};
const DOT: Record<ToneKey, string> = {
  green: "bg-status-confirmed",
  amber: "bg-status-pending",
  red: "bg-status-cancelled",
  indigo: "bg-status-completed",
  sky: "bg-status-inhouse",
  gray: "bg-status-draft",
};

export type MainDashboardData = {
  firstName: string;
  dateLabel: string;
  currency: string;
  stat: {
    revenue: number;
    revenueDeltaPct: number | null;
    monthLabel: string;
    bookingsCount: number;
    confirmedCount: number;
    pendingThisMonth: number;
    occupancyPct: number | null;
    totalListings: number;
    avgRating: number | null;
    totalReviews: number;
    nextCheckIn: { inLabel: string; guest: string; listing: string } | null;
  };
  needs: {
    id: string;
    tone: "amber" | "red" | "accent";
    icon: "clock" | "message" | "badge" | "money" | "review";
    title: string;
    sub: string;
    tag: { label: string; tone: ToneKey };
    href: string;
  }[];
  todayOps: {
    arrivals: { count: number; names: string[] };
    departures: { count: number; names: string[] };
    inHouse: { count: number; names: string[] };
  };
  week7: {
    weekday: string;
    day: number;
    arrivals: number;
    departures: number;
    occupied: number;
    isToday: boolean;
  }[];
  upcoming: {
    id: string;
    guest: string;
    initials: string;
    listing: string;
    dates: string;
    meta: string;
    amount: number;
    tag: { label: string; tone: ToneKey };
  }[];
  revenue90: {
    total: number;
    points: number[];
    bookings: number;
    avgNightly: number;
    commissionSaved: number;
  };
  messages: {
    id: string;
    name: string;
    initials: string;
    time: string;
    snippet: string;
    unread: boolean;
    tag: { label: string; tone: ToneKey } | null;
  }[];
  listings: {
    id: string;
    name: string;
    meta: string;
    occ: number | null;
    tag: { label: string; tone: ToneKey };
  }[];
};

function NeedIcon({
  kind,
}: {
  kind: "clock" | "message" | "badge" | "money" | "review";
}) {
  if (kind === "message")
    return <MessageSquare className="h-[18px] w-[18px]" />;
  if (kind === "badge") return <BadgeCheck className="h-[18px] w-[18px]" />;
  if (kind === "money") return <Banknote className="h-[18px] w-[18px]" />;
  if (kind === "review") return <Star className="h-[18px] w-[18px]" />;
  return <Clock3 className="h-[18px] w-[18px]" />;
}

function sparkPath(points: number[], w = 700, h = 170): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M0,${h / 2} L${w},${h / 2}`;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  return points
    .map((v, i) => {
      const x = i * step;
      const y = h - 8 - ((v - min) / span) * (h - 16);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function MainDashboard({ data: d }: { data: MainDashboardData }) {
  const line = sparkPath(d.revenue90.points);
  const area = line ? `${line} L700,170 L0,170 Z` : "";

  return (
    <div className="w-full">
      {/* sub-header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-[18px] font-extrabold leading-none text-brand-ink">
            {greeting()}, {d.firstName}
          </h1>
          <div className="mt-1.5 text-[12.5px] text-brand-mute">
            {d.dateLabel}
          </div>
        </div>
        <Link
          href="/dashboard/bookings/new"
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary"
        >
          <Plus className="h-4 w-4" /> New booking
        </Link>
      </div>

      {/* stat band */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label={`Revenue · ${d.stat.monthLabel}`}>
          <div className="font-display text-[22px] font-bold leading-none text-brand-ink">
            {formatMoney(d.stat.revenue, d.currency)}
          </div>
          {d.stat.revenueDeltaPct != null ? (
            <div
              className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${d.stat.revenueDeltaPct >= 0 ? "text-status-confirmed" : "text-status-pending"}`}
            >
              <TrendingUp className="h-3 w-3" />
              {d.stat.revenueDeltaPct >= 0 ? "+" : ""}
              {d.stat.revenueDeltaPct}% vs last month
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-brand-mute">this month</div>
          )}
        </StatTile>
        <StatTile label="Bookings">
          <div className="font-display text-[22px] font-bold leading-none text-brand-ink">
            {d.stat.bookingsCount}
          </div>
          <div className="mt-1 text-[11px] text-brand-mute">
            {d.stat.confirmedCount} confirmed · {d.stat.pendingThisMonth}{" "}
            pending
          </div>
        </StatTile>
        <StatTile label="Occupancy">
          <div className="font-display text-[22px] font-bold leading-none text-brand-ink">
            {d.stat.occupancyPct == null ? "—" : `${d.stat.occupancyPct}%`}
          </div>
          <div className="mt-1 text-[11px] text-brand-mute">
            across {d.stat.totalListings}{" "}
            {d.stat.totalListings === 1 ? "listing" : "listings"}
          </div>
        </StatTile>
        <StatTile label="Avg rating">
          <div className="inline-flex items-center gap-1 font-display text-[22px] font-bold leading-none text-brand-ink">
            {d.stat.avgRating == null ? "—" : d.stat.avgRating.toFixed(1)}
            {d.stat.avgRating != null ? (
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            ) : null}
          </div>
          <div className="mt-1 text-[11px] text-brand-mute">
            {d.stat.totalReviews === 0
              ? "after first stay"
              : `from ${d.stat.totalReviews} reviews`}
          </div>
        </StatTile>
        <div className="col-span-2 bg-brand-secondary p-4 sm:col-span-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
            Next check-in
          </div>
          {d.stat.nextCheckIn ? (
            <>
              <div className="mt-1.5 font-display text-[18px] font-bold leading-none text-white">
                {d.stat.nextCheckIn.inLabel}
              </div>
              <div className="mt-1 truncate text-[11px] text-brand-accent">
                {d.stat.nextCheckIn.guest} · {d.stat.nextCheckIn.listing}
              </div>
            </>
          ) : (
            <div className="mt-1.5 font-display text-[16px] font-bold leading-none text-white">
              None scheduled
            </div>
          )}
        </div>
      </section>

      {/* today's operations — the daily heartbeat */}
      <section className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line sm:grid-cols-3">
        <OpsTile
          icon={<LogIn className="h-4 w-4" />}
          tone="green"
          label="Arriving today"
          count={d.todayOps.arrivals.count}
          names={d.todayOps.arrivals.names}
          href="/dashboard/bookings?seg=upcoming"
        />
        <OpsTile
          icon={<DoorOpen className="h-4 w-4" />}
          tone="sky"
          label="In-house now"
          count={d.todayOps.inHouse.count}
          names={d.todayOps.inHouse.names}
          href="/dashboard/bookings?seg=inhouse"
        />
        <OpsTile
          icon={<LogOut className="h-4 w-4" />}
          tone="amber"
          label="Departing today"
          count={d.todayOps.departures.count}
          names={d.todayOps.departures.names}
          href="/dashboard/bookings?seg=checkingout"
        />
      </section>

      {/* quick actions — one-tap into the things a host manages */}
      <section className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <QuickAction
          icon={Calendar}
          label="Calendar"
          href="/dashboard/calendar"
        />
        <QuickAction icon={Tag} label="Specials" href="/dashboard/specials" />
        <QuickAction icon={Ticket} label="Coupons" href="/dashboard/coupons" />
        <QuickAction icon={Package} label="Add-ons" href="/dashboard/addons" />
        <QuickAction icon={Users} label="Guests" href="/dashboard/guests" />
        <QuickAction
          icon={Wallet}
          label="Payments"
          href="/dashboard/payments"
        />
      </section>

      {/* main grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {/* needs attention */}
          {d.needs.length > 0 ? (
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                  Needs your attention
                </div>
                <span className="rounded-pill bg-brand-accent px-2 py-0.5 text-[11px] font-semibold text-brand-secondary">
                  {d.needs.length}
                </span>
              </div>
              <div className="p-2.5">
                {d.needs.map((n) => (
                  <Link
                    key={n.id}
                    href={n.href}
                    className="flex items-center gap-3 rounded-[12px] px-3 py-3 transition hover:bg-[#FAFCFB]"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
                        n.tone === "amber"
                          ? "bg-status-pending/10 text-status-pending"
                          : n.tone === "red"
                            ? "bg-status-cancelled/10 text-status-cancelled"
                            : "bg-brand-accent text-brand-secondary"
                      }`}
                    >
                      <NeedIcon kind={n.icon} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-brand-ink">
                        {n.title}
                      </div>
                      <div className="mt-0.5 text-[12px] text-brand-mute">
                        {n.sub}
                      </div>
                    </div>
                    <span
                      className={`hidden shrink-0 items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[11.5px] font-semibold sm:inline-flex ${TAG[n.tag.tone]}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${DOT[n.tag.tone]}`}
                      />
                      {n.tag.label}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-brand-mute" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* upcoming stays */}
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                Upcoming stays
              </div>
              <Link
                href="/dashboard/bookings"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary hover:underline"
              >
                All bookings <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {/* week-at-a-glance — arrivals (green) / departures (amber) per day */}
            <div className="grid grid-cols-7 gap-1 border-b border-brand-line px-3 py-3">
              {d.week7.map((day, i) => (
                <div
                  key={i}
                  className={`rounded-[9px] py-1.5 text-center ${day.isToday ? "bg-brand-accent" : "bg-[#FAFCFB]"}`}
                  title={`${day.arrivals} in · ${day.departures} out · ${day.occupied} staying`}
                >
                  <div className="text-[9px] font-semibold uppercase tracking-wide text-brand-mute">
                    {day.weekday}
                  </div>
                  <div
                    className={`text-[13px] font-bold ${day.isToday ? "text-brand-secondary" : "text-brand-ink"}`}
                  >
                    {day.day}
                  </div>
                  <div className="mt-1 flex min-h-[12px] items-center justify-center gap-1 text-[9px] font-bold leading-none">
                    {day.arrivals > 0 ? (
                      <span className="text-status-confirmed">
                        {day.arrivals}↓
                      </span>
                    ) : null}
                    {day.departures > 0 ? (
                      <span className="text-status-pending">
                        {day.departures}↑
                      </span>
                    ) : null}
                    {day.arrivals === 0 && day.departures === 0 ? (
                      <span
                        className={
                          day.occupied > 0
                            ? "text-status-inhouse"
                            : "text-brand-line"
                        }
                      >
                        {day.occupied > 0 ? "•" : "–"}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2.5 p-2.5">
              {d.upcoming.length === 0 ? (
                <div className="px-3 py-8 text-center text-[13px] text-brand-mute">
                  No upcoming stays yet.
                </div>
              ) : (
                d.upcoming.map((b) => (
                  <Link
                    key={b.id}
                    href={`/dashboard/bookings/${b.id}`}
                    className="flex items-center gap-3.5 rounded-[13px] border border-brand-line bg-white p-3.5 transition hover:border-[#CDE6D8] hover:shadow-[0_10px_24px_-16px_rgba(6,78,59,.25)]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-[11px] font-bold text-white">
                      {b.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold text-brand-ink">
                        {b.guest}
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-brand-mute">
                        {b.listing} · {b.dates} · {b.meta}
                      </div>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <div className="font-display text-[14px] font-bold text-brand-ink">
                        {formatMoney(b.amount, d.currency)}
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[11.5px] font-semibold ${TAG[b.tag.tone]}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${DOT[b.tag.tone]}`}
                      />
                      {b.tag.label}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-brand-mute" />
                  </Link>
                ))
              )}
            </div>
          </section>

          {/* revenue */}
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="border-b border-brand-line px-5 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                Revenue · last 90 days
              </div>
              <div className="mt-1 font-display text-[20px] font-bold leading-none text-brand-ink">
                {formatMoney(d.revenue90.total, d.currency)}
              </div>
            </div>
            <div className="px-5 pt-4">
              <svg
                viewBox="0 0 700 170"
                className="h-[150px] w-full"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <g stroke="#EDF3EF" strokeWidth="1">
                  <line x1="0" y1="42" x2="700" y2="42" />
                  <line x1="0" y1="85" x2="700" y2="85" />
                  <line x1="0" y1="128" x2="700" y2="128" />
                </g>
                {area ? <path d={area} fill="url(#revGrad)" /> : null}
                {line ? (
                  <path
                    d={line}
                    stroke="#10B981"
                    strokeWidth="2.5"
                    fill="none"
                  />
                ) : null}
              </svg>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-px border-t border-brand-line bg-brand-line">
              <RevStat label="Bookings" value={String(d.revenue90.bookings)} />
              <RevStat
                label="Avg nightly"
                value={formatMoney(d.revenue90.avgNightly, d.currency)}
              />
              <RevStat
                label="Commission saved"
                value={formatMoney(d.revenue90.commissionSaved, d.currency)}
                tone="secondary"
                sub="vs OTA 18%"
              />
            </div>
          </section>
        </div>

        {/* right rail */}
        <div className="space-y-6">
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                Recent messages
              </div>
              <Link
                href="/dashboard/inbox"
                className="text-[12px] font-medium text-brand-primary hover:underline"
              >
                Open inbox →
              </Link>
            </div>
            <div className="divide-y divide-brand-line">
              {d.messages.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px] text-brand-mute">
                  No messages yet.
                </div>
              ) : (
                d.messages.map((m) => (
                  <Link
                    key={m.id}
                    href="/dashboard/inbox"
                    className={`block px-4 py-3 transition-colors hover:bg-brand-light ${m.unread ? "bg-brand-light/50" : ""}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-[11px] font-bold text-white">
                        {m.initials}
                      </div>
                      <div
                        className={`flex-1 truncate text-[13.5px] text-brand-ink ${m.unread ? "font-bold" : "font-semibold"}`}
                      >
                        {m.name}
                      </div>
                      <span className="shrink-0 text-[11px] text-brand-mute">
                        {m.time}
                      </span>
                    </div>
                    {m.snippet ? (
                      <p className="mt-1.5 line-clamp-2 pl-[42px] text-[12.5px] leading-snug text-brand-mute">
                        {m.snippet}
                      </p>
                    ) : null}
                    {m.tag ? (
                      <div className="mt-1.5 pl-[42px]">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[11px] font-semibold ${TAG[m.tag.tone]}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${DOT[m.tag.tone]}`}
                          />
                          {m.tag.label}
                        </span>
                      </div>
                    ) : null}
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                Your listings
              </div>
              <Link
                href="/dashboard/properties"
                className="text-[12px] font-medium text-brand-primary hover:underline"
              >
                Manage →
              </Link>
            </div>
            <div className="divide-y divide-brand-line">
              {d.listings.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px] text-brand-mute">
                  No listings yet.
                </div>
              ) : (
                d.listings.map((l) => (
                  <Link
                    key={l.id}
                    href="/dashboard/properties"
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-brand-light"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-brand-light text-brand-secondary">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13.5px] font-semibold text-brand-ink">
                          {l.name}
                        </span>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[11px] font-semibold ${TAG[l.tag.tone]}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${DOT[l.tag.tone]}`}
                          />
                          {l.tag.label}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[11.5px] text-brand-mute">
                        {l.meta}
                      </div>
                      {l.occ != null ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-brand-light">
                            <div
                              className="h-full bg-brand-primary"
                              style={{ width: `${l.occ}%` }}
                            />
                          </div>
                          <span className="text-[10.5px] font-semibold text-brand-mute">
                            {l.occ}%
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function OpsTile({
  icon,
  tone,
  label,
  count,
  names,
  href,
}: {
  icon: React.ReactNode;
  tone: "green" | "sky" | "amber";
  label: string;
  count: number;
  names: string[];
  href: string;
}) {
  const toneCls =
    tone === "green"
      ? "bg-status-confirmed/10 text-status-confirmed"
      : tone === "sky"
        ? "bg-status-inhouse/10 text-status-inhouse"
        : "bg-status-pending/10 text-status-pending";
  const summary =
    count === 0
      ? "Nobody scheduled"
      : names.slice(0, 2).join(", ") +
        (count > names.slice(0, 2).length
          ? ` +${count - names.slice(0, 2).length} more`
          : "");
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 bg-white p-4 transition-colors hover:bg-[#FAFCFB]"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${toneCls}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-[20px] font-bold leading-none text-brand-ink">
            {count}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-mute">
            {label}
          </span>
        </div>
        <div className="mt-1 truncate text-[12px] text-brand-mute">
          {summary}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-brand-line transition-colors group-hover:text-brand-mute" />
    </Link>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Calendar;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-1.5 rounded-[13px] border border-brand-line bg-white py-3.5 text-brand-ink shadow-card transition hover:border-[#CDE6D8] hover:bg-[#FAFCFB]"
    >
      <Icon className="h-[18px] w-[18px] text-brand-secondary" />
      <span className="text-[11.5px] font-semibold">{label}</span>
    </Link>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function StatTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#FAFCFB] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function RevStat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "secondary";
  sub?: string;
}) {
  return (
    <div className="bg-white p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-[16px] font-bold ${tone === "secondary" ? "text-brand-secondary" : "text-brand-ink"}`}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-[10.5px] text-brand-mute">{sub}</div>
      ) : null}
    </div>
  );
}
