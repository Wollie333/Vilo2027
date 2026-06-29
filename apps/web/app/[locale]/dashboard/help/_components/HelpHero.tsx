"use client";

import { Home, LifeBuoy, Luggage, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import type { HelpAudience } from "@/lib/help/types";

type Props = {
  greeting: string | null;
  audience: HelpAudience;
  trending: string[];
  basePath: string;
  searchPath: string;
};

// Full-width centred hero on a dark-green radial gradient with a big white pill
// search (matches Help Center.html). The host/guest switch is kept (real
// functionality) as a discreet segmented control under the popular searches.
export function HelpHero({
  greeting,
  audience,
  trending,
  basePath,
  searchPath,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  function setAudience(next: HelpAudience) {
    const sp = new URLSearchParams(params.toString());
    if (next === "host") sp.delete("as");
    else sp.set("as", next);
    startTransition(() => router.replace(`${basePath}?${sp.toString()}`));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    const sp = new URLSearchParams({ q: trimmed });
    if (audience !== "host") sp.set("as", audience);
    router.push(`${searchPath}?${sp.toString()}`);
  }

  function quickSearch(label: string) {
    setQuery(label);
    const sp = new URLSearchParams({ q: label });
    if (audience !== "host") sp.set("as", audience);
    router.push(`${searchPath}?${sp.toString()}`);
  }

  return (
    <section
      className="relative overflow-hidden rounded-card border border-brand-line px-5 py-10 text-white shadow-card lg:px-10 lg:py-14"
      style={{
        background:
          "radial-gradient(circle at 12% 0%, rgba(16,185,129,.16) 0, transparent 45%), radial-gradient(circle at 92% 120%, rgba(6,78,59,.12) 0, transparent 50%), #064E3B",
      }}
    >
      <div className="mx-auto max-w-[940px] text-center">
        <div className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 ring-1 ring-white/15 backdrop-blur">
          <LifeBuoy className="h-3.5 w-3.5" />
          Wielo Help Center
        </div>
        <h1 className="mt-5 font-display text-[28px] font-extrabold leading-[1.08] tracking-tight sm:text-4xl lg:text-[46px]">
          {greeting ? (
            <>Hi {greeting} — how can we help?</>
          ) : (
            <>How can we help?</>
          )}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
          Search our guides, or jump straight to a topic. Most hosts find their
          answer in seconds.
        </p>

        {/* Big white pill search */}
        <form
          onSubmit={submit}
          className="relative mx-auto mt-7 max-w-2xl text-left"
        >
          <div className="flex items-center gap-3 rounded-pill bg-white py-2 pl-5 pr-2 shadow-[0_18px_50px_-20px_rgba(0,0,0,.5)] ring-1 ring-white/20">
            <Search className="h-5 w-5 shrink-0 text-brand-mute" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Try "refund a guest" or "sync my calendar"…'
              aria-label="Search help articles"
              className="flex-1 bg-transparent py-1.5 text-[15px] text-brand-ink outline-none placeholder:text-brand-mute sm:text-base"
            />
            <button
              type="submit"
              className="hidden shrink-0 items-center gap-1.5 rounded-pill bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary sm:inline-flex"
            >
              Search
            </button>
          </div>
        </form>

        {/* Popular searches */}
        {trending.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="font-medium text-white/55">Popular:</span>
            {trending.slice(0, 4).map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => quickSearch(label)}
                className="rounded-pill bg-white/10 px-3 py-1 text-white/90 ring-1 ring-white/15 transition-colors hover:bg-white/20"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {/* Host / guest switch (kept — drives which articles show) */}
        <div
          className={`mt-6 inline-flex items-center gap-1 rounded-pill bg-white/10 p-1 text-[12.5px] ring-1 ring-white/15 backdrop-blur ${
            pending ? "opacity-70" : ""
          }`}
          role="tablist"
          aria-label="Audience"
        >
          <AudienceTab
            active={audience === "host"}
            onClick={() => setAudience("host")}
            icon={<Home className="h-3.5 w-3.5" />}
            label="I'm a host"
          />
          <AudienceTab
            active={audience === "guest"}
            onClick={() => setAudience("guest")}
            icon={<Luggage className="h-3.5 w-3.5" />}
            label="I'm a guest"
          />
        </div>
      </div>
    </section>
  );
}

function AudienceTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 font-medium transition-colors ${
        active
          ? "bg-white text-brand-secondary"
          : "text-white/70 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
