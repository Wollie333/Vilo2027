import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

import { getBrandName } from "@/lib/brand";
import { createServerClient } from "@/lib/supabase/server";

import { QuoteForm } from "../QuoteForm";
import { loadQuoteFormListings } from "../_listings";

export const metadata: Metadata = {
  title: "New quote",
};

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  const supabase = createServerClient();
  const brandName = await getBrandName();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/quotes/new");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const list = host ? await loadQuoteFormListings(supabase, host.id) : [];

  if (list.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          New quote
        </h1>
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <p className="text-sm text-brand-mute">
            You need at least one listing before you can draw a quote.
          </p>
          <Link
            href="/dashboard/properties/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-secondary"
          >
            New listing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            New quote
          </div>
          <h1 className="mt-1 font-display text-[30px] font-bold leading-tight tracking-tight text-brand-ink">
            Build a quote for a guest
          </h1>
          <p className="mt-1 max-w-xl text-[13px] text-brand-mute">
            Put together a custom price for an enquiry and send it over. The
            guest can accept and pay online — {brandName} turns an accepted
            quote straight into a confirmed booking.
          </p>
        </div>
        <Link
          href="/dashboard/quotes"
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-medium text-brand-ink hover:bg-brand-accent/40"
        >
          Cancel
        </Link>
      </header>
      <QuoteForm listings={list} />
    </div>
  );
}
