import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

import { loadFormDraft } from "@/lib/drafts/store";
import { createServerClient } from "@/lib/supabase/server";

import { QuoteForm } from "../QuoteForm";
import { loadQuoteFormListings } from "../_listings";

export const metadata: Metadata = {
  title: "New quote",
};

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  const supabase = createServerClient();
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

  const serverDraft = await loadFormDraft(supabase, user.id, {
    entityType: "quote",
    entityId: null,
    scopeId: null,
  });

  return (
    <div className="space-y-5">
      <QuoteForm
        listings={list}
        variant="page"
        userId={user.id}
        serverDraft={serverDraft}
      />
    </div>
  );
}
