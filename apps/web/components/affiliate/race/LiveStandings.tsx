"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type {
  LeaderboardRow,
  PublicLeaderboardRow,
} from "@/lib/affiliate/leaderboard";

import { StandingsTable, type RowCue } from "./RaceBits";

// The standings, kept warm. The server still renders the table (SEO + first
// paint); this only takes over once a poll comes back with something new.
//
// When a rank changes the rows are re-ordered by React and then FLIPped into
// place: measure where each row WAS, let it paint where it now IS, invert it
// with a transform, then release the transform on the next frame so it glides.
// Rows are keyed by affiliate id, never by index — an index key would swap the
// CONTENT of two rows instead of moving the rows, and nothing would animate.

const POLL_MS = 30_000;
const GLIDE_MS = 520;
const CUE_MS = 1_500;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** The endpoint is public — trust nothing about its shape. */
function parseRows(payload: unknown): PublicLeaderboardRow[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.rows)) return null;
  const out: PublicLeaderboardRow[] = [];
  for (const raw of payload.rows) {
    if (!isRecord(raw)) return null;
    if (typeof raw.affiliateId !== "string") return null;
    if (typeof raw.rank !== "number" || typeof raw.listings !== "number") {
      return null;
    }
    out.push({
      affiliateId: raw.affiliateId,
      rank: raw.rank,
      publicName: typeof raw.publicName === "string" ? raw.publicName : "",
      photoUrl: typeof raw.photoUrl === "string" ? raw.photoUrl : null,
      communityName:
        typeof raw.communityName === "string" ? raw.communityName : null,
      communityMembers:
        typeof raw.communityMembers === "number" ? raw.communityMembers : null,
      region: typeof raw.region === "string" ? raw.region : null,
      listings: raw.listings,
      netThisMonth: typeof raw.netThisMonth === "number" ? raw.netThisMonth : 0,
    });
  }
  return out;
}

/**
 * The poll only carries public fields, so the full name and slug the portal
 * renders are carried over from the row we already have. Nobody's name changes
 * inside thirty seconds; a brand-new partner falls back to the public name.
 */
function merge(
  prev: LeaderboardRow[],
  next: PublicLeaderboardRow[],
): LeaderboardRow[] {
  const known = new Map(prev.map((r) => [r.affiliateId, r]));
  return next.map((r) => {
    const was = known.get(r.affiliateId);
    return { ...r, name: was?.name ?? r.publicName, slug: was?.slug ?? "" };
  });
}

function sameOrder(a: LeaderboardRow[], b: LeaderboardRow[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (r, i) =>
        r.affiliateId === b[i]!.affiliateId &&
        r.rank === b[i]!.rank &&
        r.listings === b[i]!.listings &&
        r.netThisMonth === b[i]!.netThisMonth,
    )
  );
}

export function LiveStandings({
  slug,
  initialRows,
  highlightAffiliateId,
  usePublicNames,
}: {
  slug: string;
  initialRows: LeaderboardRow[];
  highlightAffiliateId?: string | null;
  usePublicNames: boolean;
}) {
  const [rows, setRows] = useState<LeaderboardRow[]>(initialRows);
  const [cues, setCues] = useState<Record<string, RowCue>>({});

  const nodes = useRef(new Map<string, HTMLTableRowElement>());
  // offsetTop, not getBoundingClientRect().top: the two measurements straddle a
  // paint, and a viewport-relative one would count any scroll as movement.
  const tops = useRef(new Map<string, number>());
  const ranks = useRef(new Map<string, number>());
  const firstPaint = useRef(true);

  const rowRef = useCallback((id: string, el: HTMLTableRowElement | null) => {
    if (el) nodes.current.set(id, el);
    else nodes.current.delete(id);
  }, []);

  useLayoutEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const nextTops = new Map<string, number>();
    nodes.current.forEach((el, id) => nextTops.set(id, el.offsetTop));

    const nextRanks = new Map(rows.map((r) => [r.affiliateId, r.rank]));
    const wasFirst = firstPaint.current;
    firstPaint.current = false;

    const prevTops = tops.current;
    const prevRanks = ranks.current;
    tops.current = nextTops;
    ranks.current = nextRanks;

    // Never animate the first paint — the standings should just be there.
    if (wasFirst) return;

    // Reduced motion suppresses MOVEMENT only. The ▲/▼ tint is colour, not
    // motion, and it is the only thing telling you a row changed place — so
    // someone who asked the OS for less motion still gets the information.
    const moved: HTMLTableRowElement[] = [];
    if (!reduced) {
      nodes.current.forEach((el, id) => {
        const from = prevTops.get(id);
        const to = nextTops.get(id);
        if (from === undefined || to === undefined || Math.abs(from - to) < 1) {
          return;
        }
        el.style.transition = "none";
        el.style.transform = `translateY(${from - to}px)`;
        moved.push(el);
      });
    }

    const cue: Record<string, RowCue> = {};
    for (const r of rows) {
      const before = prevRanks.get(r.affiliateId);
      if (before === undefined || before === r.rank) continue;
      cue[r.affiliateId] = r.rank < before ? "up" : "down";
    }

    if (!moved.length && !Object.keys(cue).length) return;

    const frame = requestAnimationFrame(() => {
      // rAF runs BEFORE this frame's style pass, so the inverted transform set
      // above has not been committed yet — clearing it here without forcing a
      // recalculation first would cancel it silently and nothing would move.
      // Reading offsetHeight commits it, giving the transition a "from" value.
      if (moved[0]) void moved[0].offsetHeight;
      for (const el of moved) {
        el.style.transition = `transform ${GLIDE_MS}ms cubic-bezier(.2,.8,.2,1)`;
        el.style.transform = "";
      }
    });
    if (Object.keys(cue).length) setCues(cue);

    const clearGlide = window.setTimeout(() => {
      for (const el of moved) {
        el.style.transition = "";
        el.style.transform = "";
      }
    }, GLIDE_MS + 60);
    const clearCue = window.setTimeout(() => setCues({}), CUE_MS);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(clearGlide);
      window.clearTimeout(clearCue);
    };
  }, [rows]);

  useEffect(() => {
    let alive = true;
    const url = `/api/campaigns/${encodeURIComponent(slug)}/standings`;

    const tick = async () => {
      if (document.hidden) return; // a hidden tab costs nobody a query
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const next = parseRows(await res.json());
        if (!alive || !next) return;
        setRows((prev) => {
          const merged = merge(prev, next);
          return sameOrder(prev, merged) ? prev : merged;
        });
      } catch {
        // A dropped poll is not worth surfacing — the next one is 30s away.
      }
    };

    const id = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [slug]);

  return (
    <StandingsTable
      rows={rows}
      highlightAffiliateId={highlightAffiliateId}
      usePublicNames={usePublicNames}
      rowRef={rowRef}
      cues={cues}
    />
  );
}
