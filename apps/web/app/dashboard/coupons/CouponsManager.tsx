"use client";

import { useMemo, useState, useTransition } from "react";

import { Pencil, Plus, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { modal } from "@/components/ui/modal-host";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  createCouponAction,
  deleteCouponAction,
  toggleCouponActiveAction,
  updateCouponAction,
} from "./actions";
import { COUPON_SCOPES, type CouponScope } from "./schemas";

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

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function discountLabel(c: CouponRow): string {
  return c.discountType === "percent"
    ? `${c.discountValue}% off`
    : `${fmtR(c.discountValue, c.currency)} off`;
}

type EditTarget = { mode: "create" } | { mode: "edit"; coupon: CouponRow };

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
  const [target, setTarget] = useState<EditTarget | null>(null);

  function applyUpserted(c: CouponRow) {
    setCoupons((prev) => {
      const i = prev.findIndex((x) => x.id === c.id);
      if (i === -1) return [c, ...prev];
      const next = [...prev];
      next[i] = c;
      return next;
    });
  }

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
        <Button onClick={() => setTarget({ mode: "create" })}>
          <Plus className="mr-1.5 h-4 w-4" /> New coupon
        </Button>
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
          <Button
            className="mt-4"
            onClick={() => setTarget({ mode: "create" })}
          >
            <Plus className="mr-1.5 h-4 w-4" /> New coupon
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {coupons.map((c) => (
            <CouponCard
              key={c.id}
              coupon={c}
              listings={listings}
              addons={addons}
              onEdit={() => setTarget({ mode: "edit", coupon: c })}
              onChanged={applyUpserted}
              onDeleted={(id) =>
                setCoupons((prev) => prev.filter((x) => x.id !== id))
              }
            />
          ))}
        </div>
      )}

      {target ? (
        <CouponDialog
          listings={listings}
          addons={addons}
          target={target}
          onClose={() => setTarget(null)}
          onSaved={applyUpserted}
        />
      ) : null}
    </div>
  );
}

function CouponCard({
  coupon,
  listings,
  addons,
  onEdit,
  onChanged,
  onDeleted,
}: {
  coupon: CouponRow;
  listings: CouponListing[];
  addons: CouponAddon[];
  onEdit: () => void;
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

  function toggle() {
    start(async () => {
      const res = await toggleCouponActiveAction(coupon.id, !coupon.isActive);
      if (res.ok) {
        onChanged({ ...coupon, isActive: !coupon.isActive });
      } else toast.error(res.error);
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
            <span className="font-display text-base font-bold tracking-wide text-brand-ink">
              {coupon.code}
            </span>
            <span
              className={`rounded-pill px-2 py-0.5 text-[10px] font-bold ${
                coupon.isActive
                  ? "bg-status-confirmed/10 text-status-confirmed"
                  : "bg-brand-light text-brand-mute"
              }`}
            >
              {coupon.isActive ? "Active" : "Off"}
            </span>
          </div>
          {coupon.description ? (
            <p className="mt-0.5 truncate text-xs text-brand-mute">
              {coupon.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit coupon"
            className="rounded p-1.5 text-brand-mute hover:bg-brand-light hover:text-brand-ink"
          >
            <Pencil className="h-4 w-4" />
          </button>
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11px] text-brand-mute">{hint}</p> : null}
    </div>
  );
}

function CouponDialog({
  listings,
  addons,
  target,
  onClose,
  onSaved,
}: {
  listings: CouponListing[];
  addons: CouponAddon[];
  target: EditTarget;
  onClose: () => void;
  onSaved: (c: CouponRow) => void;
}) {
  const initial =
    target.mode === "edit"
      ? target.coupon
      : {
          id: "",
          code: "",
          description: null as string | null,
          discountType: "percent" as "percent" | "fixed",
          discountValue: 10,
          scope: "order" as CouponScope,
          listingId: null as string | null,
          roomId: null as string | null,
          addonId: null as string | null,
          currency: listings[0]?.currency ?? "ZAR",
          minNights: null as number | null,
          minSpend: null as number | null,
          startsAt: null as string | null,
          endsAt: null as string | null,
          maxRedemptions: null as number | null,
          perGuestLimit: null as number | null,
          redeemedCount: 0,
          isActive: true,
        };

  const dateOnly = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

  const [code, setCode] = useState(initial.code);
  const [description, setDescription] = useState(initial.description ?? "");
  const [discountType, setDiscountType] = useState(initial.discountType);
  const [discountValue, setDiscountValue] = useState(
    String(initial.discountValue || ""),
  );
  const [scope, setScope] = useState<CouponScope>(initial.scope);
  const [listingId, setListingId] = useState<string | null>(initial.listingId);
  const [roomId, setRoomId] = useState<string | null>(initial.roomId);
  const [addonId, setAddonId] = useState<string | null>(initial.addonId);
  const [minNights, setMinNights] = useState(
    initial.minNights == null ? "" : String(initial.minNights),
  );
  const [minSpend, setMinSpend] = useState(
    initial.minSpend == null ? "" : String(initial.minSpend),
  );
  const [startsAt, setStartsAt] = useState(dateOnly(initial.startsAt));
  const [endsAt, setEndsAt] = useState(dateOnly(initial.endsAt));
  const [maxRedemptions, setMaxRedemptions] = useState(
    initial.maxRedemptions == null ? "" : String(initial.maxRedemptions),
  );
  const [perGuestLimit, setPerGuestLimit] = useState(
    initial.perGuestLimit == null ? "" : String(initial.perGuestLimit),
  );
  const [isActive, setIsActive] = useState(initial.isActive);
  const [pending, start] = useTransition();

  const listing = useMemo(
    () => listings.find((l) => l.id === listingId),
    [listings, listingId],
  );
  const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

  function submit() {
    const payload = {
      code: code.trim(),
      description: description.trim() || null,
      discount_type: discountType,
      discount_value: Number(discountValue),
      scope,
      listing_id: listingId,
      room_id: scope === "accommodation" ? roomId : null,
      addon_id: scope === "addons" ? addonId : null,
      min_nights: numOrNull(minNights),
      min_spend: numOrNull(minSpend),
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      max_redemptions: numOrNull(maxRedemptions),
      per_guest_limit: numOrNull(perGuestLimit),
      is_active: isActive,
    };

    start(async () => {
      const merged = (id: string): CouponRow => ({
        id,
        code: payload.code.toUpperCase(),
        description: payload.description,
        discountType,
        discountValue: payload.discount_value,
        scope,
        listingId,
        roomId: payload.room_id,
        addonId: payload.addon_id,
        currency: listing?.currency ?? "ZAR",
        minNights: payload.min_nights,
        minSpend: payload.min_spend,
        startsAt: payload.starts_at ? `${payload.starts_at}T00:00:00Z` : null,
        endsAt: payload.ends_at ? `${payload.ends_at}T23:59:59Z` : null,
        maxRedemptions: payload.max_redemptions,
        perGuestLimit: payload.per_guest_limit,
        redeemedCount: target.mode === "edit" ? target.coupon.redeemedCount : 0,
        isActive,
      });

      if (target.mode === "create") {
        const res = await createCouponAction(payload);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        onSaved(merged(res.data!.id));
        toast.success("Coupon created");
      } else {
        const res = await updateCouponAction(target.coupon.id, payload);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        onSaved(merged(target.coupon.id));
        toast.success("Coupon saved");
      }
      onClose();
    });
  }

  return (
    <FormModal
      open
      onOpenChange={(o) => !o && onClose()}
      title={target.mode === "create" ? "New coupon" : "Edit coupon"}
      description="Guests enter the code at checkout. The server re-validates every redemption."
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code" hint="Letters, numbers, - and _">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WELCOME10"
              maxLength={40}
            />
          </Field>
          <Field label="Internal description (optional)">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Returning guests"
              maxLength={200}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Discount type">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDiscountType("percent")}
                className={`flex-1 rounded-card border px-3 py-2 text-sm font-medium ${
                  discountType === "percent"
                    ? "border-brand-primary bg-brand-accent text-brand-primary"
                    : "border-brand-line text-brand-mute hover:bg-brand-light"
                }`}
              >
                % off
              </button>
              <button
                type="button"
                onClick={() => setDiscountType("fixed")}
                className={`flex-1 rounded-card border px-3 py-2 text-sm font-medium ${
                  discountType === "fixed"
                    ? "border-brand-primary bg-brand-accent text-brand-primary"
                    : "border-brand-line text-brand-mute hover:bg-brand-light"
                }`}
              >
                Amount off
              </button>
            </div>
          </Field>
          <Field
            label={discountType === "percent" ? "Percentage" : "Amount (ZAR)"}
          >
            <Input
              type="number"
              inputMode="decimal"
              step={discountType === "percent" ? "1" : "0.01"}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Applies to">
          <Select
            value={scope}
            onValueChange={(v) => {
              setScope(v as CouponScope);
              if (v !== "accommodation") setRoomId(null);
              if (v !== "addons") setAddonId(null);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUPON_SCOPES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Listing (optional)">
            <Select
              value={listingId ?? "__all__"}
              onValueChange={(v) => {
                setListingId(v === "__all__" ? null : v);
                setRoomId(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All my listings</SelectItem>
                {listings.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {scope === "accommodation" && listing && listing.rooms.length > 0 ? (
            <Field label="Room (optional)">
              <Select
                value={roomId ?? "__any__"}
                onValueChange={(v) => setRoomId(v === "__any__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Any room</SelectItem>
                  {listing.rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {scope === "addons" && addons.length > 0 ? (
            <Field label="Add-on (optional)">
              <Select
                value={addonId ?? "__any__"}
                onValueChange={(v) => setAddonId(v === "__any__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Any add-on</SelectItem>
                  {addons.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Valid from (optional)">
            <Input
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </Field>
          <Field label="Valid until (optional)">
            <Input
              type="date"
              value={endsAt}
              min={startsAt || undefined}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Min nights (optional)">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={minNights}
              onChange={(e) => setMinNights(e.target.value)}
            />
          </Field>
          <Field label="Min spend (optional)">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={minSpend}
              onChange={(e) => setMinSpend(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Max total redemptions (optional)">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="Unlimited"
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
            />
          </Field>
          <Field label="Per-guest limit (optional)">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="Unlimited"
              value={perGuestLimit}
              onChange={(e) => setPerGuestLimit(e.target.value)}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-brand-dark">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
          />
          Active (guests can redeem now)
        </label>
      </div>

      <FormModalFooter>
        <FormModalCancel disabled={pending}>Cancel</FormModalCancel>
        <Button
          type="button"
          onClick={submit}
          disabled={pending || code.trim().length < 2 || !discountValue}
        >
          {pending
            ? "Saving…"
            : target.mode === "create"
              ? "Create coupon"
              : "Save coupon"}
        </Button>
      </FormModalFooter>
    </FormModal>
  );
}
