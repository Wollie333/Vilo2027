"use client";

import { ArrowUpRight, CalendarCheck, Compass, Globe } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  setBookingChannelAction,
  setExternalWebsiteUrlAction,
  setWebsiteChannelAction,
} from "../actions";
import type { ListingEditorData } from "../editorData";

/**
 * Per-property Channels control — three independent publication channels for one
 * Property:
 *   1. Booking management — may this property use the internal booking system /
 *      accept direct bookings (`direct_booking_enabled`). Off ⇒ the public
 *      listing offers a quote request + the host's own website link instead of
 *      instant checkout.
 *   2. Wielo Directory — the public directory listing (`is_published`).
 *   3. Your website — the property on the host's own Wielo website
 *      (`website_properties` membership).
 *
 * Each channel is gated by a product/plan entitlement (admin-controlled). When a
 * channel isn't included, its card renders a locked "Coming soon" state — visible
 * but not controllable.
 */
export function ChannelsTab({
  listingId,
  slug,
  isPublished,
  publishPending,
  onToggleDirectory,
  channels,
}: {
  listingId: string;
  slug: string | null;
  isPublished: boolean;
  publishPending: boolean;
  onToggleDirectory: () => void;
  channels: ListingEditorData["channels"];
}) {
  const { booking, directory, website, websiteEntitled } = channels;

  // ── Booking-management channel ──
  const [bookingOn, setBookingOn] = useState(booking.enabled);
  const [bookingPending, startBooking] = useTransition();
  const [externalUrl, setExternalUrl] = useState(
    booking.externalWebsiteUrl ?? "",
  );
  const [urlPending, startUrl] = useTransition();

  function toggleBooking() {
    const next = !bookingOn;
    startBooking(async () => {
      const result = await setBookingChannelAction(listingId, next);
      if (result.ok) {
        setBookingOn(next);
        toast.success(
          next ? "Booking management on" : "Booking management off",
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  function saveExternalUrl() {
    startUrl(async () => {
      const result = await setExternalWebsiteUrlAction(listingId, externalUrl);
      if (result.ok) {
        toast.success("Website link saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  // ── Website channel ──
  const [onWebsite, setOnWebsite] = useState(website?.isVisible ?? false);
  const [websitePending, startWebsite] = useTransition();

  function toggleWebsite() {
    const next = !onWebsite;
    startWebsite(async () => {
      const result = await setWebsiteChannelAction(listingId, next);
      if (result.ok) {
        setOnWebsite(next);
        toast.success(
          next ? "Shown on your website" : "Hidden from your website",
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* ── 1. Booking-management channel ── */}
      <ChannelCard
        icon={<CalendarCheck className="h-5 w-5" />}
        title="Booking management"
        description="Use Wielo's booking system for this property — calendar, direct bookings and the internal booking tools."
        on={bookingOn}
        pending={bookingPending}
        onToggle={toggleBooking}
        onLabel="On"
        offLabel="Off"
        comingSoon={!booking.entitled}
      >
        {!booking.entitled ? (
          <p className="text-[12.5px] text-brand-mute">
            Booking management isn’t part of your plan yet — it’s coming soon.
          </p>
        ) : bookingOn ? (
          <p className="text-[12.5px] text-brand-mute">
            Guests can book this property directly. Turn this off to list it
            without taking direct bookings (quote requests only).
          </p>
        ) : (
          <div className="space-y-2.5">
            <p className="text-[12.5px] text-brand-mute">
              Direct booking is off. On the public listing, guests will{" "}
              <span className="font-medium text-brand-ink">
                request a quote
              </span>{" "}
              and can visit your own website instead of booking instantly.
            </p>
            <div>
              <label
                htmlFor="external-website-url"
                className="mb-1 block text-[12px] font-semibold text-brand-ink"
              >
                Your website link (optional)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="external-website-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://your-site.co.za"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-[9px] border border-brand-line bg-white px-3 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
                />
                <button
                  type="button"
                  onClick={saveExternalUrl}
                  disabled={urlPending}
                  className="h-9 shrink-0 rounded-pill bg-brand-primary px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-40"
                >
                  {urlPending ? "Saving…" : "Save link"}
                </button>
              </div>
              <p className="mt-1 text-[11.5px] text-brand-mute">
                Shown as a “Go to website” button on your directory listing.
              </p>
            </div>
          </div>
        )}
      </ChannelCard>

      {/* ── 2. Wielo Directory channel ── */}
      <ChannelCard
        icon={<Compass className="h-5 w-5" />}
        title="Wielo Directory"
        description="The public Wielo directory listing at /property/your-place — discoverable, bookable directly."
        on={isPublished}
        pending={publishPending}
        onToggle={onToggleDirectory}
        onLabel="Listed"
        offLabel="Not listed"
        comingSoon={!directory.entitled}
      >
        {!directory.entitled ? (
          <p className="text-[12.5px] text-brand-mute">
            Directory listing isn’t part of your plan yet — it’s coming soon.
          </p>
        ) : isPublished && slug ? (
          <Link
            href={`/property/${slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-primary hover:underline"
          >
            View directory page <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <p className="text-[12.5px] text-brand-mute">
            Turn this on to list the property on the Wielo directory. Setup must
            be complete (photos, a room, banking and a refund policy).
          </p>
        )}
      </ChannelCard>

      {/* ── 3. Website channel ── */}
      <ChannelCard
        icon={<Globe className="h-5 w-5" />}
        title="Your website"
        description="Show this property on your business's own branded Wielo website."
        on={onWebsite}
        pending={websitePending}
        onToggle={toggleWebsite}
        onLabel="Shown"
        offLabel="Hidden"
        disabled={!website}
        comingSoon={!websiteEntitled}
      >
        {!websiteEntitled ? (
          <p className="text-[12.5px] text-brand-mute">
            Your own website is coming soon.
          </p>
        ) : !channels.hasBusiness ? (
          <p className="text-[12.5px] text-brand-mute">
            Attach this property to a business (Basic info tab) before it can
            appear on a website.
          </p>
        ) : !website ? (
          <p className="text-[12.5px] text-brand-mute">
            This business doesn’t have a website yet.{" "}
            <Link
              href="/dashboard/website"
              className="font-medium text-brand-primary hover:underline"
            >
              Create one
            </Link>{" "}
            to start showing your properties.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
            <span className="text-brand-mute">
              Site:{" "}
              <span className="font-medium text-brand-ink">
                {website.subdomain}
              </span>{" "}
              <span
                className={`ml-1 rounded-pill px-1.5 py-0.5 text-[10.5px] font-semibold ${
                  website.status === "published"
                    ? "bg-brand-accent text-brand-secondary"
                    : "bg-brand-light text-brand-mute"
                }`}
              >
                {website.status === "published" ? "Published" : "Draft"}
              </span>
            </span>
            <Link
              href={`/dashboard/website/${website.websiteId}/rooms`}
              className="inline-flex items-center gap-1.5 font-medium text-brand-primary hover:underline"
            >
              Manage website properties <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </ChannelCard>

      <p className="px-1 text-[12px] text-brand-mute">
        These channels are independent — a property can use any combination.
        Booking management, the Wielo directory and your website all send guests
        to the same booking flow, so prices and availability stay in sync.
      </p>
    </div>
  );
}

function ChannelCard({
  icon,
  title,
  description,
  on,
  pending,
  onToggle,
  onLabel,
  offLabel,
  disabled = false,
  comingSoon = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  on: boolean;
  pending: boolean;
  onToggle: () => void;
  onLabel: string;
  offLabel: string;
  disabled?: boolean;
  comingSoon?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card
      className={`rounded-card border-brand-line shadow-card ${
        comingSoon ? "opacity-70" : ""
      }`}
    >
      <CardHeader className="flex flex-row items-start gap-3.5 space-y-0">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-brand-accent text-brand-secondary">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-brand-dark">
            {title}
            {comingSoon ? (
              <span className="rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-mute">
                Coming soon
              </span>
            ) : null}
          </CardTitle>
          <CardDescription className="mt-0.5 text-brand-mute">
            {description}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!comingSoon ? (
            <span className="hidden text-[12px] font-semibold text-brand-ink sm:inline">
              {pending ? "Saving…" : on ? onLabel : offLabel}
            </span>
          ) : null}
          <button
            type="button"
            role="switch"
            aria-checked={comingSoon ? false : on}
            aria-label={`Toggle ${title}`}
            onClick={onToggle}
            disabled={pending || disabled || comingSoon}
            className={`relative h-5 w-9 shrink-0 rounded-pill transition-colors disabled:opacity-40 ${
              on && !comingSoon ? "bg-brand-primary" : "bg-brand-line"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                on && !comingSoon ? "left-4" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </CardHeader>
      {children ? <CardContent className="pt-0">{children}</CardContent> : null}
    </Card>
  );
}
