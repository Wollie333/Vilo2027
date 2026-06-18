"use client";

import {
  CheckCircle2,
  Globe,
  LayoutGrid,
  Link2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Sparkles,
  Star,
  Store,
  Trash2,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Link, useRouter } from "@/i18n/navigation";
import { Modal } from "@/components/ui/modal";
import { formatMoney } from "@/lib/format";

import { deleteSpecialAction, setSpecialStatusAction } from "./actions";

export type SpecialStatus =
  | "draft"
  | "active"
  | "paused"
  | "expired"
  | "archived";

export type SpecialRow = {
  id: string;
  slug: string;
  title: string;
  status: SpecialStatus;
  quantity: number;
  redemptionsUsed: number;
  isFeatured: boolean;
  priceMode: "flat" | "per_night";
  flatTotal: number | null;
  perNightPrice: number | null;
  currency: string;
  dateMode: "fixed" | "flexible";
  fixedCheckIn: string | null;
  fixedCheckOut: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  showInDirectory: boolean;
  showOnWebsite: boolean;
  propertyName: string;
};

const STATUS_STYLE: Record<SpecialStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-brand-light text-brand-mute" },
  active: { label: "Active", cls: "bg-green-100 text-green-700" },
  paused: { label: "Paused", cls: "bg-amber-100 text-amber-700" },
  expired: { label: "Expired", cls: "bg-red-100 text-red-700" },
  archived: { label: "Archived", cls: "bg-brand-light text-brand-mute" },
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function SpecialsList({ specials }: { specials: SpecialRow[] }) {
  if (specials.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white p-12 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="font-display text-lg font-bold text-brand-ink">
          No specials yet
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
          Create a pre-packaged deal — pick a property, set your dates and a
          fixed price, and choose where it shows.
        </p>
        <Link
          href="/dashboard/specials/new"
          className="mt-5 inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
        >
          Create your first special
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {specials.map((s) => (
        <SpecialCard key={s.id} special={s} />
      ))}
    </div>
  );
}

function SpecialCard({ special: s }: { special: SpecialRow }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const status = STATUS_STYLE[s.status];
  const soldOut = s.redemptionsUsed >= s.quantity;
  const price =
    s.priceMode === "flat"
      ? `${formatMoney(s.flatTotal, s.currency)} total`
      : `${formatMoney(s.perNightPrice, s.currency)} / night`;
  const dates =
    s.dateMode === "fixed"
      ? `${fmtDate(s.fixedCheckIn)} → ${fmtDate(s.fixedCheckOut)}`
      : `${fmtDate(s.windowStart)} – ${fmtDate(s.windowEnd)} window`;

  function run(
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) {
    setMenuOpen(false);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(label);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="relative flex flex-col rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {s.isFeatured ? (
              <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
            ) : null}
            <h3 className="truncate font-display text-base font-bold text-brand-ink">
              {s.title}
            </h3>
          </div>
          <p className="mt-0.5 truncate text-[13px] text-brand-mute">
            {s.propertyName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-pill px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${status.cls}`}
          >
            {status.label}
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              disabled={pending}
              className="rounded-lg p-1.5 text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink disabled:opacity-50"
              aria-label="Special actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-card border border-brand-line bg-white py-1 shadow-lift">
                  <MenuLink
                    href={`/dashboard/specials/${s.id}/edit`}
                    icon={Pencil}
                    label="Edit"
                  />
                  {s.status === "active" ? (
                    <MenuButton
                      icon={Pause}
                      label="Pause"
                      onClick={() =>
                        run("Special paused", () =>
                          setSpecialStatusAction(s.id, "paused"),
                        )
                      }
                    />
                  ) : (
                    <MenuButton
                      icon={Play}
                      label="Activate"
                      onClick={() =>
                        run("Special activated", () =>
                          setSpecialStatusAction(s.id, "active"),
                        )
                      }
                    />
                  )}
                  {s.status !== "archived" ? (
                    <MenuButton
                      icon={LayoutGrid}
                      label="Archive"
                      onClick={() =>
                        run("Special archived", () =>
                          setSpecialStatusAction(s.id, "archived"),
                        )
                      }
                    />
                  ) : null}
                  <MenuButton
                    icon={Trash2}
                    label="Delete"
                    danger
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmDelete(true);
                    }}
                  />
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
        <Fact label="Price" value={price} />
        <Fact label="Dates" value={dates} />
        <Fact
          label="Redeemed"
          value={
            <span
              className={soldOut ? "font-semibold text-red-600" : undefined}
            >
              {s.redemptionsUsed} / {s.quantity}
              {soldOut ? " · sold out" : ""}
            </span>
          }
        />
        <Fact label="Visible on" value={<VisibilityChips special={s} />} />
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-brand-line pt-3">
        <Link
          href={`/dashboard/specials/${s.id}/edit`}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-light"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Link>
        {s.status === "active" ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Live
          </span>
        ) : null}
      </div>

      <Modal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        intent="destructive"
        title="Delete this special?"
        description={`“${s.title}” will be removed from your specials. Existing bookings made from it are unaffected.`}
        actions={[
          {
            label: "Delete",
            kind: "danger",
            onClick: () =>
              run("Special deleted", () => deleteSpecialAction(s.id)),
          },
          { label: "Cancel", kind: "ghost" },
        ]}
      />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
        {label}
      </div>
      <div className="mt-0.5 text-brand-ink">{value}</div>
    </div>
  );
}

function VisibilityChips({ special: s }: { special: SpecialRow }) {
  const linkOnly = !s.showInDirectory && !s.showOnWebsite;
  if (linkOnly) {
    return (
      <span className="inline-flex items-center gap-1 text-brand-mute">
        <Link2 className="h-3.5 w-3.5" /> Link only
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-brand-ink">
      {s.showInDirectory ? (
        <span className="inline-flex items-center gap-1">
          <Store className="h-3.5 w-3.5" /> Directory
        </span>
      ) : null}
      {s.showOnWebsite ? (
        <span className="inline-flex items-center gap-1">
          <Globe className="h-3.5 w-3.5" /> Website
        </span>
      ) : null}
    </span>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Pencil;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 text-[13px] text-brand-ink transition-colors hover:bg-brand-light"
    >
      <Icon className="h-3.5 w-3.5 text-brand-mute" />
      {label}
    </Link>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-brand-light ${
        danger ? "text-red-600" : "text-brand-ink"
      }`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${danger ? "text-red-500" : "text-brand-mute"}`}
      />
      {label}
    </button>
  );
}
