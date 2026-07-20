import type { Metadata } from "next";

import { loadBuildBoard } from "@/lib/buildBoard";

import { PageFooter } from "../booking-management/_components/PageFooter";
import { SiteHeader } from "../booking-management/_components/SiteHeader";
import { BuildBoardClient } from "./BuildBoardClient";

export const metadata: Metadata = {
  title: "Build Board — vote on what we build next",
  description:
    "Wielo's public roadmap. Vote on the features you want, suggest your own, and see exactly what we're building, shipping, and honestly not doing.",
};

// Always fresh — vote tallies and newly-approved items should show on load.
export const dynamic = "force-dynamic";

export default async function BuildBoardPage() {
  const board = await loadBuildBoard();

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-brand-line">
        <div aria-hidden className="dotgrid absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-5xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Build Board
          </div>
          <h1 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-[1.04] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
            You tell us what to build next.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-mute">
            This is Wielo&rsquo;s real roadmap — not a marketing wishlist. Vote
            on what matters to you, add your own idea, and watch it move from{" "}
            <span className="font-semibold text-brand-ink">under review</span>{" "}
            to <span className="font-semibold text-brand-ink">shipped</span>. We
            even show the honest <span className="font-semibold text-brand-ink">no</span>s.
          </p>
        </div>
      </section>

      <BuildBoardClient
        requests={board.requests}
        votedIds={board.votedIds}
        isAuthenticated={board.isAuthenticated}
        counts={board.counts}
      />

      <PageFooter />
    </div>
  );
}
