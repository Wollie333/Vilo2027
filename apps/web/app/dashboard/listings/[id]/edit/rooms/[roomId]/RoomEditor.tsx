"use client";

import {
  ArrowUpRight,
  Bath,
  BedDouble,
  Check,
  ChevronRight,
  Eye,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
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

// Real, computed-on-the-server stats for the header band.
export type RoomStats = {
  bookings: number;
  occupancyPct: number;
  avgRate: number;
  rating: number | null;
  reviewCount: number;
};

// Read-only availability month for the right-rail calendar.
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
  const [room, setRoom] = useState<RoomEditorRoom>(initialRoom);
  const [photos, setPhotos] = useState<RoomEditorPhoto[]>(initialPhotos);
  const [amenityKeys, setAmenityKeys] = useState<string[]>(initialAmenityKeys);
  const [bookablePending, startBookable] = useTransition();
  const [savePending, startSave] = useTransition();
  const [dangerPending, startDanger] = useTransition();
  const [justSaved, setJustSaved] = useState(false);

  const formRef = useRef<RoomDetailsFormHandle>(null);

  function saveChanges() {
    startSave(async () => {
      const ok = await formRef.current?.save();
      if (ok) {
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 4000);
      }
    });
  }

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
        router.push(`/dashboard/listings/${listingId}/edit?tab=rooms`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const publicRoomPath = listingSlug
    ? `/listing/${listingSlug}/rooms/${room.id}`
    : null;
  const roomsHref = `/dashboard/listings/${listingId}/edit?tab=rooms`;

  const featuredPhoto =
    photos.find((p) => p.id === room.featured_photo_id) ?? photos[0] ?? null;
  const bedCount = room.beds.reduce((acc, b) => acc + b.quantity, 0);
  const rate = priceLabel(room, currency);
  const bedLine =
    room.bed_type && room.bed_type.length > 0
      ? room.bed_type
      : bedCount > 0
        ? `${bedCount} bed${bedCount === 1 ? "" : "s"}`
        : "Beds not set";

  return (
    <div className="space-y-6 pb-16">
      {/* ===== SUB-HEADER ===== */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-3 rounded-card border border-brand-line bg-white/95 px-5 py-2.5 shadow-card backdrop-blur">
        <div className="min-w-0 shrink-0">
          <nav className="flex items-center gap-1.5 text-[11.5px] text-brand-mute">
            <Link href={roomsHref} className="hover:text-brand-ink">
              {listingName}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={roomsHref} className="hover:text-brand-ink">
              Rooms
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-ink">
              {room.name || "Untitled room"}
            </span>
          </nav>
          <h1 className="mt-1 font-display text-[18px] font-extrabold leading-none text-brand-ink">
            Edit room
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {justSaved ? (
            <span className="hidden items-center gap-1.5 text-[12px] text-brand-mute md:inline-flex">
              <Check className="h-3.5 w-3.5 text-brand-primary" /> Saved
            </span>
          ) : null}
          <Link
            href={roomsHref}
            className="inline-flex h-9 items-center rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light/60"
          >
            Cancel
          </Link>
          {publicRoomPath ? (
            <Link
              href={publicRoomPath}
              target="_blank"
              className="hidden h-9 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light/60 sm:inline-flex"
            >
              <Eye className="h-4 w-4 text-brand-mute" /> Preview
            </Link>
          ) : null}
          <button
            type="button"
            onClick={saveChanges}
            disabled={savePending}
            className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white shadow-glow transition hover:bg-brand-secondary disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            {savePending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* ===== ROOM HEADER CARD ===== */}
      <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="h-[104px] w-full shrink-0 overflow-hidden rounded-[12px] bg-brand-accent/40 sm:w-[150px]">
            {featuredPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={featuredPhoto.url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-brand-primary">
                <BedDouble className="h-7 w-7" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11.5px] font-semibold ${
                  room.is_active
                    ? "border-status-confirmed/20 bg-status-confirmed/10 text-status-confirmed"
                    : "border-status-pending/20 bg-status-pending/10 text-status-pending"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${room.is_active ? "bg-status-confirmed" : "bg-status-pending"}`}
                />
                {room.is_active ? "Bookable" : "Hidden"}
              </span>
              <span className="rounded-pill bg-brand-light px-2.5 py-1 text-[11px] font-medium text-brand-mute">
                Inside {listingName}
              </span>
            </div>
            <h2 className="mt-2 font-display text-[24px] font-extrabold leading-tight text-brand-ink">
              {room.name || "Untitled room"}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-brand-mute">
              <span className="inline-flex items-center gap-1.5">
                <BedDouble className="h-3.5 w-3.5" /> {bedLine} · sleeps{" "}
                {room.max_guests}
              </span>
              <span className="text-brand-line">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Bath className="h-3.5 w-3.5" />
                {hasEnsuite ? "En-suite" : "Shared bath"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5 sm:flex-col sm:items-end">
            <div className="flex items-center gap-2 rounded-pill border border-brand-line bg-brand-light/60 px-3 py-1.5">
              <span className="text-[12px] font-medium text-brand-ink">
                Bookable
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={room.is_active}
                aria-label="Toggle bookable"
                onClick={() => setBookable(!room.is_active)}
                disabled={bookablePending}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
                  room.is_active ? "bg-brand-primary" : "bg-brand-line"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    room.is_active ? "translate-x-[18px]" : "translate-x-[2px]"
                  }`}
                />
              </button>
            </div>
            {publicRoomPath ? (
              <Link
                href={publicRoomPath}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-primary hover:underline"
              >
                View public page <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>
        {/* stat band — real data */}
        <div className="grid grid-cols-2 gap-px border-t border-brand-line bg-brand-line sm:grid-cols-4">
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
              stats.avgRate > 0 ? formatMoney(stats.avgRate, currency) : "—"
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
      </section>

      {/* ===== TWO COLUMN ===== */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_330px]">
        {/* LEFT: form sections (already wired) */}
        <div className="min-w-0 space-y-6">
          <RoomDetailsForm
            ref={formRef}
            listingId={listingId}
            room={room}
            onSaved={(patch) => setRoom((r) => ({ ...r, ...patch }))}
          />

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

          <RoomAmenitiesSection
            listingId={listingId}
            roomId={room.id}
            amenityKeys={amenityKeys}
            onChange={setAmenityKeys}
          />

          <RoomAccessSection
            listingId={listingId}
            roomId={room.id}
            access={initialAccess}
          />

          {/* DANGER ZONE */}
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <header className="border-b border-brand-line px-5 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-status-cancelled">
                Danger zone
              </div>
            </header>
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
        </div>

        {/* RIGHT: rail */}
        <aside className="space-y-6">
          <div className="space-y-6 lg:sticky lg:top-20">
            {/* PUBLISH STATUS */}
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="border-b border-brand-line px-5 py-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                  Publish status
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${room.is_active ? "bg-status-confirmed" : "bg-status-pending"}`}
                  />
                  <h3 className="font-display text-[15px] font-bold text-brand-ink">
                    {room.is_active ? "Live & bookable" : "Hidden from search"}
                  </h3>
                </div>
                <p className="mt-1 text-[11.5px] text-brand-mute">
                  {room.is_active
                    ? "Guests can find and book this room on your direct site."
                    : "Turn on “Bookable” to list it for direct bookings."}
                </p>
              </div>
              <div className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-brand-accent text-[10px] font-bold text-brand-secondary">
                  V
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-brand-ink">
                    Vilo direct
                  </div>
                  <div className="truncate text-[10.5px] text-brand-mute">
                    {publicRoomPath ?? "Publish the listing to share"}
                  </div>
                </div>
                {room.is_active ? (
                  <span className="inline-flex items-center gap-1 rounded-pill border border-status-confirmed/20 bg-status-confirmed/10 px-2 py-0.5 text-[11px] font-semibold text-status-confirmed">
                    <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />
                    Live
                  </span>
                ) : (
                  <span className="rounded-pill bg-brand-light px-2 py-0.5 text-[11px] font-medium text-brand-mute">
                    Off
                  </span>
                )}
              </div>
            </section>

            {/* GUEST PREVIEW */}
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
                      {bedLine} · sleeps {room.max_guests}
                      {hasEnsuite ? " · en-suite" : ""}
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

            {/* AVAILABILITY */}
            <AvailabilityCalendar availability={availability} />
          </div>
        </aside>
      </div>
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
