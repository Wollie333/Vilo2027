"use client";

import {
  BadgeCheck,
  ImageIcon,
  ListChecks,
  Lock,
  MapPin,
  Monitor,
  Rocket,
  ShieldCheck,
  Smartphone,
  Star,
} from "lucide-react";
import { useState } from "react";

import { useBrandName } from "@/components/brand/BrandProvider";

import type {
  Host,
  Listing,
  Photo,
  Profile,
  Room,
  SetupStepKey,
} from "./types";

function rand(n: number): string {
  return `R ${Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

// The public listing page, condensed but faithful, driven by the draft data.
function ListingPaper({
  host,
  profile,
  listing,
  photos,
  rooms,
  mobile,
}: {
  host: Host;
  profile: Profile;
  listing: Listing;
  photos: Photo[];
  rooms: Room[];
  mobile: boolean;
}) {
  const brandName = useBrandName();
  const cover = photos[0];
  const rest = photos.slice(1, 5);
  const rate = listing.base_price ?? 0;
  const cleaning = listing.cleaning_fee ?? 0;
  const typeLabel = listing.accommodation_type ?? listing.property_type;
  const firstName = (profile.full_name || host.display_name || "Host").split(
    " ",
  )[0];

  return (
    <div className="bg-white text-brand-ink">
      {/* public top nav */}
      <div className="flex items-center gap-3 border-b border-brand-line px-5 py-3">
        <div className="font-display text-[15px] font-bold tracking-tight text-brand-secondary">
          {brandName}
        </div>
        <div className="ml-auto flex items-center gap-2 text-[12px]">
          {!mobile ? <span className="text-brand-mute">Sign in</span> : null}
          <span className="rounded bg-brand-primary px-3 py-1.5 font-medium text-white">
            Join {brandName}
          </span>
        </div>
      </div>

      <div className="px-5 py-5">
        {/* title row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-pill bg-brand-accent px-2 py-0.5 text-[10px] font-semibold text-brand-secondary">
            <BadgeCheck className="h-3 w-3" /> New host
          </span>
          {listing.cancellation_policy ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-semibold capitalize text-brand-secondary">
              <ShieldCheck className="h-3 w-3" /> {listing.cancellation_policy}
            </span>
          ) : null}
        </div>
        <h1
          className={`mt-2 font-display font-bold leading-tight tracking-tight text-brand-ink ${
            mobile ? "text-[22px]" : "text-[30px]"
          }`}
        >
          {listing.name || "Your listing name"}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-brand-mute">
          <span className="inline-flex items-center gap-1 font-medium text-brand-ink">
            <Star className="h-3.5 w-3.5" /> New
          </span>
          <span className="inline-flex items-center gap-1 capitalize">
            <MapPin className="h-3.5 w-3.5" /> {typeLabel}
          </span>
        </div>

        {/* gallery */}
        <div
          className={`mt-4 grid gap-2 overflow-hidden rounded-card ${
            mobile ? "grid-cols-1" : "grid-cols-4 grid-rows-2"
          }`}
          style={{ height: mobile ? 220 : 340 }}
        >
          {cover ? (
            <div
              className={`relative overflow-hidden bg-brand-accent ${mobile ? "" : "col-span-2 row-span-2"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover.url}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div
              className={`flex items-center justify-center bg-brand-light text-[11px] text-brand-mute ${mobile ? "" : "col-span-2 row-span-2"}`}
            >
              <ImageIcon className="mr-1 h-4 w-4" /> add a cover photo
            </div>
          )}
          {!mobile
            ? [0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="relative overflow-hidden bg-brand-accent"
                >
                  {rest[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={rest[i].url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-brand-light text-[10px] text-brand-mute">
                      photo
                    </div>
                  )}
                </div>
              ))
            : null}
        </div>

        {/* two-col */}
        <div
          className={`mt-5 grid gap-6 ${mobile ? "grid-cols-1" : "grid-cols-12"}`}
        >
          <div className={mobile ? "" : "col-span-7"}>
            {/* host strip */}
            <div className="flex items-center gap-3 border-b border-brand-line pb-4">
              {host.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={host.avatar_url}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-brand-accent" />
              )}
              <div>
                <div className="font-display text-[15px] font-bold capitalize leading-tight">
                  {typeLabel} hosted by {firstName}
                </div>
                <div className="num mt-0.5 text-[12px] text-brand-mute">
                  {listing.max_guests ?? "—"} guests · {listing.bedrooms ?? 0}{" "}
                  bedrooms · {listing.bathrooms ?? 0} baths
                </div>
              </div>
            </div>

            {/* about */}
            <div className="border-b border-brand-line py-4">
              <div className="font-display text-[15px] font-bold">
                About this place
              </div>
              {listing.description ? (
                <div
                  className="mt-2 text-[13px] leading-relaxed text-brand-ink/85 [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5"
                  // Sanitised on save (saveListingPatchAction → sanitiseListingHtml).
                  dangerouslySetInnerHTML={{ __html: listing.description }}
                />
              ) : (
                <p className="mt-2 text-[12px] text-brand-mute">
                  Add a description so guests know what to expect.
                </p>
              )}
            </div>

            {/* rooms */}
            {rooms.filter((r) => r.is_active).length > 0 ? (
              <div className="py-4">
                <div className="font-display text-[15px] font-bold">Rooms</div>
                <div className="mt-3 space-y-2">
                  {rooms
                    .filter((r) => r.is_active)
                    .map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between gap-2 text-[13px]"
                      >
                        <span className="text-brand-ink">{r.name}</span>
                        <span className="num text-brand-mute">
                          sleeps {r.max_guests ?? "—"} ·{" "}
                          {r.base_price ? rand(r.base_price) : "—"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* booking card */}
          <div className={mobile ? "" : "col-span-5"}>
            <div
              className={`rounded-card border border-brand-line bg-white p-4 shadow-lift ${mobile ? "" : "sticky top-4"}`}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="num font-display text-2xl font-bold text-brand-ink">
                  {rand(rate)}
                </span>
                <span className="text-[13px] text-brand-mute">/ night</span>
              </div>
              <button className="mt-3 w-full rounded bg-brand-primary py-2.5 text-[13px] font-semibold text-white">
                Request to book
              </button>
              <div className="mt-3 space-y-1.5 text-[12px] text-brand-mute">
                <div className="flex items-center justify-between">
                  <span>Cleaning fee</span>
                  <span className="num">{rand(cleaning)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-brand-line pt-2 font-semibold text-brand-ink">
                  <span>Per night + cleaning</span>
                  <span className="num">{rand(rate + cleaning)}</span>
                </div>
              </div>
              {listing.cancellation_policy ? (
                <div className="mt-3 flex items-center gap-1.5 text-[11px] capitalize text-brand-mute">
                  <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" />
                  {listing.cancellation_policy} cancellation · 0% guest fee
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SetupPreview({
  host,
  profile,
  listing,
  photos,
  rooms,
  ready,
  publishing,
  missing,
  onPublish,
  onJump,
}: {
  host: Host;
  profile: Profile;
  listing: Listing;
  photos: Photo[];
  rooms: Room[];
  ready: boolean;
  publishing: boolean;
  missing: { key: SetupStepKey; label: string }[];
  onPublish: () => void;
  onJump: (key: SetupStepKey) => void;
}) {
  const brandName = useBrandName();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const mobile = device === "mobile";
  const slug = (listing.name || "listing")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="-mt-1 max-w-xl text-sm text-brand-mute">
          This is exactly what guests will see. It updates live as you edit the
          steps above — review it, then publish when you&rsquo;re happy.
        </p>
        <div className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-white p-1">
          {(
            [
              { id: "desktop", icon: Monitor, label: "Desktop" },
              { id: "mobile", icon: Smartphone, label: "Mobile" },
            ] as const
          ).map((d) => {
            const Icon = d.icon;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDevice(d.id)}
                className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-semibold transition ${
                  device === d.id
                    ? "bg-brand-primary text-white"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Browser frame */}
      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-peek">
        <div className="flex items-center gap-2 border-b border-brand-line bg-brand-light/70 px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
          <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-pill border border-brand-line bg-white px-3 py-1 text-[11px] text-brand-mute">
            <Lock className="h-3 w-3 text-brand-primary" />
            <span className="truncate font-mono">
              viloplatform.com/{host.handle}/{slug}
            </span>
            <span className="ml-auto rounded-pill bg-brand-light px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-mute">
              Preview
            </span>
          </div>
        </div>
        <div className="bg-brand-light/40 p-4">
          <div
            className={`mx-auto overflow-hidden rounded-card border border-brand-line bg-white shadow-card transition-all duration-300 ${
              mobile ? "max-w-[400px]" : "max-w-full"
            }`}
          >
            <ListingPaper
              host={host}
              profile={profile}
              listing={listing}
              photos={photos}
              rooms={rooms}
              mobile={mobile}
            />
          </div>
        </div>
      </div>

      {/* Publish bar */}
      <div
        className={`flex flex-col gap-4 rounded-card border p-5 md:flex-row md:items-center ${
          ready
            ? "border-brand-primary/40 bg-brand-accent/40"
            : "border-brand-line bg-white"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-card ${
              ready
                ? "bg-brand-primary text-white"
                : "bg-brand-light text-brand-mute"
            }`}
          >
            {ready ? (
              <Rocket className="h-5 w-5" />
            ) : (
              <ListChecks className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="font-display text-base font-bold text-brand-ink">
              {ready ? "Ready to go live" : "A few things left"}
            </div>
            {ready ? (
              <p className="mt-0.5 text-sm text-brand-mute">
                Publishing makes your listing bookable and lists it in the{" "}
                {brandName}
                directory.
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-brand-mute">
                Finish:{" "}
                {missing.map((m, i) => (
                  <span key={m.key}>
                    <button
                      type="button"
                      onClick={() => onJump(m.key)}
                      className="font-medium text-brand-primary hover:underline"
                    >
                      {m.label}
                    </button>
                    {i < missing.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 md:ml-auto">
          <button
            type="button"
            onClick={onPublish}
            disabled={!ready || publishing}
            className={`inline-flex items-center gap-2 rounded px-5 py-2.5 text-sm font-semibold shadow-card transition-all ${
              ready
                ? "bg-brand-primary text-white hover:bg-brand-secondary hover:shadow-glow"
                : "cursor-not-allowed bg-brand-line text-brand-mute"
            }`}
          >
            <Rocket className="h-4 w-4" />{" "}
            {publishing ? "Publishing…" : "Publish listing"}
          </button>
        </div>
      </div>
    </div>
  );
}
