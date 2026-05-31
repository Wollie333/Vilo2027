"use client";

import {
  ArrowLeft,
  Bath,
  BedDouble,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  PartyPopper,
  Rocket,
  Save,
  Settings,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateRoomAction } from "../../actions";
import { RoomAmenitiesSection } from "./sections/RoomAmenitiesSection";
import {
  RoomDetailsForm,
  type RoomDetailsFormHandle,
} from "./sections/RoomDetailsForm";
import { RoomPhotosSection } from "./sections/RoomPhotosSection";

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

type SectionId = "sec-details" | "sec-photos" | "sec-amenities";

const NAV: { id: SectionId; label: string; icon: typeof Settings }[] = [
  { id: "sec-details", label: "Details, beds & pricing", icon: Settings },
  { id: "sec-photos", label: "Photos", icon: ImageIcon },
  { id: "sec-amenities", label: "Amenities", icon: Sparkles },
];

function formatPrice(amount: number, currency: string): string {
  const prefix = currency === "ZAR" ? "R " : `${currency} `;
  const rounded = Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ");
  return `${prefix}${rounded}`;
}

function priceLabel(
  room: RoomEditorRoom,
  currency: string,
): { amount: string; sub: string } {
  if (room.pricing_mode === "per_person") {
    return {
      amount: formatPrice(room.price_per_person ?? 0, currency),
      sub: "per person",
    };
  }
  if (room.pricing_mode === "per_room_plus_extra") {
    return {
      amount: formatPrice(room.base_price, currency),
      sub: "from / night",
    };
  }
  return { amount: formatPrice(room.base_price, currency), sub: "per night" };
}

export function RoomEditor({
  listingId,
  listingName,
  listingSlug,
  currency,
  room: initialRoom,
  initialPhotos,
  initialAmenityKeys,
}: {
  listingId: string;
  listingName: string;
  listingSlug: string | null;
  currency: string;
  room: RoomEditorRoom;
  initialPhotos: RoomEditorPhoto[];
  initialAmenityKeys: string[];
}) {
  const [room, setRoom] = useState<RoomEditorRoom>(initialRoom);
  const [photos, setPhotos] = useState<RoomEditorPhoto[]>(initialPhotos);
  const [amenityKeys, setAmenityKeys] = useState<string[]>(initialAmenityKeys);
  const [active, setActive] = useState<SectionId>("sec-details");
  const [bookablePending, startBookable] = useTransition();
  const [savePending, startSave] = useTransition();
  const [publishPending, startPublish] = useTransition();
  const [published, setPublished] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const formRef = useRef<RoomDetailsFormHandle>(null);

  function saveChanges() {
    startSave(async () => {
      await formRef.current?.save();
    });
  }

  function saveAndPublish() {
    startPublish(async () => {
      const ok = await formRef.current?.save();
      if (!ok) return;
      if (!room.is_active) {
        const result = await updateRoomAction(listingId, room.id, {
          is_active: true,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setRoom((r) => ({ ...r, is_active: true }));
      }
      setConfetti(true);
      setPublished(true);
      setTimeout(() => setConfetti(false), 4200);
    });
  }

  const publicRoomPath = listingSlug
    ? `/listing/${listingSlug}/rooms/${room.id}`
    : null;

  // Scroll-spy: highlight the section nearest the top of the viewport.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id as SectionId);
      },
      { rootMargin: "-140px 0px -55% 0px", threshold: 0 },
    );
    NAV.forEach((n) => {
      const el = document.getElementById(n.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  function jump(id: SectionId) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setActive(id);
  }

  function toggleBookable() {
    const next = !room.is_active;
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

  // Completeness checklist.
  const steps = [
    { label: "Name & description", done: room.name.trim().length > 0 },
    { label: "Beds & capacity", done: room.beds.length > 0 },
    { label: "A photo or two", done: photos.length > 0 },
    { label: "Amenities", done: amenityKeys.length > 0 },
    { label: "A nightly rate", done: effectiveNightly(room) > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);
  const circumference = 2 * Math.PI * 15.5;
  const dash = (percent / 100) * circumference;
  const nextStep = steps.find((s) => !s.done);

  return (
    <div className="space-y-6 pb-24">
      {confetti ? <RoomConfetti /> : null}
      {published ? (
        <RoomPublishedModal
          roomName={room.name}
          publicPath={publicRoomPath}
          listingId={listingId}
          onClose={() => setPublished(false)}
        />
      ) : null}

      {/* Back link + top actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/dashboard/listings/${listingId}/edit?tab=rooms`}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          All rooms · {listingName}
        </Link>

        <div className="flex items-center gap-2">
          {publicRoomPath ? (
            <Link
              href={publicRoomPath}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-medium text-brand-ink hover:bg-brand-light/60"
            >
              <Eye className="h-4 w-4" />
              View room
            </Link>
          ) : null}
          <button
            type="button"
            onClick={saveChanges}
            disabled={savePending || publishPending}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-medium text-brand-ink hover:bg-brand-light/60 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {savePending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={saveAndPublish}
            disabled={publishPending || savePending}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-glow hover:bg-brand-secondary disabled:opacity-60"
          >
            <Rocket className="h-4 w-4" />
            {publishPending ? "Publishing…" : "Save & publish"}
          </button>
        </div>
      </div>

      {/* ============ DARK HERO ============ */}
      <section className="relative overflow-hidden rounded-card border border-brand-line shadow-card">
        <div className="grid gap-0 md:grid-cols-[1.5fr_1fr]">
          {/* Info side */}
          <div className="relative bg-brand-gradient-dark p-7 text-white md:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-primary/25 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -left-20 bottom-0 h-44 w-44 rounded-full bg-brand-secondary/40 blur-3xl"
            />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent backdrop-blur">
                  Room editor
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider backdrop-blur ${
                    room.is_active
                      ? "bg-brand-primary/15 text-brand-primary"
                      : "bg-white/10 text-brand-accent/80"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      room.is_active ? "bg-brand-primary" : "bg-brand-accent/50"
                    }`}
                  />
                  {room.is_active ? "Bookable now" : "Hidden"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent/80 backdrop-blur">
                  Inside{" "}
                  <Link
                    href={`/dashboard/listings/${listingId}/edit`}
                    className="underline decoration-brand-primary underline-offset-2 hover:text-white"
                  >
                    {listingName}
                  </Link>
                </span>
              </div>

              <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight md:text-[34px]">
                {room.name || "Untitled room"}
              </h2>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-brand-accent/80">
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble className="h-3.5 w-3.5" />
                  {bedLine} · sleeps {room.max_guests}
                </span>
                <span className="text-brand-accent/40">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Bath className="h-3.5 w-3.5" />
                  {room.bathrooms
                    ? `${room.bathrooms} bath${room.bathrooms === 1 ? "" : "s"}`
                    : "Bath not set"}
                </span>
              </div>

              {/* Stat strip */}
              <div className="mt-6 grid max-w-lg grid-cols-4 gap-3">
                <HeroStat label="Rate" value={rate.amount} sub={rate.sub} />
                <HeroStat
                  label="Sleeps"
                  value={String(room.max_guests)}
                  sub={`${bedCount} bed${bedCount === 1 ? "" : "s"}`}
                />
                <HeroStat
                  label="Photos"
                  value={String(photos.length)}
                  sub={photos.length === 0 ? "add some" : "uploaded"}
                  warn={photos.length === 0}
                />
                <HeroStat
                  label="Cleaning"
                  value={formatPrice(room.cleaning_fee, currency)}
                  sub="once-off"
                />
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {listingSlug ? (
                  <Link
                    href={`/listing/${listingSlug}/rooms/${room.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-4 py-2.5 text-sm font-semibold text-brand-secondary shadow-glow hover:bg-brand-accent"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View public page
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-white/10 px-4 py-2.5 text-sm font-medium text-white/60">
                    <ExternalLink className="h-4 w-4" />
                    Publish listing to share
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2.5 rounded-pill border border-white/15 bg-black/30 px-3 py-1.5 backdrop-blur">
                  <span className="text-[11.5px] font-medium text-white/90">
                    {room.is_active ? "Bookable" : "Hidden"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={room.is_active}
                    aria-label="Toggle bookable"
                    onClick={toggleBookable}
                    disabled={bookablePending}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
                      room.is_active ? "bg-brand-primary" : "bg-white/25"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        room.is_active
                          ? "translate-x-[18px]"
                          : "translate-x-[2px]"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Photo side */}
          <div className="relative bg-brand-dark p-2">
            {photos.length === 0 ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/70">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <p className="text-[12px] font-medium text-white/80">
                  No photos uploaded yet
                </p>
                <button
                  type="button"
                  onClick={() => jump("sec-photos")}
                  className="mt-1 text-[11.5px] font-semibold text-brand-primary hover:text-white"
                >
                  Add the first photo →
                </button>
              </div>
            ) : (
              <>
                <div className="grid h-full min-h-[280px] grid-cols-3 grid-rows-2 gap-1.5">
                  {featuredPhoto ? (
                    <div className="relative col-span-2 row-span-2 overflow-hidden rounded-[10px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={featuredPhoto.url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute left-2.5 top-2.5 rounded-pill bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                        Cover
                      </span>
                    </div>
                  ) : null}
                  {photos
                    .filter((p) => p.id !== featuredPhoto?.id)
                    .slice(0, 2)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="overflow-hidden rounded-[10px]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                </div>
                <button
                  type="button"
                  onClick={() => jump("sec-photos")}
                  className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-[10px] bg-white/95 px-3 py-2 text-[12px] font-semibold text-brand-secondary shadow-card backdrop-blur hover:bg-white"
                >
                  <ImageIcon className="h-4 w-4" />
                  Manage photos
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ============ STICKY SECTION NAV ============ */}
      <section className="sticky top-16 z-20 rounded-card border border-brand-line bg-white/95 shadow-card backdrop-blur">
        <div className="flex items-center gap-0.5 overflow-x-auto px-2 py-1.5">
          {NAV.map((n) => {
            const Icon = n.icon;
            const on = active === n.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => jump(n.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
                  on
                    ? "bg-brand-accent font-semibold text-brand-secondary"
                    : "font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {n.label}
                {n.id === "sec-photos" && photos.length > 0 ? (
                  <span className="rounded-pill bg-brand-line px-1.5 py-0.5 text-[9.5px] font-bold text-brand-mute">
                    {photos.length}
                  </span>
                ) : null}
                {n.id === "sec-amenities" && amenityKeys.length > 0 ? (
                  <span className="rounded-pill bg-brand-line px-1.5 py-0.5 text-[9.5px] font-bold text-brand-mute">
                    {amenityKeys.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {/* ============ TWO-COLUMN ============ */}
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        {/* LEFT: form sections */}
        <div className="space-y-6">
          <div id="sec-details" className="scroll-mt-32">
            <RoomDetailsForm
              ref={formRef}
              listingId={listingId}
              room={room}
              onSaved={(patch) => setRoom((r) => ({ ...r, ...patch }))}
            />
          </div>

          <div id="sec-photos" className="scroll-mt-32">
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
          </div>

          <div id="sec-amenities" className="scroll-mt-32">
            <RoomAmenitiesSection
              listingId={listingId}
              roomId={room.id}
              amenityKeys={amenityKeys}
              onChange={setAmenityKeys}
            />
          </div>
        </div>

        {/* RIGHT: sticky rail */}
        <div className="space-y-5">
          <div className="space-y-5 lg:sticky lg:top-32">
            {/* Live preview */}
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-brand-line px-5 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                  Live preview
                </div>
                {listingSlug ? (
                  <Link
                    href={`/listing/${listingSlug}/rooms/${room.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-secondary hover:text-brand-primary"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>
              <div className="p-4">
                <div className="overflow-hidden rounded-[12px] border border-brand-line">
                  <div className="relative aspect-[16/10] bg-brand-accent/40">
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
                    <span className="absolute right-2.5 top-2.5 rounded-pill bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-brand-secondary backdrop-blur">
                      {photos.length} photo{photos.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="p-3.5">
                    <div className="truncate font-display text-[14px] font-bold text-brand-ink">
                      {room.name || "Untitled room"}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-brand-mute">
                      {bedLine} · sleeps {room.max_guests}
                    </div>
                    <div className="mt-3 flex items-end justify-between border-t border-brand-line pt-3">
                      <div>
                        <span className="font-display text-[17px] font-bold text-brand-ink">
                          {rate.amount}
                        </span>
                        <span className="text-[11px] text-brand-mute">
                          {" "}
                          / {rate.sub}
                        </span>
                      </div>
                      {room.cleaning_fee > 0 ? (
                        <span className="text-[10.5px] text-brand-mute">
                          +{formatPrice(room.cleaning_fee, currency)} clean
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Completeness */}
            <section className="rounded-card border border-brand-line bg-white shadow-card">
              <div className="flex items-center gap-3 border-b border-brand-line px-5 py-4">
                <div className="relative h-12 w-12">
                  <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke="#DCEAE0"
                      strokeWidth="3.2"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeDasharray={`${dash} ${circumference}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-display text-[12px] font-bold text-brand-ink">
                    {percent}%
                  </div>
                </div>
                <div>
                  <div className="font-display text-[14px] font-bold text-brand-ink">
                    {percent === 100 ? "Ready to go" : "Almost ready"}
                  </div>
                  <div className="text-[11.5px] text-brand-mute">
                    {nextStep
                      ? `Next: ${nextStep.label.toLowerCase()}`
                      : "Every section is filled in"}
                  </div>
                </div>
              </div>
              <ul className="space-y-1 px-3 py-3 text-[12.5px]">
                {steps.map((s) => (
                  <li
                    key={s.label}
                    className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 ${
                      s.done ? "" : "bg-status-pending/10"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        s.done
                          ? "bg-brand-primary text-white"
                          : "border-2 border-status-pending text-status-pending"
                      }`}
                    >
                      {s.done ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </span>
                    <span className="flex-1 text-brand-ink">{s.label}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Tip */}
            <section className="rounded-card border border-brand-line bg-brand-accent/40 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-white text-brand-secondary">
                  <Lightbulb className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[12.5px] font-semibold text-brand-ink">
                    Rooms with 5+ photos book faster
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-brand-mute">
                    Show the beds, the bathroom and the view. Set a cover photo
                    that sells the room at a glance.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStat({
  label,
  value,
  sub,
  warn = false,
}: {
  label: string;
  value: string;
  sub: string;
  warn?: boolean;
}) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-accent/60">
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-bold text-white">
        {value}
      </div>
      <div
        className={`text-[10px] ${warn ? "text-status-pending" : "text-brand-accent/60"}`}
      >
        {sub}
      </div>
    </div>
  );
}

/** Celebratory confetti — reuses the shared `.setup-confetti-piece` keyframes. */
function RoomConfetti() {
  const pieces = useMemo(() => {
    const colors = [
      "#10B981",
      "#064E3B",
      "#D1FAE5",
      "#34D399",
      "#A7F3D0",
      "#F4A836",
    ];
    return Array.from({ length: 70 }).map((_, i) => ({
      left: (i * 37) % 100,
      dx: `${((i * 53) % 220) - 110}px`,
      d: `${3 + ((i * 7) % 25) / 10}s`,
      delay: `${((i * 13) % 80) / 100}s`,
      bg: colors[i % colors.length],
      rot: (i * 47) % 180,
    }));
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="setup-confetti-piece"
          style={
            {
              left: `${p.left}%`,
              background: p.bg,
              transform: `rotate(${p.rot}deg)`,
              "--dx": p.dx,
              "--d": p.d,
              "--delay": p.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function RoomPublishedModal({
  roomName,
  publicPath,
  listingId,
  onClose,
}: {
  roomName: string;
  publicPath: string | null;
  listingId: string;
  onClose: () => void;
}) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const [copied, setCopied] = useState(false);
  const displayUrl = publicPath
    ? `${origin}${publicPath}`.replace(/^https?:\/\//, "")
    : "";

  function copy() {
    if (!publicPath) return;
    navigator.clipboard?.writeText(`${origin}${publicPath}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-card bg-white p-7 text-center shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent text-brand-primary">
          <PartyPopper className="h-8 w-8" />
        </div>
        <h3 className="mt-4 font-display text-2xl font-bold text-brand-ink">
          Room published! 🎉
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-brand-mute">
          <span className="font-semibold text-brand-ink">{roomName}</span> is
          saved and bookable.{" "}
          {publicPath
            ? "Here's its public page — share it to take direct bookings."
            : "Publish the listing to make its public page shareable."}
        </p>

        {publicPath ? (
          <button
            type="button"
            onClick={copy}
            title="Click to copy"
            className="mt-4 flex w-full items-center gap-2 rounded border border-brand-line bg-brand-light/60 px-3 py-2.5 text-left font-mono text-xs text-brand-ink transition hover:border-brand-primary/50"
          >
            <Link2 className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
            <span className="flex-1 truncate">{displayUrl || publicPath}</span>
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-brand-mute">
              {copied ? "Copied" : <Copy className="h-3 w-3" />}
            </span>
          </button>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            href={`/dashboard/listings/${listingId}/edit?tab=rooms`}
            className="rounded border border-brand-line bg-white px-4 py-2.5 text-sm font-medium text-brand-ink transition hover:bg-brand-light"
          >
            All rooms
          </Link>
          {publicPath ? (
            <a
              href={publicPath}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
            >
              <ExternalLink className="h-4 w-4" /> View room
            </a>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
