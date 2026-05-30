"use client";

import {
  AlertTriangle,
  CalendarRange,
  ChevronDown,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { modal } from "@/components/ui/modal-host";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  createSeasonalRuleAction,
  deleteSeasonalRuleAction,
  toggleSeasonalRuleActiveAction,
  updateSeasonalRuleAction,
} from "./actions";
import { nightsBetween, rangesOverlap } from "./schemas";

export type ListingRoom = {
  id: string;
  name: string;
  basePrice: number;
  weekendPrice: number | null;
  currency: string;
  isActive: boolean;
};

export type ListingGroup = {
  id: string;
  name: string;
  slug: string | null;
  bookingMode: "whole_listing" | "rooms_only" | "flexible";
  basePrice: number | null;
  weekendPrice: number | null;
  currency: string;
  minNights: number;
  rooms: ListingRoom[];
};

export type SeasonalRule = {
  id: string;
  listingId: string;
  roomId: string | null;
  label: string;
  startDate: string;
  endDate: string;
  price: number;
  currency: string;
  minNights: number | null;
  priority: number;
  isActive: boolean;
};

type EditTarget =
  | { mode: "create"; listingId?: string; roomId?: string | null }
  | { mode: "edit"; rule: SeasonalRule };

function formatZAR(amount: number): string {
  return `R ${Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

function formatDateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const sameYear =
    start.slice(0, 4) === end.slice(0, 4) &&
    start.slice(0, 4) === String(new Date().getUTCFullYear());
  const s = new Date(`${start}T00:00:00Z`).toLocaleDateString("en-ZA", opts);
  const e = new Date(`${end}T00:00:00Z`).toLocaleDateString("en-ZA", {
    ...opts,
    year: sameYear ? undefined : "numeric",
  });
  return `${s} – ${e}`;
}

export function SeasonalPricingManager({
  listings,
  initialRules,
}: {
  listings: ListingGroup[];
  initialRules: SeasonalRule[];
}) {
  const [rules, setRules] = useState<SeasonalRule[]>(initialRules);
  const [target, setTarget] = useState<EditTarget | null>(null);

  const rulesByListing = useMemo(() => {
    const map = new Map<string, SeasonalRule[]>();
    for (const r of rules) {
      const arr = map.get(r.listingId) ?? [];
      arr.push(r);
      map.set(r.listingId, arr);
    }
    return map;
  }, [rules]);

  function applyCreated(rule: SeasonalRule) {
    setRules((prev) => [...prev, rule]);
  }
  function applyUpdated(rule: SeasonalRule) {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? rule : r)));
  }
  function applyDeleted(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-brand-mute">
          <span className="font-display text-lg font-bold text-brand-ink">
            {rules.length}
          </span>{" "}
          rule{rules.length === 1 ? "" : "s"} across {listings.length} listing
          {listings.length === 1 ? "" : "s"}
        </div>
        <Button
          type="button"
          onClick={() => setTarget({ mode: "create" })}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          New rule
        </Button>
      </div>

      <div className="space-y-6">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            rules={rulesByListing.get(listing.id) ?? []}
            onEdit={(rule) => setTarget({ mode: "edit", rule })}
            onCreateInListing={() =>
              setTarget({ mode: "create", listingId: listing.id, roomId: null })
            }
            onCreateInRoom={(roomId) =>
              setTarget({ mode: "create", listingId: listing.id, roomId })
            }
            onUpdated={applyUpdated}
            onDeleted={applyDeleted}
          />
        ))}
      </div>

      {target ? (
        <RuleDialog
          listings={listings}
          target={target}
          existingRules={rules}
          onClose={() => setTarget(null)}
          onCreated={applyCreated}
          onUpdated={applyUpdated}
        />
      ) : null}
    </>
  );
}

function ListingCard({
  listing,
  rules,
  onEdit,
  onCreateInListing,
  onCreateInRoom,
  onUpdated,
  onDeleted,
}: {
  listing: ListingGroup;
  rules: SeasonalRule[];
  onEdit: (rule: SeasonalRule) => void;
  onCreateInListing: () => void;
  onCreateInRoom: (roomId: string) => void;
  onUpdated: (rule: SeasonalRule) => void;
  onDeleted: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);

  const listingWide = rules
    .filter((r) => r.roomId === null)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const roomBuckets = new Map<string, SeasonalRule[]>();
  for (const r of rules) {
    if (r.roomId !== null) {
      const arr = roomBuckets.get(r.roomId) ?? [];
      arr.push(r);
      roomBuckets.set(r.roomId, arr);
    }
  }
  for (const list of roomBuckets.values()) {
    list.sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  const canPerRoom = listing.bookingMode !== "whole_listing";
  const baseLabel =
    listing.basePrice != null
      ? `${formatZAR(listing.basePrice)} / night`
      : "No base price set";

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader className="space-y-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-start justify-between gap-3 text-left"
          aria-expanded={open}
        >
          <div className="min-w-0 flex-1">
            <CardTitle className="font-display text-lg font-bold text-brand-ink">
              {listing.name}
            </CardTitle>
            <CardDescription className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[10px]">
                {listing.bookingMode === "whole_listing"
                  ? "Whole listing"
                  : listing.bookingMode === "rooms_only"
                    ? "Rooms only"
                    : "Flexible"}
              </Badge>
              <span className="text-brand-mute">{baseLabel}</span>
              <span className="text-brand-mute">
                · min {listing.minNights} night
                {listing.minNights === 1 ? "" : "s"}
              </span>
              <span className="text-brand-mute">
                · {rules.length} rule{rules.length === 1 ? "" : "s"}
              </span>
            </CardDescription>
          </div>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-brand-mute transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </CardHeader>

      {open ? (
        <CardContent className="space-y-5">
          <Section
            title="Listing-wide"
            hint="Applies to every booking of this listing unless a more specific room rule overrides it."
            onAdd={onCreateInListing}
          >
            {listingWide.length === 0 ? (
              <EmptyRow text="No listing-wide rules yet." />
            ) : (
              <div className="space-y-2">
                {listingWide.map((r) => (
                  <RuleRow
                    key={r.id}
                    rule={r}
                    onEdit={() => onEdit(r)}
                    onUpdated={onUpdated}
                    onDeleted={onDeleted}
                  />
                ))}
              </div>
            )}
          </Section>

          {canPerRoom && listing.rooms.length > 0 ? (
            <div className="space-y-4">
              {listing.rooms.map((room) => {
                const roomRules = roomBuckets.get(room.id) ?? [];
                return (
                  <Section
                    key={room.id}
                    title={`Per room — ${room.name}`}
                    hint={`Base ${formatZAR(room.basePrice)} / night.`}
                    onAdd={() => onCreateInRoom(room.id)}
                  >
                    {roomRules.length === 0 ? (
                      <EmptyRow text="No rules for this room yet." />
                    ) : (
                      <div className="space-y-2">
                        {roomRules.map((r) => (
                          <RuleRow
                            key={r.id}
                            rule={r}
                            onEdit={() => onEdit(r)}
                            onUpdated={onUpdated}
                            onDeleted={onDeleted}
                          />
                        ))}
                      </div>
                    )}
                  </Section>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

function Section({
  title,
  hint,
  onAdd,
  children,
}: {
  title: string;
  hint: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            {title}
          </div>
          <div className="text-xs text-brand-mute">{hint}</div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add rule
        </Button>
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded border border-dashed border-brand-line bg-brand-light/40 px-3 py-3 text-center text-xs text-brand-mute">
      {text}
    </div>
  );
}

function RuleRow({
  rule,
  onEdit,
  onUpdated,
  onDeleted,
}: {
  rule: SeasonalRule;
  onEdit: () => void;
  onUpdated: (rule: SeasonalRule) => void;
  onDeleted: (id: string) => void;
}) {
  const [togglePending, startToggle] = useTransition();
  const [deletePending, startDelete] = useTransition();

  function toggleActive() {
    const next = !rule.isActive;
    startToggle(async () => {
      const result = await toggleSeasonalRuleActiveAction(rule.id, next);
      if (result.ok) {
        onUpdated({ ...rule, isActive: next });
      } else {
        toast.error(result.error);
      }
    });
  }

  async function remove() {
    const confirmed = await modal.destructive({
      title: `Delete the "${rule.label}" rule?`,
      description: "This removes the seasonal override.",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;
    startDelete(async () => {
      const result = await deleteSeasonalRuleAction(rule.id);
      if (result.ok) {
        onDeleted(rule.id);
        toast.success("Rule deleted");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-card border border-brand-line bg-white px-3 py-2.5 ${
        !rule.isActive ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-brand-ink">
            {rule.label}
          </span>
          {rule.priority > 0 ? (
            <Badge variant="outline" className="text-[10px]">
              Priority {rule.priority}
            </Badge>
          ) : null}
          {!rule.isActive ? (
            <Badge variant="outline" className="text-[10px] text-brand-mute">
              Inactive
            </Badge>
          ) : null}
        </div>
        <div className="text-xs text-brand-mute">
          {formatDateRange(rule.startDate, rule.endDate)} ·{" "}
          {formatZAR(rule.price)} / night
          {rule.minNights ? ` · min ${rule.minNights} nights` : ""}
        </div>
      </div>
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-brand-dark">
        <input
          type="checkbox"
          checked={rule.isActive}
          onChange={toggleActive}
          disabled={togglePending}
          className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
        />
        Active
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onEdit}
        className="gap-1.5"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={remove}
        disabled={deletePending}
        className="gap-1.5 text-status-cancelled hover:bg-red-50 hover:text-status-cancelled"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {deletePending ? "…" : "Delete"}
      </Button>
    </div>
  );
}

function RuleDialog({
  listings,
  target,
  existingRules,
  onClose,
  onCreated,
  onUpdated,
}: {
  listings: ListingGroup[];
  target: EditTarget;
  existingRules: SeasonalRule[];
  onClose: () => void;
  onCreated: (rule: SeasonalRule) => void;
  onUpdated: (rule: SeasonalRule) => void;
}) {
  const initial =
    target.mode === "edit"
      ? target.rule
      : {
          listingId: target.listingId ?? listings[0]?.id ?? "",
          roomId: target.roomId ?? null,
          label: "",
          startDate: "",
          endDate: "",
          price: 0,
          currency: "ZAR",
          minNights: null as number | null,
          priority: 0,
          isActive: true,
        };

  const [listingId, setListingId] = useState(initial.listingId);
  const [roomId, setRoomId] = useState<string | null>(initial.roomId);
  const [label, setLabel] = useState(initial.label);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [price, setPrice] = useState(String(initial.price || ""));
  const [minNights, setMinNights] = useState(
    initial.minNights == null ? "" : String(initial.minNights),
  );
  const [priority, setPriority] = useState(String(initial.priority));
  const [isActive, setIsActive] = useState(initial.isActive);
  const [pending, start] = useTransition();

  const listing = listings.find((l) => l.id === listingId);
  const canPerRoom = listing?.bookingMode !== "whole_listing";

  const overlaps = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return [];
    return existingRules.filter(
      (r) =>
        r.listingId === listingId &&
        r.roomId === roomId &&
        r.isActive &&
        (target.mode === "create" || r.id !== target.rule.id) &&
        rangesOverlap(startDate, endDate, r.startDate, r.endDate),
    );
  }, [existingRules, listingId, roomId, startDate, endDate, target]);

  const nights = nightsBetween(startDate, endDate);
  const priceNum = Number(price) || 0;
  const total = nights * priceNum;

  function submit() {
    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error("Price must be greater than 0.");
      return;
    }
    const parsedMin =
      minNights.trim() === "" ? null : Number.parseInt(minNights, 10);
    if (parsedMin != null && (!Number.isFinite(parsedMin) || parsedMin < 1)) {
      toast.error("Min nights must be 1 or more.");
      return;
    }
    const parsedPriority = Number.parseInt(priority, 10);
    if (!Number.isFinite(parsedPriority) || parsedPriority < 0) {
      toast.error("Priority must be 0 or more.");
      return;
    }

    const payload = {
      listing_id: listingId,
      room_id: roomId,
      label: label.trim(),
      start_date: startDate,
      end_date: endDate,
      price: parsedPrice,
      currency: "ZAR",
      min_nights: parsedMin,
      priority: parsedPriority,
      is_active: isActive,
    };

    start(async () => {
      if (target.mode === "create") {
        const result = await createSeasonalRuleAction(payload);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        onCreated({
          id: result.data!.id,
          listingId,
          roomId,
          label: payload.label,
          startDate,
          endDate,
          price: parsedPrice,
          currency: "ZAR",
          minNights: parsedMin,
          priority: parsedPriority,
          isActive,
        });
        toast.success("Rule created");
      } else {
        const result = await updateSeasonalRuleAction(target.rule.id, payload);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        onUpdated({
          id: target.rule.id,
          listingId,
          roomId,
          label: payload.label,
          startDate,
          endDate,
          price: parsedPrice,
          currency: "ZAR",
          minNights: parsedMin,
          priority: parsedPriority,
          isActive,
        });
        toast.success("Rule saved");
      }
      onClose();
    });
  }

  return (
    <FormModal
      open
      onOpenChange={(o) => !o && onClose()}
      title={target.mode === "create" ? "New seasonal rule" : "Edit rule"}
      description="Override the nightly rate for a date range. Most-specific wins: room rules beat listing rules, then highest priority wins on overlap."
    >
      <div className="space-y-4">
        <Field label="Listing">
          <Select
            value={listingId}
            onValueChange={(v) => {
              setListingId(v);
              setRoomId(null);
            }}
            disabled={target.mode === "edit"}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select listing" />
            </SelectTrigger>
            <SelectContent>
              {listings.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Apply to">
          <Select
            value={roomId ?? "__listing__"}
            onValueChange={(v) => setRoomId(v === "__listing__" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__listing__">
                This listing (all rooms)
              </SelectItem>
              {canPerRoom &&
                listing?.rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Label">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="December holidays, Easter, Winter sale…"
            maxLength={80}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start date">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="End date (inclusive)">
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Price / night (ZAR)">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          <Field label="Min nights (optional)">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="Inherit"
              value={minNights}
              onChange={(e) => setMinNights(e.target.value)}
            />
          </Field>
          <Field label="Priority">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </Field>
        </div>

        <p className="text-[11px] text-brand-mute">
          Priority decides which rule wins when two cover the same date. Layer a
          short peak (e.g. Christmas week, priority 10) over a longer season
          (December, priority 1).
        </p>

        <label className="flex items-center gap-2 text-sm text-brand-dark">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
          />
          Active (counts toward booking prices)
        </label>

        {nights > 0 && priceNum > 0 ? (
          <div className="rounded border border-brand-line bg-brand-light/40 px-3 py-2 text-xs text-brand-dark">
            <CalendarRange className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
            {formatZAR(priceNum)} × {nights} night
            {nights === 1 ? "" : "s"} ={" "}
            <strong className="font-semibold">{formatZAR(total)}</strong>
          </div>
        ) : null}

        {overlaps.length > 0 ? (
          <div className="flex gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              Overlaps with{" "}
              {overlaps
                .map(
                  (r) =>
                    `"${r.label}" (${formatDateRange(r.startDate, r.endDate)}, priority ${r.priority})`,
                )
                .join(", ")}
              . The higher-priority rule will apply on shared dates.
            </div>
          </div>
        ) : null}
      </div>

      <FormModalFooter>
        <FormModalCancel disabled={pending}>Cancel</FormModalCancel>
        <Button
          type="button"
          onClick={submit}
          disabled={
            pending ||
            !listingId ||
            !label.trim() ||
            !startDate ||
            !endDate ||
            !price
          }
        >
          {pending
            ? "Saving…"
            : target.mode === "create"
              ? "Create rule"
              : "Save rule"}
        </Button>
      </FormModalFooter>
    </FormModal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </Label>
      {children}
    </div>
  );
}
