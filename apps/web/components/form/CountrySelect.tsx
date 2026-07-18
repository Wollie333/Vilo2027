"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { COUNTRIES, countryByIso, flagEmoji } from "@/lib/phone/dialCodes";

// Full-width searchable country picker (flag + name), returning the ISO-3166
// alpha-2 code. Reuses the shared COUNTRIES list so signup + settings pick from
// the same source. Mirrors CountryDialCodeSelect's interaction, but for a
// standalone "which country are you in?" field.
export function CountrySelect({
  iso2,
  onChange,
  ariaLabel = "Country",
  id,
}: {
  iso2: string;
  onChange: (iso2: string) => void;
  ariaLabel?: string;
  id?: string;
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
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(s) || c.iso2.toLowerCase().includes(s),
    );
  }, [query]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded border border-brand-line bg-white px-3 py-2.5 text-left text-sm text-brand-ink transition hover:bg-brand-light/40 focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
      >
        <span className="text-base leading-none">
          {flagEmoji(selected.iso2)}
        </span>
        <span className="flex-1 truncate">{selected.name}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-brand-mute" />
      </button>

      {open ? (
        <div className="absolute left-0 z-30 mt-1 w-full overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <div className="flex items-center gap-2 border-b border-brand-line px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-brand-mute" />
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country"
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
                    {c.iso2}
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
