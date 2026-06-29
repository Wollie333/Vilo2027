"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { COUNTRIES, countryByIso, flagEmoji } from "@/lib/phone/dialCodes";

// Clickable country dialing-code picker used as the left addon of a phone input.
// Shows the selected flag + "+code"; clicking opens a searchable country list.
// Defaults are driven by the caller (signup defaults to South Africa).
export function CountryDialCodeSelect({
  iso2,
  onChange,
  ariaLabel = "Country dialing code",
}: {
  iso2: string;
  onChange: (iso2: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = countryByIso(iso2) ?? COUNTRIES[0];

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return COUNTRIES;
    const digits = s.replace(/\D/g, "");
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.iso2.toLowerCase().includes(s) ||
        (digits.length > 0 && c.dial.includes(digits)),
    );
  }, [query]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-full items-center gap-1.5 rounded-l border border-r-0 border-brand-line bg-brand-light/60 px-3 text-sm text-brand-ink transition hover:bg-brand-light focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
      >
        <span className="text-base leading-none">
          {flagEmoji(selected.iso2)}
        </span>
        <span className="font-mono text-brand-mute">+{selected.dial}</span>
        <ChevronDown className="h-3.5 w-3.5 text-brand-mute" />
      </button>

      {open ? (
        <div className="absolute left-0 z-30 mt-1 w-72 max-w-[80vw] overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <div className="flex items-center gap-2 border-b border-brand-line px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-brand-mute" />
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="w-full bg-transparent text-sm text-brand-ink placeholder:text-brand-mute focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-auto py-1">
            {filtered.map((c) => (
              <li key={c.iso2}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(c.iso2);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-brand-light ${
                    c.iso2 === selected.iso2 ? "bg-brand-light/60" : ""
                  }`}
                >
                  <span className="text-base leading-none">
                    {flagEmoji(c.iso2)}
                  </span>
                  <span className="flex-1 truncate text-brand-ink">
                    {c.name}
                  </span>
                  <span className="font-mono text-xs text-brand-mute">
                    +{c.dial}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-brand-mute">
                No matching country.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
