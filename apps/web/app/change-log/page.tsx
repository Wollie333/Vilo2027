import type { Metadata } from "next";
import { promises as fs } from "node:fs";
import path from "node:path";
import Link from "next/link";

import { PageFooter } from "../booking-management/_components/PageFooter";
import { SiteHeader } from "../booking-management/_components/SiteHeader";

export const metadata: Metadata = {
  title: "Changelog · Vilo",
  description:
    "Every shipped slice — status, scope, decisions and notes — straight from the source CHANGELOG.md.",
};

// Read at build time. Force-static so we don't hit the filesystem on every
// request — the file is part of the deployed bundle context.
export const dynamic = "force-static";

type Section = { heading: string; body: string };
type Entry = {
  date: string;
  phase: string;
  title: string;
  sections: Section[];
};

const CHANGELOG_CANDIDATES = [
  path.join(process.cwd(), "..", "..", "CHANGELOG.md"),
  path.join(process.cwd(), "CHANGELOG.md"),
];

async function loadChangelog(): Promise<string | null> {
  for (const candidate of CHANGELOG_CANDIDATES) {
    try {
      return await fs.readFile(candidate, "utf-8");
    } catch {
      // try next candidate
    }
  }
  return null;
}

function parseChangelog(md: string): Entry[] {
  // Split on `## ` at start of line. Skip the "How to Add an Entry" and the
  // template-placeholder entries — keep only those with a YYYY-MM-DD prefix.
  const blocks = md.split(/\n(?=## )/g);
  const entries: Entry[] = [];

  const headerRegex = /^## (\d{4}-\d{2}-\d{2}) — ([^—]+?) — (.+)$/;

  for (const block of blocks) {
    const firstNewline = block.indexOf("\n");
    const headerLine =
      firstNewline === -1 ? block : block.slice(0, firstNewline);
    const m = headerLine.match(headerRegex);
    if (!m) continue;
    const [, date, phase, title] = m;

    const body = firstNewline === -1 ? "" : block.slice(firstNewline + 1);
    const sections = parseSections(body);
    entries.push({ date, phase: phase.trim(), title: title.trim(), sections });
  }

  // Newest first — file is already ordered that way, but be defensive.
  return entries.sort((a, b) => (a.date < b.date ? 1 : -1));
}

function parseSections(body: string): Section[] {
  const blocks = body.split(/\n(?=### )/g);
  const out: Section[] = [];
  for (const block of blocks) {
    const firstNewline = block.indexOf("\n");
    const headerLine =
      firstNewline === -1 ? block : block.slice(0, firstNewline);
    if (!headerLine.startsWith("### ")) continue;
    const heading = headerLine.slice(4).trim();
    const rest =
      firstNewline === -1 ? "" : block.slice(firstNewline + 1).trim();
    if (heading && rest) out.push({ heading, body: rest });
  }
  return out;
}

function phaseTone(phase: string): {
  pill: string;
  dot: string;
} {
  if (/Phase 0/.test(phase)) {
    return { pill: "bg-brand-mute/15 text-brand-mute", dot: "bg-brand-mute" };
  }
  if (/Phase 1/.test(phase)) {
    return {
      pill: "bg-brand-accent text-brand-primary",
      dot: "bg-brand-primary",
    };
  }
  return {
    pill: "bg-brand-accent text-brand-primary",
    dot: "bg-brand-primary",
  };
}

export default async function ChangeLogPage() {
  const raw = await loadChangelog();
  const entries = raw ? parseChangelog(raw) : [];

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-brand-line">
        <div aria-hidden className="dotgrid absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-4xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Changelog
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold leading-[1.04] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
            What we&rsquo;ve shipped.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-mute">
            Every slice, in order. Pulled directly from the project&rsquo;s{" "}
            <code className="rounded-sm bg-brand-accent px-1.5 py-0.5 font-mono text-sm text-brand-primary">
              CHANGELOG.md
            </code>{" "}
            — no separate marketing version.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-brand-mute">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />
              {entries.length} entries
            </span>
            {entries[0] ? (
              <span className="font-mono">Latest · {entries[0].date}</span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-b border-brand-line">
        <div className="mx-auto max-w-4xl px-5 py-16 lg:px-8 lg:py-20">
          {entries.length === 0 ? (
            <div className="rounded-card border border-brand-line bg-white p-8 text-center text-brand-mute shadow-card">
              <p>
                Couldn&rsquo;t load the changelog at this time. Try again later
                or check the source at{" "}
                <Link
                  href="https://github.com/Wollie333/Vilo2027/blob/main/CHANGELOG.md"
                  className="font-medium text-brand-primary underline-offset-2 hover:underline"
                >
                  GitHub
                </Link>
                .
              </p>
            </div>
          ) : (
            <ol className="space-y-6">
              {entries.map((e, i) => {
                const tone = phaseTone(e.phase);
                return (
                  <li
                    key={`${e.date}-${i}`}
                    className="rounded-card border border-brand-line bg-white p-6 shadow-card lg:p-8"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${tone.pill}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${tone.dot}`}
                        />
                        {e.phase}
                      </span>
                      <span className="font-mono text-xs text-brand-mute">
                        {e.date}
                      </span>
                    </div>
                    <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-brand-dark md:text-2xl">
                      {e.title}
                    </h2>

                    {e.sections.length > 0 ? (
                      <div className="mt-5 space-y-5">
                        {e.sections.map((s) => (
                          <div key={s.heading}>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-primary">
                              {s.heading}
                            </div>
                            <div className="mt-2 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-brand-mute">
                              {s.body}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>

      <PageFooter />
    </div>
  );
}
