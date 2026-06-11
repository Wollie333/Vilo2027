"use client";

import { ArrowRight, Clock, Home, Luggage, Search } from "lucide-react";
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

// Dark hero card — mirrors the FirstLoginHero "Welcome to Vilo, Thandi." shell
// (gradient left panel with badge + heading + CTAs, darker right panel with a
// stat + list). This is the canonical hero pattern for primary pages.
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
    <section className="relative overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="grid gap-0 md:grid-cols-[1.5fr_1fr]">
        {/* Left: greeting + search + tabs */}
        <div
          className="relative p-7 text-white md:p-8"
          style={{
            backgroundImage:
              "linear-gradient(145deg, #030806 0%, #0a1510 50%, #051209 100%)",
          }}
        >
          <div
            aria-hidden
            className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand-primary/30 blur-3xl"
          />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              Help center
            </div>
            <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight md:text-[34px]">
              {greeting ? (
                <>How can we help, {greeting}?</>
              ) : (
                <>How can we help?</>
              )}
            </h2>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-brand-accent/80">
              Search articles, watch quick tutorials, or chat with a human. Most
              hosts get an answer in under 4 minutes.
            </p>

            <form onSubmit={submit} className="mt-6">
              <div className="flex items-center gap-2 rounded-[10px] border border-white/15 bg-black/20 px-3 py-2 backdrop-blur transition-all focus-within:border-brand-primary/60 focus-within:bg-black/30 focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]">
                <Search className="h-4 w-4 shrink-0 text-brand-accent/70" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Try "refund a guest" or "sync iCal"'
                  className="flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/40"
                  aria-label="Search help articles"
                />
                <kbd className="hidden rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/60 sm:inline-block">
                  ⌘K
                </kbd>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-[8px] bg-brand-primary px-3 py-1.5 text-[13px] font-semibold text-white shadow-[0_12px_32px_-10px_rgba(16,185,129,0.35)] transition-colors hover:bg-white hover:text-brand-secondary"
                >
                  Search
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>

            <div
              className={`mt-5 inline-flex items-center gap-1 rounded-pill border border-white/15 bg-black/20 p-1 text-[13px] backdrop-blur ${
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
        </div>

        {/* Right: support stat + trending */}
        <div className="flex flex-col justify-center bg-brand-dark/95 p-7 text-white md:p-8">
          <div className="flex items-center gap-4">
            <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center">
              <svg
                viewBox="0 0 120 120"
                className="absolute inset-0 h-full w-full -rotate-90"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="rgba(255,255,255,0.20)"
                  strokeWidth="10"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray="326.7"
                  strokeDashoffset="49"
                />
              </svg>
              <Clock className="relative h-7 w-7 text-brand-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-primary">
                Avg first reply
              </div>
              <div className="mt-1 font-display text-[22px] font-bold leading-none">
                Under 4 min
              </div>
              <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] text-brand-accent/70">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-primary opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-primary" />
                </span>
                Support online now
              </div>
            </div>
          </div>

          {trending.length > 0 ? (
            <div className="mt-6">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent/70">
                Trending
              </div>
              <ul className="mt-2 space-y-1.5">
                {trending.slice(0, 4).map((label) => (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => quickSearch(label)}
                      className="group flex w-full items-center justify-between gap-2 rounded-[8px] border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-[12.5px] font-medium text-white/90 transition-colors hover:border-brand-primary/40 hover:bg-white/10"
                    >
                      <span className="truncate">{label}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-brand-primary opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
          ? "bg-brand-primary text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,0.5)]"
          : "text-white/70 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
