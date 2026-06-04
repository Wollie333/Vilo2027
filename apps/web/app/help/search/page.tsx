import {
  ArrowLeft,
  ArrowRight,
  ClockIcon,
  Search as SearchIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { searchHelpArticles } from "@/lib/help/queries";
import type { HelpAudience } from "@/lib/help/types";

import { SiteFooter } from "../../_components/home/SiteFooter";
import { SiteHeader } from "../../_components/home/SiteHeader";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; as?: string };

export const metadata: Metadata = {
  title: "Search help",
  robots: { index: false, follow: true },
};

function resolveAudience(value: string | undefined): HelpAudience {
  return value === "guest" ? "guest" : "host";
}

export default async function PublicHelpSearchPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const q = (searchParams?.q ?? "").trim();
  const audience = resolveAudience(searchParams?.as);
  const results = q ? await searchHelpArticles(q, audience, 30) : [];

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <main className="mx-auto max-w-[1000px] space-y-6 px-5 py-8 lg:px-8 lg:py-12">
        <Link
          href="/help"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to help
        </Link>

        <header>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Search results
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-brand-ink sm:text-3xl">
            {q ? <>Results for &ldquo;{q}&rdquo;</> : "Search the help centre"}
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            {q
              ? `${results.length} article${results.length === 1 ? "" : "s"} matched.`
              : "Type a query to begin."}
          </p>
        </header>

        <form
          action="/help/search"
          method="get"
          className="flex items-center gap-2 rounded-pill border-2 border-brand-line bg-white px-4 py-2 transition-all focus-within:border-brand-primary focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
        >
          <SearchIcon className="h-5 w-5 shrink-0 text-brand-mute" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="Search articles…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-brand-mute"
          />
          {audience !== "host" ? (
            <input type="hidden" name="as" value={audience} />
          ) : null}
          <button
            type="submit"
            className="rounded-pill bg-brand-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-secondary"
          >
            Search
          </button>
        </form>

        <div className="overflow-hidden rounded-card border border-brand-line bg-white">
          {results.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-brand-mute">
              {q
                ? "Nothing matched. Try a shorter or different phrase."
                : "Enter a query to find articles."}
            </p>
          ) : (
            <ol className="divide-y divide-brand-line">
              {results.map((a, i) => (
                <li key={a.id}>
                  <Link
                    href={`/help/${a.slug}`}
                    className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-brand-light/60"
                  >
                    <span className="num w-6 shrink-0 font-mono text-xs text-brand-mute">
                      {(i + 1).toString().padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-brand-ink">
                        {a.title}
                      </div>
                      {a.excerpt ? (
                        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-brand-mute">
                          {a.excerpt}
                        </p>
                      ) : null}
                      <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-brand-mute">
                        <ClockIcon className="h-3 w-3" /> {a.read_time_minutes}{" "}
                        min read
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-brand-mute transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink" />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
