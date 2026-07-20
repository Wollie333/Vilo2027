import type { Metadata } from "next";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Link } from "@/i18n/navigation";

import {
  type ChangelogEntry,
  listPublishedChangelogEntries,
} from "@/lib/changelog";

import { PageFooter } from "../booking-management/_components/PageFooter";
import { SiteHeader } from "../booking-management/_components/SiteHeader";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Every shipped slice — status, scope, decisions and notes — straight from the source CHANGELOG.md.",
};

// Dynamic: the DB-backed changelog (WS-3b) reflects admin edits immediately;
// when no DB entries are published we fall back to parsing the repo CHANGELOG.md.
export const dynamic = "force-dynamic";

function formatShipped(entry: ChangelogEntry): string {
  const iso = entry.shippedAt ?? entry.publishedAt ?? entry.createdAt;
  return iso ? iso.slice(0, 10) : "";
}

// Matches the RichTextEditor output (the typography plugin isn't installed), so
// admin-authored HTML reads the same on the page as it did in the editor.
const CHANGELOG_PROSE =
  "text-[15px] leading-relaxed text-brand-mute [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-brand-ink [&_h3]:mt-5 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-brand-ink [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_strong]:font-semibold [&_strong]:text-brand-ink [&_p]:my-2 [&_a]:text-brand-primary [&_a]:underline";

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
  // DB-backed, curated entries take precedence; fall back to the repo file.
  const dbEntries = await listPublishedChangelogEntries();
  const useDb = dbEntries.length > 0;
  const raw = useDb ? null : await loadChangelog();
  const entries = raw ? parseChangelog(raw) : [];

  const count = useDb ? dbEntries.length : entries.length;
  const latest = useDb ? formatShipped(dbEntries[0]) : entries[0]?.date;

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
            Every feature we ship — often because a host asked. Vote on
            what&rsquo;s next on the{" "}
            <Link
              href="/build"
              className="font-medium text-brand-primary underline-offset-2 hover:underline"
            >
              Build Board
            </Link>
            .
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-brand-mute">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />
              {count} entries
            </span>
            {latest ? (
              <span className="font-mono">Latest · {latest}</span>
            ) : null}
          </div>
        </div>
      </section>

      {useDb ? (
        <section className="border-b border-brand-line">
          <div className="mx-auto max-w-4xl px-5 py-16 lg:px-8 lg:py-20">
            <ol className="space-y-6">
              {dbEntries.map((e) => (
                <li
                  key={e.id}
                  id={e.slug}
                  className="scroll-mt-24 rounded-card border border-brand-line bg-white p-6 shadow-card lg:p-8"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Shipped
                    </span>
                    <span className="font-mono text-xs text-brand-mute">
                      {formatShipped(e)}
                    </span>
                    {e.creditedName ? (
                      <span className="text-xs text-brand-mute">
                        Suggested by{" "}
                        <span className="font-semibold text-brand-ink">
                          {e.creditedName}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-brand-dark md:text-2xl">
                    {e.title}
                  </h2>
                  {e.bodyHtml ? (
                    <div
                      className={`mt-3 ${CHANGELOG_PROSE}`}
                      // Sanitised on read in lib/changelog.ts.
                      dangerouslySetInnerHTML={{ __html: e.bodyHtml }}
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : (
        <section className="border-b border-brand-line">
          <div className="mx-auto max-w-4xl px-5 py-16 lg:px-8 lg:py-20">
            {entries.length === 0 ? (
              <div className="rounded-card border border-brand-line bg-white p-8 text-center text-brand-mute shadow-card">
                <p>
                  Couldn&rsquo;t load the changelog at this time. Try again
                  later or check the source at{" "}
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
      )}

      <PageFooter />
    </div>
  );
}
