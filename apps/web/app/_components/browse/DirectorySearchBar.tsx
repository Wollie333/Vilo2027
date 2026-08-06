"use client";

import { ArrowDownUp, Home, Search, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { DateRangePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { DEFAULT_SORT } from "./browseSort";

export type DirectoryTypeOption = { value: string; label: string };

const SORT_OPTIONS: DirectoryTypeOption[] = [
  { value: DEFAULT_SORT, label: "Best match" },
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price · low to high" },
  { value: "price_desc", label: "Price · high to low" },
  { value: "rating", label: "Top-rated" },
];

// Radix Select forbids an empty-string item value, so "no filter" gets a
// sentinel that is mapped back to "" (or 0) when the URL is built.
const ANY_TYPE = "any";
const GUEST_OPTIONS: DirectoryTypeOption[] = [
  { value: "0", label: "Any guests" },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16].map((n) => ({
    value: String(n),
    label: `${n}+ ${n === 1 ? "guest" : "guests"}`,
  })),
];

// Shared field chrome — matches the DateRangePicker trigger so every segment
// reads as one consistent control, stacked full-width on mobile, row on desktop.
const FIELD_LABEL =
  "mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-mute";
// text-brand-ink is explicit: the hero section sets text-white on its subtree,
// and the Select value would otherwise inherit it and vanish on the white card.
const TRIGGER =
  "h-auto min-h-[3.25rem] items-center rounded-md border-input text-left font-medium text-brand-ink hover:border-brand-primary/50 focus:ring-brand-primary/30";

function todayISO(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A branded dropdown field (Wielo Select popover, not a native <select>) with
 *  the icon + mini-label chrome shared across the bar. */
function SelectField({
  icon: Icon,
  label,
  placeholder,
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
}: {
  icon: LucideIcon;
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (v: string) => void;
  options: DirectoryTypeOption[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={`${TRIGGER} ${className ?? ""}`}
      >
        {/* Divs (not spans) so the trigger's [&>span]:line-clamp-1 rule can't
            collapse the stacked label + value. */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Icon className="h-4 w-4 shrink-0 text-brand-primary" />
          <div className="min-w-0 flex-1">
            <div className={FIELD_LABEL}>{label}</div>
            <SelectValue placeholder={placeholder} />
          </div>
        </div>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The one modern directory search control — where / type / dates / guests.
 *
 * Used on the home hero and on /explore (where type is chosen via the chips row,
 * so the dropdown is hidden and Sort is shown instead). Dates use the branded
 * DateRangePicker SSOT and the dropdowns use the branded Select popover — never
 * native controls. Submitting starts from the CURRENT url so advanced filters
 * set in the Filters sheet survive a search — searching narrows, never resets.
 */
export function DirectorySearchBar({
  typeOptions,
  where = "",
  type = "",
  guests = 0,
  checkin = "",
  checkout = "",
  sort = DEFAULT_SORT,
  basePath = "/explore",
  showType = true,
  showSort = false,
}: {
  typeOptions: DirectoryTypeOption[];
  where?: string;
  type?: string;
  guests?: number;
  checkin?: string;
  checkout?: string;
  sort?: string;
  basePath?: string;
  variant?: "hero" | "inline";
  showType?: boolean;
  showSort?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [w, setW] = useState(where);
  const [ty, setTy] = useState(type || ANY_TYPE);
  const [g, setG] = useState(String(guests || 0));
  const [ci, setCi] = useState(checkin);
  const [co, setCo] = useState(checkout);
  const [s, setS] = useState(sort || DEFAULT_SORT);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");

    const setOrDelete = (key: string, value: string) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };

    setOrDelete("where", w.trim());
    if (showType) setOrDelete("type", ty === ANY_TYPE ? "" : ty);

    const guestCount = parseInt(g, 10);
    if (Number.isFinite(guestCount) && guestCount > 0)
      params.set("guests", String(guestCount));
    else params.delete("guests");

    // Dates only filter as a complete range; a half-set range clears both.
    if (ci && co && co > ci) {
      params.set("checkin", ci);
      params.set("checkout", co);
    } else {
      params.delete("checkin");
      params.delete("checkout");
    }

    if (showSort && s && s !== DEFAULT_SORT) params.set("sort", s);
    else if (showSort) params.delete("sort");

    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  const typeSelectOptions: DirectoryTypeOption[] = [
    { value: ANY_TYPE, label: "Any type" },
    ...typeOptions,
  ];

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-2 rounded-card border border-brand-line bg-white p-2 text-left shadow-lift lg:flex-row lg:items-stretch"
    >
      {/* Where — free-text keyword search */}
      <label className="flex min-h-[3.25rem] items-center gap-3 rounded-md border border-input bg-background px-3 py-2 transition-colors focus-within:border-brand-primary/60 hover:border-brand-primary/50 lg:min-w-[11rem] lg:flex-[1.3]">
        <Search className="h-4 w-4 shrink-0 text-brand-primary" />
        <span className="min-w-0 flex-1">
          <span className={FIELD_LABEL}>Where</span>
          <input
            type="text"
            value={w}
            onChange={(e) => setW(e.target.value)}
            placeholder="City, town or keyword"
            aria-label="Search by place or keyword"
            className="w-full bg-transparent text-sm font-medium text-brand-ink outline-none placeholder:font-normal placeholder:text-brand-mute/70"
          />
        </span>
      </label>

      {/* Type — hidden on /explore, where the chips row owns type selection */}
      {showType ? (
        <SelectField
          icon={Home}
          label="Type"
          placeholder="Any type"
          ariaLabel="Accommodation type"
          value={ty}
          onValueChange={setTy}
          options={typeSelectOptions}
          className="lg:min-w-[9rem] lg:flex-1"
        />
      ) : null}

      {/* Dates — branded range picker (never native <input type=date>). The
          picker forwards className to its inner button, not its wrapper, so the
          flex sizing lives on this cell and [&>div] makes the wrapper fill it;
          h-full then stretches the button to match the other fields' height. */}
      <div className="flex min-h-[3.25rem] lg:min-w-[16rem] lg:flex-[1.5] [&>div]:h-full [&>div]:w-full">
        <DateRangePicker
          from={ci}
          to={co}
          min={todayISO()}
          onChange={(from, to) => {
            setCi(from);
            setCo(to);
          }}
          labelFrom="Check-in"
          labelTo="Check-out"
          className="h-full"
        />
      </div>

      {/* Guests */}
      <SelectField
        icon={Users}
        label="Guests"
        placeholder="Any guests"
        ariaLabel="Minimum guest capacity"
        value={g}
        onValueChange={setG}
        options={GUEST_OPTIONS}
        className="lg:min-w-[8.5rem] lg:flex-1"
      />

      {/* Sort — only where the caller wants it (e.g. /explore) */}
      {showSort ? (
        <SelectField
          icon={ArrowDownUp}
          label="Sort"
          placeholder="Best match"
          ariaLabel="Sort order"
          value={s}
          onValueChange={setS}
          options={SORT_OPTIONS}
          className="lg:min-w-[8.5rem] lg:flex-1"
        />
      ) : null}

      <button
        type="submit"
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-brand-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary lg:min-w-[7rem]"
      >
        <Search className="h-4 w-4" />
        Search
      </button>
    </form>
  );
}
