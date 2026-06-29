"use client";

import { ArrowUpRight, Compass, Globe } from "lucide-react";
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

import { setWebsiteChannelAction } from "../actions";
import type { ListingEditorData } from "../editorData";

/**
 * W12 — Per-property Channels control. Two independent publication channels for
 * the same Property: the public **Directory** listing (`is_published`) and the
 * business's **Website** (membership on `website_properties`). Neither touches
 * the booking engine — both deep-link the same checkout, which re-prices
 * server-side.
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
  const { website } = channels;
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
      {/* ── Directory channel ── */}
      <ChannelCard
        icon={<Compass className="h-5 w-5" />}
        title="Wielo Directory"
        description="The public Wielo directory listing at /property/your-place — discoverable, bookable directly."
        on={isPublished}
        pending={publishPending}
        onToggle={onToggleDirectory}
        onLabel="Listed"
        offLabel="Not listed"
      >
        {isPublished && slug ? (
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

      {/* ── Website channel ── */}
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
      >
        {!channels.hasBusiness ? (
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
        Directory and Website are independent — a property can appear on one,
        both, or neither. Both channels send guests to the same booking flow, so
        prices and availability always stay in sync.
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
  children?: React.ReactNode;
}) {
  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader className="flex flex-row items-start gap-3.5 space-y-0">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-brand-accent text-brand-secondary">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="font-display text-base font-bold text-brand-dark">
            {title}
          </CardTitle>
          <CardDescription className="mt-0.5 text-brand-mute">
            {description}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-[12px] font-semibold text-brand-ink sm:inline">
            {pending ? "Saving…" : on ? onLabel : offLabel}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={`Toggle ${title}`}
            onClick={onToggle}
            disabled={pending || disabled}
            className={`relative h-5 w-9 shrink-0 rounded-pill transition-colors disabled:opacity-40 ${
              on ? "bg-brand-primary" : "bg-brand-line"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                on ? "left-4" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </CardHeader>
      {children ? <CardContent className="pt-0">{children}</CardContent> : null}
    </Card>
  );
}
