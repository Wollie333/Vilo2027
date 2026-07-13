"use client";

import { Link } from "@/i18n/navigation";
import { useState, useTransition } from "react";

import { Pencil, Plus, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";
import { modal } from "@/components/ui/modal-host";

import { deleteCouponAction, toggleCouponActiveAction } from "./actions";
import { type CouponScope } from "./schemas";

export type CouponRoom = { id: string; name: string };
export type CouponAddon = { id: string; name: string };
export type CouponListing = {
  id: string;
  name: string;
  currency: string;
  rooms: CouponRoom[];
};

export type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  scope: CouponScope;
  listingId: string | null;
  roomId: string | null;
  addonId: string | null;
  currency: string;
  minNights: number | null;
  minSpend: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  perGuestLimit: number | null;
  redeemedCount: number;
  isActive: boolean;
};

const SCOPE_LABEL: Record<CouponScope, string> = {
  order: "Whole order",
  accommodation: "Accommodation",
  addons: "Add-ons",
};

function discountLabel(c: CouponRow): string {
  return c.discountType === "percent"
    ? `${c.discountValue}% off`
    : `${formatMoney(c.discountValue, c.currency)} off`;
}

/** Live status of a coupon for the card badge. */
function couponStatus(c: CouponRow): {
  label: string;
  tone: "on" | "off" | "scheduled" | "expired" | "used";
} {
  if (!c.isActive) return { label: "Off", tone: "off" };
  const now = new Date().toISOString();
  if (c.startsAt && now < c.startsAt)
    return { label: "Scheduled", tone: "scheduled" };
  if (c.endsAt && now > c.endsAt) return { label: "Expired", tone: "expired" };
  if (c.maxRedemptions != null && c.redeemedCount >= c.maxRedemptions) {
    return { label: "Used up", tone: "used" };
  }
  return { label: "Active", tone: "on" };
}

const STATUS_CLASS: Record<ReturnType<typeof couponStatus>["tone"], string> = {
  on: "bg-status-confirmed/10 text-status-confirmed",
  off: "bg-brand-light text-brand-mute",
  scheduled: "bg-status-pending/10 text-status-pending",
  expired: "bg-status-cancelled/10 text-status-cancelled",
  used: "bg-status-cancelled/10 text-status-cancelled",
};

const NEW_BTN =
  "inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary";

export function CouponsManager({
  listings,
  addons,
  initialCoupons,
}: {
  listings: CouponListing[];
  addons: CouponAddon[];
  initialCoupons: CouponRow[];
}) {
  const [coupons, setCoupons] = useState<CouponRow[]>(initialCoupons);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Coupons
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-mute">
            Create discount codes guests enter at checkout. Target the whole
            order, accommodation, or add-ons — limit them to one listing or
            room, set a validity window, and cap how many times they can be
            used.
          </p>
        </div>
        <Link href="/dashboard/coupons/new" className={NEW_BTN}>
          <Plus className="h-4 w-4" /> New coupon
        </Link>
      </header>

      {coupons.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <Ticket className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-bold text-brand-ink">
            No coupons yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Create your first code — a festive “WELCOME10”, a returning-guest
            discount, or a flash sale.
          </p>
          <Link href="/dashboard/coupons/new" className={`${NEW_BTN} mt-4`}>
            <Plus className="h-4 w-4" /> New coupon
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {coupons.map((c) => (
            <CouponCard
              key={c.id}
              coupon={c}
              listings={listings}
              addons={addons}
              onChanged={(next) =>
                setCoupons((prev) =>
                  prev.map((x) => (x.id === next.id ? next : x)),
                )
              }
              onDeleted={(id) =>
                setCoupons((prev) => prev.filter((x) => x.id !== id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CouponCard({
  coupon,
  listings,
  addons,
  onChanged,
  onDeleted,
}: {
  coupon: CouponRow;
  listings: CouponListing[];
  addons: CouponAddon[];
  onChanged: (c: CouponRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [pending, start] = useTransition();
  const listing = listings.find((l) => l.id === coupon.listingId);
  const room = listing?.rooms.find((r) => r.id === coupon.roomId);
  const addon = addons.find((a) => a.id === coupon.addonId);

  const targetLabel = addon
    ? `Add-on · ${addon.name}`
    : coupon.listingId
      ? `${listing?.name ?? "Listing"}${room ? ` · ${room.name}` : ""}`
      : "All listings";

  const used = coupon.maxRedemptions
    ? `${coupon.redeemedCount}/${coupon.maxRedemptions} used`
    : `${coupon.redeemedCount} used`;

  const status = couponStatus(coupon);

  function toggle() {
    start(async () => {
      const res = await toggleCouponActiveAction(coupon.id, !coupon.isActive);
      if (res.ok) onChanged({ ...coupon, isActive: !coupon.isActive });
      else toast.error(res.error);
    });
  }

  function remove() {
    start(async () => {
      const ok = await modal.destructive({
        title: `Delete “${coupon.code}”?`,
        description: "Guests can no longer redeem this code.",
        confirmLabel: "Delete",
      });
      if (!ok) return;
      const res = await deleteCouponAction(coupon.id);
      if (res.ok) {
        onDeleted(coupon.id);
        toast.success("Coupon deleted");
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold tracking-wide text-brand-ink">
              {coupon.code}
            </span>
            <span
              className={`rounded-pill px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[status.tone]}`}
            >
              {status.label}
            </span>
          </div>
          {coupon.description ? (
            <p className="mt-0.5 truncate text-xs text-brand-mute">
              {coupon.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <Link
            href={`/dashboard/coupons/${coupon.id}/edit`}
            aria-label="Edit coupon"
            className="rounded p-1.5 text-brand-mute hover:bg-brand-light hover:text-brand-ink"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label="Delete coupon"
            className="rounded p-1.5 text-brand-mute hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 font-display text-lg font-bold text-brand-primary">
        {discountLabel(coupon)}
      </div>
      <dl className="mt-2 space-y-1 text-xs text-brand-mute">
        <div className="flex justify-between gap-2">
          <dt>Applies to</dt>
          <dd className="text-brand-dark">{SCOPE_LABEL[coupon.scope]}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Where</dt>
          <dd className="truncate text-brand-dark">{targetLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Redemptions</dt>
          <dd className="text-brand-dark">{used}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="mt-3 text-left text-xs font-medium text-brand-primary hover:underline disabled:opacity-50"
      >
        {coupon.isActive ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}
