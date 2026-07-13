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

import {
  EventTimeline,
  type TimelineEvent,
  type TimelineTone,
} from "@/components/timeline/EventTimeline";

// A reusable, human-friendly activity/history timeline. Feed it a normalised
// list of ActivityEvents and it renders the shared EventTimeline look (colour-
// coded rail + category pill + meta line) with a search + category filter on
// top. One visual language with every other history/activity feed in the app.
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

// Category → shared timeline colour family (dot + pill), so the admin history
// speaks the same visual language as every other EventTimeline feed.
const CATEGORY_TONE: Record<ActivityCategory, TimelineTone> = {
  account: "blue",
  subscription: "violet",
  product: "blue",
  finance: "green",
  listing: "blue",
  business: "amber",
  booking: "green",
  review: "amber",
  support: "amber",
  affiliate: "indigo",
  note: "slate",
  system: "slate",
};

const ACTOR_LABEL: Record<ActivityActorKind, string> = {
  admin: "Admin",
  user: "User",
  host: "Host",
  system: "System",
};

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
        <div className="p-5">
          <EventTimeline
            sort={false}
            events={filtered.slice(0, limit).map((e) => {
              // Fold the actor identity (kind + name) and any context into the
              // shared timeline's meta line.
              const who =
                e.actor && e.actor !== ACTOR_LABEL[e.actorKind]
                  ? `${ACTOR_LABEL[e.actorKind]} · ${e.actor}`
                  : ACTOR_LABEL[e.actorKind];
              const ev: TimelineEvent = {
                at: e.at,
                title: e.title,
                kind: CATEGORY_META[e.category].label,
                tone: CATEGORY_TONE[e.category],
                meta: [who, e.context].filter(Boolean).join(" · "),
              };
              return ev;
            })}
          />
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="border-t border-brand-line bg-[#FBFDFC] px-4 py-3 text-[12px] tabular-nums text-brand-mute">
          Showing {Math.min(filtered.length, limit)} of {events.length}
        </div>
      ) : null}
    </div>
  );
}
