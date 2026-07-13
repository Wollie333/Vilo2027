"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Bath,
  BedDouble,
  Check,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Image as ImageIcon,
  KeyRound,
  ListChecks,
  Pencil,
  Star,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";

import { deleteRoomAction, updateRoomAction } from "../../actions";
import { RoomAmenitiesSection } from "./sections/RoomAmenitiesSection";
import {
  RoomDetailsForm,
  type RoomDetailsFormHandle,
} from "./sections/RoomDetailsForm";
import { RoomPhotosSection } from "./sections/RoomPhotosSection";
import {
  RoomAccessSection,
  type RoomAccessInitial,
} from "./sections/RoomAccessSection";

export type RoomPricingMode = "per_room" | "per_person" | "per_room_plus_extra";

export type RoomEditorRoom = {
  id: string;
  name: string;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  max_guests: number;
  min_guests: number;
  min_nights: number;
  base_price: number;
  weekend_price: number | null;
  cleaning_fee: number;
  is_active: boolean;
  room_size_sqm: number | null;
  bed_type: string | null;
  view_type: string | null;
  experiences: string[];
  featured_photo_id: string | null;
  // Bed composition — capacity (max_guests) is derived from these (Σ sleeps×qty).
  beds: { bed_kind: string; quantity: number; sleeps: number }[];
  // Pricing model.
  pricing_mode: RoomPricingMode;
  price_per_person: number | null;
  base_occupancy: number | null;
  extra_guest_price: number | null;
  // Flat per-night age + pet pricing.
  child_price: number;
  infant_price: number;
  pet_fee: number;
  infant_max_age: number;
  child_max_age: number;
  allow_children: boolean;
  allow_infants: boolean;
  allow_pets: boolean;
};

/** The room's effective "from" nightly figure for the chosen pricing mode. */
export function effectiveNightly(room: {
  pricing_mode: RoomPricingMode;
  base_price: number;
  price_per_person: number | null;
}): number {
  return room.pricing_mode === "per_person"
    ? (room.price_per_person ?? 0)
    : room.base_price;
}

export type RoomEditorPhoto = { id: string; url: string };

// Real, computed-on-the-server stats for the Review step.
export type RoomStats = {
  bookings: number;
  occupancyPct: number;
  avgRate: number;
  rating: number | null;
  reviewCount: number;
};

// Read-only availability month for the Review step calendar.
export type RoomAvailability = {
  monthLabel: string;
  /** Empty Monday-based cells before day 1. */
  leadPad: number;
  days: { day: number; status: "booked" | "held" | "blocked" | "open" }[];
};

function priceLabel(
  room: RoomEditorRoom,
  currency: string,
): { amount: string; sub: string } {
  if (room.pricing_mode === "per_person") {
    return {
      amount: formatMoney(room.price_per_person ?? 0, currency),
      sub: "per person",
    };
  }
  if (room.pricing_mode === "per_room_plus_extra") {
    return {
      amount: formatMoney(room.base_price, currency),
      sub: "from / night",
    };
  }
  return { amount: formatMoney(room.base_price, currency), sub: "per night" };
}

type StepKey =
  | "details"
  | "photos"
  | "amenities"
  | "access"
  | "review"
  | "danger";

type StepDef = { key: StepKey; label: string; icon: LucideIcon };

const STEPS: StepDef[] = [
  { key: "details", label: "Details & pricing", icon: BedDouble },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "amenities", label: "Amenities", icon: ListChecks },
  { key: "access", label: "Guest access", icon: KeyRound },
  { key: "review", label: "Review & publish", icon: ClipboardCheck },
  { key: "danger", label: "Danger zone", icon: AlertTriangle },
];

const PANEL_META: Record<StepKey, { title: string; desc: string }> = {
  details: {
    title: "Details & pricing",
    desc: "Name, beds, capacity and how this room is priced.",
  },
  photos: {
    title: "Photos",
    desc: "Photos that belong to this room. Pick one as the cover.",
  },
  amenities: {
    title: "Amenities",
    desc: "What this specific room offers, on top of the listing-wide amenities.",
  },
  access: {
    title: "Guest access",
    desc: "Arrival details a guest who books this room needs.",
  },
  review: {
    title: "Review & publish",
    desc: "Everything at a glance before this room goes bookable.",
  },
  danger: {
    title: "Danger zone",
    desc: "Snooze or archive this room.",
  },
};

export function RoomEditor({
  listingId,
  listingName,
  listingSlug,
  currency,
  room: initialRoom,
  hasEnsuite,
  stats,
  availability,
  initialPhotos,
  initialAmenityKeys,
  initialAccess,
}: {
  listingId: string;
  listingName: string;
  listingSlug: string | null;
  currency: string;
  room: RoomEditorRoom;
  hasEnsuite: boolean;
  stats: RoomStats;
  availability: RoomAvailability;
  initialPhotos: RoomEditorPhoto[];
  initialAmenityKeys: string[];
  initialAccess: RoomAccessInitial | null;
}) {
  const router = useRouter();
  const [active, setActive] = useState<StepKey>("details");
  const [room, setRoom] = useState<RoomEditorRoom>(initialRoom);
  const [photos, setPhotos] = useState<RoomEditorPhoto[]>(initialPhotos);
  const [amenityKeys, setAmenityKeys] = useState<string[]>(initialAmenityKeys);
  const [bookablePending, startBookable] = useTransition();
  const [dangerPending, startDanger] = useTransition();

  const formRef = useRef<RoomDetailsFormHandle>(null);

  function setBookable(next: boolean) {
    startBookable(async () => {
      const result = await updateRoomAction(listingId, room.id, {
        is_active: next,
      });
      if (result.ok) {
        setRoom((r) => ({ ...r, is_active: next }));
        toast.success(next ? "Room is bookable" : "Room hidden");
      } else {
        toast.error(result.error);
      }
    });
  }

  function archive() {
    startDanger(async () => {
      const result = await deleteRoomAction(listingId, room.id);
      if (result.ok) {
        toast.success("Room archived");
        router.push(`/dashboard/properties/${listingId}/edit?tab=rooms`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const publicRoomPath = listingSlug
    ? `/property/${listingSlug}/rooms/${room.id}`
    : null;
  const roomsHref = `/dashboard/properties/${listingId}/edit?tab=rooms`;

  const featuredPhoto =
    photos.find((p) => p.id === room.featured_photo_id) ?? photos[0] ?? null;
  const cover = featuredPhoto?.url ?? null;
  const bedCount = room.beds.reduce((acc, b) => acc + b.quantity, 0);
  const rate = priceLabel(room, currency);
  const nightly = effectiveNightly(room);
  const bedLine =
    room.bed_type && room.bed_type.length > 0
      ? room.bed_type
      : bedCount > 0
        ? `${bedCount} bed${bedCount === 1 ? "" : "s"}`
        : "Beds not set";

  // ---- Readiness (drives the health ring + the Review step) ----
  // Everything is live client state — the header, preview and ring recompute as
  // the host types in the Details form (via onDraft) and adds photos.
  const readiness = useMemo(() => {
    const items: { label: string; done: boolean; step: StepKey }[] = [
      { label: "Room name", done: !!room.name?.trim(), step: "details" },
      {
        label: "A short description",
        done: !!room.description?.trim(),
        step: "details",
      },
      { label: "At least one photo", done: photos.length >= 1, step: "photos" },
      {
        label: "Beds & capacity",
        done: (room.max_guests ?? 0) > 0 && bedCount > 0,
        step: "details",
      },
      { label: "A nightly price", done: nightly > 0, step: "details" },
    ];
    const done = items.filter((i) => i.done).length;
    return {
      items,
      done,
      total: items.length,
      pct: Math.round((done / items.length) * 100),
      allDone: done === items.length,
    };
  }, [room.name, room.description, room.max_guests, bedCount, nightly, photos]);

  // Short context line under each step in the rail.
  function railSub(key: StepKey): string | null {
    switch (key) {
      case "details":
        return `${bedLine} · sleeps ${room.max_guests}`;
      case "photos":
        return `${photos.length} photo${photos.length === 1 ? "" : "s"}`;
      case "amenities":
        return amenityKeys.length > 0
          ? `${amenityKeys.length} selected`
          : "None yet";
      case "access":
        return "Arrival details";
      case "review":
        return readiness.allDone
          ? "Guest-ready"
          : `${readiness.done}/${readiness.total} ready`;
      case "danger":
        return "Snooze · archive";
      default:
        return null;
    }
  }

  // Has the host filled any arrival details? Drives the Access step's check.
  const hasAccess =
    !!initialAccess &&
    Object.values(initialAccess).some(
      (v) => typeof v === "string" && v.trim().length > 0,
    );

  // Per-step completion → green check badge in the rail (matches the add-on /
  // special editors' UI principle).
  function stepDone(key: StepKey): boolean {
    switch (key) {
      case "details":
        return !!room.name?.trim() && bedCount > 0 && nightly > 0;
      case "photos":
        return photos.length >= 1;
      case "amenities":
        return amenityKeys.length > 0;
      case "access":
        return hasAccess;
      case "review":
        return readiness.allDone;
      default:
        return false;
    }
  }

  return (
    <div className="space-y-5 pb-16">
      {/* ============ IDENTITY BAR ============ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-brand-line bg-white px-4 py-3 shadow-card">
        <div className="h-12 w-16 shrink-0 overflow-hidden rounded-[11px] border border-brand-line bg-brand-light">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-brand-mute">
              <BedDouble className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-[11px] text-brand-mute">
            <Link href={roomsHref} className="hover:text-brand-ink">
              {listingName}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={roomsHref} className="hover:text-brand-ink">
              Rooms
            </Link>
          </nav>
          <div className="mt-0.5 flex items-center gap-2.5">
            <h1 className="truncate font-display text-[19px] font-extrabold leading-none text-brand-ink">
              {room.name || "Untitled room"}
            </h1>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[11px] font-semibold ${
                room.is_active
                  ? "border-brand-primary/30 bg-brand-accent text-brand-secondary"
                  : "border-brand-line bg-brand-light text-brand-mute"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  room.is_active ? "bg-brand-primary" : "bg-brand-mute"
                }`}
              />
              {room.is_active ? "Bookable" : "Hidden"}
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-pill border border-brand-line bg-brand-light/60 px-3 py-1.5 lg:flex">
            <span className="text-[12px] font-semibold text-brand-ink">
              {bookablePending
                ? "Saving…"
                : room.is_active
                  ? "Bookable"
                  : "Hidden"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={room.is_active}
              aria-label="Toggle bookable"
              onClick={() => setBookable(!room.is_active)}
              disabled={bookablePending}
              className={`relative h-5 w-9 rounded-pill transition-colors disabled:opacity-50 ${
                room.is_active ? "bg-brand-primary" : "bg-brand-line"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                  room.is_active ? "left-4" : "left-0.5"
                }`}
              />
            </button>
          </div>
          {publicRoomPath ? (
            <Link
              href={publicRoomPath}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
            >
              <Eye className="h-4 w-4 text-brand-mute" /> Preview
            </Link>
          ) : null}
          <Link
            href={roomsHref}
            className="inline-flex items-center rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            Done
          </Link>
        </div>
      </div>

      {/* ============ SPLIT: section rail + panel ============ */}
      <div className="grid gap-6 lg:grid-cols-[262px_1fr]">
        {/* section navigator */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <button
            type="button"
            onClick={() => setActive("review")}
            className="mb-3 flex w-full items-center gap-3 rounded-card border border-brand-line bg-white p-3.5 text-left shadow-card transition hover:border-brand-primary/40"
          >
            <ProgressRing pct={readiness.pct} />
            <div className="min-w-0">
              <div className="font-display text-[14px] font-bold text-brand-ink">
                {readiness.allDone ? "Guest-ready" : "Almost ready"}
              </div>
              <div className="text-[11px] text-brand-mute">
                {readiness.done}/{readiness.total} essentials done
              </div>
            </div>
          </button>
          <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Sections
          </div>
          <div className="space-y-1">
            {STEPS.map(({ key, label, icon: Icon }) => {
              const isActive = active === key;
              const isDanger = key === "danger";
              const sub = railSub(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(key)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-[13px] border px-3 py-2.5 text-left transition ${
                    isActive
                      ? isDanger
                        ? "border-status-cancelled/30 bg-status-cancelled/5"
                        : "border-brand-line bg-white shadow-card"
                      : "border-transparent hover:bg-white"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition ${
                      isActive
                        ? isDanger
                          ? "bg-status-cancelled text-white"
                          : "bg-brand-primary text-white"
                        : isDanger
                          ? "bg-status-cancelled/10 text-status-cancelled"
                          : "bg-brand-accent/70 text-brand-secondary"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[13.5px] font-semibold leading-tight ${
                        isDanger
                          ? "text-status-cancelled"
                          : isActive
                            ? "text-brand-ink"
                            : "text-brand-ink/80"
                      }`}
                    >
                      {label}
                    </span>
                    {sub ? (
                      <span className="mt-0.5 block truncate text-[11px] text-brand-mute">
                        {sub}
                      </span>
                    ) : null}
                  </span>
                  {stepDone(key) ? (
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-primary text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : key === "photos" && photos.length > 0 ? (
                    <span className="num shrink-0 rounded-pill bg-brand-line px-1.5 py-0.5 text-[9.5px] font-bold text-brand-mute">
                      {photos.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ============ ACTIVE PANEL ============ */}
        <div className="min-w-0">
          {(() => {
            const meta = PANEL_META[active];
            const ActiveIcon =
              STEPS.find((t) => t.key === active)?.icon ?? BedDouble;
            const danger = active === "danger";
            return (
              <div className="mb-5 flex items-start gap-3.5">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ${
                    danger
                      ? "bg-status-cancelled/10 text-status-cancelled"
                      : "bg-brand-accent text-brand-secondary"
                  }`}
                >
                  <ActiveIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2
                    className={`font-display text-[22px] font-extrabold leading-tight ${
                      danger ? "text-status-cancelled" : "text-brand-ink"
                    }`}
                  >
                    {meta.title}
                  </h2>
                  <p className="mt-0.5 text-[13.5px] text-brand-mute">
                    {meta.desc}
                  </p>
                </div>
              </div>
            );
          })()}

          {active === "details" ? (
            <RoomDetailsForm
              ref={formRef}
              listingId={listingId}
              room={room}
              onSaved={(patch) => setRoom((r) => ({ ...r, ...patch }))}
              onDraft={(patch) => setRoom((r) => ({ ...r, ...patch }))}
            />
          ) : null}

          {active === "photos" ? (
            <RoomPhotosSection
              listingId={listingId}
              roomId={room.id}
              featuredPhotoId={room.featured_photo_id}
              photos={photos}
              onPhotosChange={setPhotos}
              onFeaturedChange={(id) =>
                setRoom((r) => ({ ...r, featured_photo_id: id }))
              }
            />
          ) : null}

          {active === "amenities" ? (
            <RoomAmenitiesSection
              listingId={listingId}
              roomId={room.id}
              amenityKeys={amenityKeys}
              onChange={setAmenityKeys}
              batchSave
            />
          ) : null}

          {active === "access" ? (
            <RoomAccessSection
              listingId={listingId}
              roomId={room.id}
              access={initialAccess}
            />
          ) : null}

          {active === "review" ? (
            <div className="space-y-4">
              {/* readiness */}
              <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
                <div className="flex items-center gap-3 border-b border-brand-line px-5 py-4">
                  <ProgressRing pct={readiness.pct} />
                  <div className="min-w-0">
                    <div className="font-display text-[15px] font-bold text-brand-ink">
                      {readiness.allDone ? "Guest-ready" : "Almost there"}
                    </div>
                    <div className="text-[12px] text-brand-mute">
                      {readiness.allDone
                        ? "Everything guests need is set."
                        : "Finish the flagged items to be guest-ready."}
                    </div>
                  </div>
                </div>
                <div className="grid gap-1 p-4 sm:grid-cols-2">
                  {readiness.items.map((it) => (
                    <button
                      key={it.label}
                      type="button"
                      onClick={() => setActive(it.step)}
                      className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[12.5px] transition hover:bg-brand-light"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          it.done
                            ? "bg-brand-primary text-white"
                            : "bg-brand-light text-brand-mute"
                        }`}
                      >
                        {it.done ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-brand-mute" />
                        )}
                      </span>
                      <span
                        className={`flex-1 ${it.done ? "text-brand-ink" : "text-brand-mute"}`}
                      >
                        {it.label}
                      </span>
                      {!it.done ? (
                        <Pencil className="h-3 w-3 text-brand-mute" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              {/* summary */}
              <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
                <SummaryRow
                  label="Name"
                  value={room.name || "Not set"}
                  muted={!room.name}
                  onEdit={() => setActive("details")}
                />
                <SummaryRow
                  label="Beds"
                  value={bedLine}
                  muted={bedCount === 0}
                  onEdit={() => setActive("details")}
                />
                <SummaryRow
                  label="Sleeps"
                  value={
                    room.max_guests > 0
                      ? `${room.max_guests} guest${room.max_guests === 1 ? "" : "s"}${hasEnsuite ? " · en-suite" : ""}`
                      : "Not set"
                  }
                  muted={room.max_guests === 0}
                  onEdit={() => setActive("details")}
                />
                <SummaryRow
                  label="Price"
                  value={nightly > 0 ? `${rate.amount} ${rate.sub}` : "Not set"}
                  muted={nightly === 0}
                  onEdit={() => setActive("details")}
                />
                <SummaryRow
                  label="Photos"
                  value={`${photos.length} photo${photos.length === 1 ? "" : "s"}`}
                  muted={photos.length === 0}
                  onEdit={() => setActive("photos")}
                />
                <SummaryRow
                  label="Amenities"
                  value={
                    amenityKeys.length > 0
                      ? `${amenityKeys.length} selected`
                      : "None yet"
                  }
                  muted={amenityKeys.length === 0}
                  onEdit={() => setActive("amenities")}
                  last
                />
              </div>

              {/* performance — real, server-computed */}
              <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
                <div className="border-b border-brand-line px-5 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                    Performance
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-px bg-brand-line sm:grid-cols-4">
                  <StatCell
                    label="Bookings"
                    value={String(stats.bookings)}
                    sub="lifetime"
                  />
                  <StatCell
                    label="Occupancy"
                    value={`${stats.occupancyPct}%`}
                    sub="last 30 days"
                  />
                  <StatCell
                    label="Avg rate"
                    value={
                      stats.avgRate > 0
                        ? formatMoney(stats.avgRate, currency)
                        : "—"
                    }
                    sub="per night booked"
                  />
                  <StatCell
                    label="Rating"
                    value={
                      stats.rating != null ? (
                        <span className="inline-flex items-baseline gap-1">
                          {stats.rating.toFixed(1)}
                          <Star className="h-3.5 w-3.5 fill-status-pending text-status-pending" />
                        </span>
                      ) : (
                        "—"
                      )
                    }
                    sub={
                      stats.reviewCount > 0
                        ? `${stats.reviewCount} review${stats.reviewCount === 1 ? "" : "s"}`
                        : "no reviews yet"
                    }
                  />
                </div>
              </div>

              {/* how guests see it + availability */}
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
                  <header className="flex items-center justify-between border-b border-brand-line px-5 py-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                      How guests see it
                    </div>
                    {publicRoomPath ? (
                      <Link
                        href={publicRoomPath}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-secondary hover:text-brand-primary"
                      >
                        Open <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </header>
                  <div className="p-3">
                    <div className="overflow-hidden rounded-[12px] border border-brand-line">
                      <div className="relative aspect-[4/3] bg-brand-accent/40">
                        {featuredPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={featuredPhoto.url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-brand-primary">
                            <BedDouble className="h-8 w-8" />
                          </div>
                        )}
                        <span className="absolute right-2 top-2 rounded-pill bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-brand-secondary backdrop-blur">
                          {photos.length} photo{photos.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="space-y-1.5 px-3 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="truncate text-[13px] font-semibold text-brand-ink">
                            {room.name || "Untitled room"}
                          </div>
                          {stats.rating != null ? (
                            <div className="flex items-center gap-0.5 text-[11px] font-semibold text-brand-ink">
                              <Star className="h-3 w-3 fill-status-pending text-status-pending" />
                              {stats.rating.toFixed(1)}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-brand-mute">
                          <span className="inline-flex items-center gap-1">
                            <Bath className="h-3 w-3" />
                            {bedLine} · sleeps {room.max_guests}
                            {hasEnsuite ? " · en-suite" : ""}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 pt-1">
                          <span className="font-display text-[15px] font-bold text-brand-ink">
                            {rate.amount}
                          </span>
                          <span className="text-[11px] text-brand-mute">
                            / {rate.sub}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <AvailabilityCalendar availability={availability} />
              </div>

              {/* bookable CTA */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-line bg-brand-light/40 px-5 py-4">
                <div className="min-w-0">
                  <div className="font-display text-[14px] font-bold text-brand-ink">
                    {room.is_active
                      ? "This room is bookable"
                      : readiness.allDone
                        ? "Ready to go bookable"
                        : "Not bookable yet"}
                  </div>
                  <div className="text-[12px] text-brand-mute">
                    {room.is_active
                      ? "Guests can find and book this room on your direct site."
                      : readiness.allDone
                        ? "Turn it on to list it for direct bookings."
                        : "Finish the checklist above, then turn it on."}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {publicRoomPath ? (
                    <Link
                      href={publicRoomPath}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
                    >
                      <Eye className="h-4 w-4 text-brand-mute" /> Preview
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setBookable(!room.is_active)}
                    disabled={bookablePending}
                    className={`inline-flex items-center gap-1.5 rounded-pill px-5 py-2.5 text-[13px] font-semibold transition disabled:opacity-60 ${
                      room.is_active
                        ? "border border-status-pending/30 bg-status-pending/10 text-status-pending hover:bg-status-pending/20"
                        : "bg-brand-primary text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] hover:bg-brand-secondary"
                    }`}
                  >
                    {bookablePending
                      ? "Saving…"
                      : room.is_active
                        ? "Hide room"
                        : "Make bookable"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {active === "danger" ? (
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="divide-y divide-brand-line">
                <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <div className="text-[13px] font-semibold text-brand-ink">
                      Snooze this room
                    </div>
                    <div className="text-[11px] text-brand-mute">
                      Hide from search; keep existing bookings.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBookable(false)}
                    disabled={bookablePending || !room.is_active}
                    className="rounded-pill border border-status-pending/30 bg-status-pending/10 px-3.5 py-1.5 text-[12px] font-semibold text-status-pending transition hover:bg-status-pending/20 disabled:opacity-50"
                  >
                    {room.is_active ? "Snooze" : "Snoozed"}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <div className="text-[13px] font-semibold text-brand-ink">
                      Archive room
                    </div>
                    <div className="text-[11px] text-brand-mute">
                      Removes it from your listing. Blocked if active bookings
                      reference it.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={archive}
                    disabled={dangerPending}
                    className="rounded-pill border border-status-cancelled/30 bg-status-cancelled/5 px-3.5 py-1.5 text-[12px] font-semibold text-status-cancelled transition hover:bg-status-cancelled/10 disabled:opacity-50"
                  >
                    {dangerPending ? "Archiving…" : "Archive"}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const circumference = 2 * Math.PI * 15.5;
  const dash = (pct / 100) * circumference;
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#E4EFE8"
          strokeWidth="3.4"
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#10B981"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-[11.5px] font-bold tabular-nums text-brand-ink">
        {pct}%
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  last,
  onEdit,
}: {
  label: string;
  value: string;
  muted?: boolean;
  last?: boolean;
  onEdit: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-5 py-3 ${
        last ? "" : "border-b border-[#EEF4F0]"
      }`}
    >
      <div className="w-24 shrink-0 text-[11.5px] font-semibold uppercase tracking-wide text-brand-mute">
        {label}
      </div>
      <div
        className={`min-w-0 flex-1 truncate text-[13px] ${
          muted ? "italic text-brand-mute" : "font-medium text-brand-ink"
        }`}
      >
        {value}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-brand-line bg-white px-2.5 py-1 text-[11px] font-medium text-brand-mute transition hover:border-brand-primary/40 hover:text-brand-ink"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>
    </div>
  );
}

function StatCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="bg-[#FAFCFB] px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {label}
      </div>
      <div className="mt-1 font-display text-[19px] font-bold leading-none text-brand-ink">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-brand-mute">{sub}</div>
    </div>
  );
}

function AvailabilityCalendar({
  availability,
}: {
  availability: RoomAvailability;
}) {
  const cls: Record<RoomAvailability["days"][number]["status"], string> = {
    booked: "bg-brand-primary text-white",
    held: "bg-status-pending/20 text-status-pending",
    blocked: "bg-brand-line text-brand-mute line-through",
    open: "bg-brand-light text-brand-secondary",
  };
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <header className="flex items-center justify-between border-b border-brand-line px-5 py-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Availability
          </div>
          <h3 className="mt-0.5 font-display text-[14px] font-bold text-brand-ink">
            {availability.monthLabel}
          </h3>
        </div>
      </header>
      <div className="px-5 py-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-brand-mute">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: availability.leadPad }).map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square" />
          ))}
          {availability.days.map((d) => (
            <div
              key={d.day}
              className={`flex aspect-square items-center justify-center rounded-[6px] font-mono text-[10.5px] ${cls[d.status]}`}
            >
              {d.day}
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[10.5px] text-brand-ink">
          <Legend swatch="bg-brand-primary" label="Booked" />
          <Legend swatch="bg-status-pending/20" label="Held" />
          <Legend
            swatch="bg-brand-light border border-brand-line"
            label="Open"
          />
          <Legend swatch="bg-brand-line" label="Blocked" />
        </div>
        <Link
          href="/dashboard/calendar"
          className="mt-3 flex items-center justify-center gap-1 rounded-pill border border-brand-line py-2 text-[12px] font-semibold text-brand-secondary hover:bg-brand-light"
        >
          Open full calendar <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm ${swatch}`} />
      {label}
    </div>
  );
}
