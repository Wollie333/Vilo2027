"use client";

import {
  Building2,
  CalendarCheck,
  CreditCard,
  Gift,
  Home,
  KeyRound,
  PackagePlus,
  Search,
  Shield,
  Star,
  StickyNote,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

// A reusable, human-friendly activity/history timeline. Feed it a normalised
// list of ActivityEvents and it renders one consistent style everywhere — a
// coloured category icon, the plain-English "what happened", who did it, any
// context, and the date + time. Search + category filter are built in.
//
// The humanisation (turning raw audit rows / domain events into ActivityEvents)
// lives with each surface; this component owns only the shared look + behaviour.

export type ActivityCategory =
  | "account"
  | "subscription"
  | "product"
  | "finance"
  | "listing"
  | "business"
  | "booking"
  | "review"
  | "support"
  | "affiliate"
  | "note"
  | "system";

export type ActivityActorKind = "admin" | "user" | "host" | "system";

export type ActivityEvent = {
  id: string;
  category: ActivityCategory;
  /** Plain-English summary, e.g. "Sent offer: Beta Membership". */
  title: string;
  /** Who did it (display name). */
  actor: string;
  actorKind: ActivityActorKind;
  /** Optional extra detail (reason, status, "acting as this user"…). */
  context?: string | null;
  /** ISO timestamp. */
  at: string;
};

const CATEGORY_META: Record<
  ActivityCategory,
  { label: string; icon: LucideIcon; dot: string }
> = {
  account: {
    label: "Account",
    icon: UserCog,
    dot: "bg-brand-primary/10 text-brand-primary",
  },
  subscription: {
    label: "Membership",
    icon: CreditCard,
    dot: "bg-violet-100 text-violet-600",
  },
  product: {
    label: "Products",
    icon: PackagePlus,
    dot: "bg-sky-100 text-sky-600",
  },
  finance: {
    label: "Finance",
    icon: CreditCard,
    dot: "bg-emerald-100 text-emerald-600",
  },
  listing: {
    label: "Listings",
    icon: Home,
    dot: "bg-brand-secondary/10 text-brand-secondary",
  },
  business: {
    label: "Business",
    icon: Building2,
    dot: "bg-amber-100 text-amber-600",
  },
  booking: {
    label: "Bookings",
    icon: CalendarCheck,
    dot: "bg-status-confirmed/10 text-status-confirmed",
  },
  review: { label: "Reviews", icon: Star, dot: "bg-amber-100 text-amber-600" },
  support: {
    label: "Support access",
    icon: KeyRound,
    dot: "bg-status-pending/10 text-status-pending",
  },
  affiliate: {
    label: "Affiliate",
    icon: Gift,
    dot: "bg-pink-100 text-pink-600",
  },
  note: {
    label: "Notes",
    icon: StickyNote,
    dot: "bg-brand-light text-brand-mute",
  },
  system: {
    label: "System",
    icon: Shield,
    dot: "bg-brand-light text-brand-mute",
  },
};

const ACTOR_BADGE: Record<ActivityActorKind, string> = {
  admin: "border-brand-secondary/30 bg-brand-secondary/10 text-brand-secondary",
  user: "border-brand-line bg-brand-light text-brand-mute",
  host: "border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
  system: "border-brand-line bg-brand-light text-brand-mute",
};
const ACTOR_LABEL: Record<ActivityActorKind, string> = {
  admin: "Admin",
  user: "User",
  host: "Host",
  system: "System",
};

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function fmtTime(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityTimeline({
  events,
  title = "History",
  emptyLabel = "No activity recorded yet.",
  limit = 200,
}: {
  events: ActivityEvent[];
  title?: string;
  emptyLabel?: string;
  limit?: number;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ActivityCategory | "all">("all");

  const sorted = useMemo(
    () => [...events].sort((a, b) => (a.at < b.at ? 1 : -1)),
    [events],
  );

  // Only offer category filters for categories actually present.
  const presentCategories = useMemo(() => {
    const set = new Set<ActivityCategory>();
    for (const e of events) set.add(e.category);
    return (Object.keys(CATEGORY_META) as ActivityCategory[]).filter((c) =>
      set.has(c),
    );
  }, [events]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sorted.filter((e) => {
      if (cat !== "all" && e.category !== cat) return false;
      if (needle) {
        const hay = [e.title, e.actor, e.context]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [sorted, q, cat]);

  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3.5">
        <CalendarCheck className="h-4 w-4 text-brand-mute" />
        <span className="font-display text-[15px] font-bold text-brand-ink">
          {title}
        </span>
        <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
          {events.length}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-brand-line bg-[#FBFDFC] px-4 py-2.5">
        <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-pill border border-transparent bg-white px-3 ring-1 ring-brand-line focus-within:border-brand-primary focus-within:ring-brand-primary/30">
          <Search className="h-4 w-4 text-brand-mute" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search history…"
            className="w-full bg-transparent text-[13px] text-brand-ink outline-none placeholder:text-brand-mute"
          />
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value as ActivityCategory | "all")}
          className="h-9 rounded-pill border border-brand-line bg-white px-3 text-[13px] font-medium text-brand-ink outline-none focus:border-brand-primary"
        >
          <option value="all">All events</option>
          {presentCategories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_META[c].label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-brand-mute">
          {events.length === 0 ? emptyLabel : "No events match this filter."}
        </p>
      ) : (
        <ol className="relative">
          {filtered.slice(0, limit).map((e) => {
            const meta = CATEGORY_META[e.category];
            const Icon = meta.icon;
            return (
              <li
                key={e.id}
                className="flex items-start gap-3 border-t border-brand-line px-5 py-3.5 first:border-t-0"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.dot}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold leading-snug text-brand-ink">
                    {e.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-brand-mute">
                    <span
                      className={`inline-flex items-center rounded-pill border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${ACTOR_BADGE[e.actorKind]}`}
                    >
                      {ACTOR_LABEL[e.actorKind]}
                    </span>
                    <span className="font-medium text-brand-ink">
                      {e.actor}
                    </span>
                    {e.context ? (
                      <>
                        <span className="text-brand-line">·</span>
                        <span>{e.context}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11.5px] font-medium text-brand-ink">
                    {fmtDate(e.at)}
                  </div>
                  <div className="text-[10.5px] text-brand-mute">
                    {fmtTime(e.at)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {filtered.length > 0 ? (
        <div className="border-t border-brand-line bg-[#FBFDFC] px-4 py-3 text-[12px] tabular-nums text-brand-mute">
          Showing {Math.min(filtered.length, limit)} of {events.length}
        </div>
      ) : null}
    </div>
  );
}
