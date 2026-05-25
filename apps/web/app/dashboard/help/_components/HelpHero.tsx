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

  return (
    <section className="relative overflow-hidden rounded-card border border-brand-line bg-white">
      <div
        className="relative px-6 py-10 sm:px-10 lg:px-14 lg:py-14"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 18%, rgba(16,185,129,0.18) 0, transparent 38%), radial-gradient(circle at 88% 82%, rgba(6,78,59,0.10) 0, transparent 42%)",
        }}
      >
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-pill bg-brand-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-secondary">
            <LifeBuoy className="h-3 w-3" /> Help center
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold leading-[1.05] tracking-tight text-brand-ink sm:text-4xl lg:text-[44px]">
            {greeting ? (
              <>
                How can we help,{" "}
                <span className="text-brand-secondary">{greeting}</span>?
              </>
            ) : (
              <>How can we help?</>
            )}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-mute sm:text-base">
            Search articles, watch quick tutorials, or chat with a human. Most
            hosts get an answer in under 4 minutes.
          </p>

          <form onSubmit={submit} className="relative mt-6">
            <div className="flex items-center gap-2 rounded-pill border-2 border-brand-line bg-white px-4 py-2 transition-all focus-within:border-brand-primary focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]">
              <Search className="h-5 w-5 shrink-0 text-brand-mute" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Try "refund a guest" or "sync iCal"'
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-brand-mute sm:text-base"
                aria-label="Search help articles"
              />
              <kbd className="hidden rounded border border-brand-line bg-brand-light px-1.5 py-0.5 font-mono text-[10px] text-brand-mute sm:inline-block">
                ⌘K
              </kbd>
              <button
                type="submit"
                className="rounded-pill bg-brand-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
              >
                Search
              </button>
            </div>
            {trending.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-brand-mute">Trending:</span>
                {trending.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setQuery(label);
                      const sp = new URLSearchParams({ q: label });
                      if (audience !== "host") sp.set("as", audience);
                      router.push(`${searchPath}?${sp.toString()}`);
                    }}
                    className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand-secondary transition-colors hover:bg-brand-accent"
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </form>

          <div
            className={`mt-7 inline-flex items-center gap-1 rounded-pill border border-brand-line bg-brand-light p-1 text-sm ${pending ? "opacity-70" : ""}`}
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

        <div className="absolute right-10 top-1/2 hidden -translate-y-1/2 xl:block">
          <div className="relative h-[220px] w-[220px]">
            <div className="absolute inset-0 rotate-6 rounded-card bg-brand-accent/60" />
            <div className="absolute inset-2 flex -rotate-3 flex-col rounded-card border border-brand-line bg-white p-3">
              <div className="mb-2 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-line" />
                <span className="h-1.5 w-1.5 rounded-full bg-brand-line" />
                <span className="h-1.5 w-1.5 rounded-full bg-brand-line" />
              </div>
              <div className="font-mono text-[10px] text-brand-mute">
                vilo.help/articles
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="h-2 w-3/4 rounded bg-brand-line" />
                <div className="h-2 w-full rounded bg-brand-line" />
                <div className="h-2 w-5/6 rounded bg-brand-line" />
              </div>
              <div className="mt-3 flex flex-1 flex-col justify-end rounded bg-brand-accent p-2">
                <div className="h-1.5 w-1/2 rounded bg-brand-primary/40" />
                <div className="mt-1 h-1.5 w-3/4 rounded bg-brand-primary/40" />
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary text-white shadow-lift">
              <LifeBuoy className="h-6 w-6" />
            </div>
          </div>
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
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-pill px-4 py-1.5 font-medium transition-colors ${
        active
          ? "bg-white text-brand-ink shadow-card"
          : "text-brand-mute hover:text-brand-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
