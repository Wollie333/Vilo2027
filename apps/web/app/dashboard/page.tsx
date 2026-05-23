import type { Metadata } from "next";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

import { WelcomeToast } from "./WelcomeToast";

export const metadata: Metadata = {
  title: "Dashboard · Vilo",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { welcome?: string };
}) {
  // Layout already enforces auth + fetches user/host. We re-fetch the
  // listings + the welcome-banner state here.
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: host }, { data: listings }] = await Promise.all([
    supabase
      .from("hosts")
      .select("id, handle, display_name")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("listings")
      .select("id, name, is_published")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const justOnboarded = searchParams?.welcome === "1";
  const needsOnboarding = !host;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {justOnboarded ? <WelcomeToast /> : null}

      {/* Welcome strip */}
      <section className="-mt-1 flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            {host
              ? `Welcome back, ${host.display_name.split(" ")[0]}.`
              : "Welcome to Vilo."}
          </h2>
          <p className="mt-1 text-sm text-brand-mute">
            {host
              ? `Your Vilo URL is viloplatform.com/${host.handle}.`
              : "Finish onboarding to take your first booking."}
          </p>
        </div>
      </section>

      {needsOnboarding ? (
        <Link
          href="/signup/host"
          className="flex items-start gap-4 rounded-card border border-brand-primary/40 bg-brand-accent/60 p-5 shadow-card transition-colors hover:bg-brand-accent"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-white text-brand-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-display font-semibold text-brand-dark">
              Finish setting up your host profile
            </div>
            <p className="mt-0.5 text-sm text-brand-mute">
              Five quick steps — handle, listing type, first listing, plan.
              Until then your guests can&rsquo;t book you.
            </p>
          </div>
          <ArrowRight className="mt-2 h-5 w-5 shrink-0 text-brand-primary" />
        </Link>
      ) : null}

      {host && listings && listings.length > 0 ? (
        <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Your listings
              </div>
              <div className="mt-1 font-display text-lg font-semibold text-brand-ink">
                {listings.length}{" "}
                {listings.length === 1 ? "listing" : "listings"}
              </div>
            </div>
            <Link
              href="/dashboard/listings"
              className="text-xs font-medium text-brand-primary hover:underline"
            >
              See all →
            </Link>
          </div>
          <ul className="divide-y divide-brand-line rounded-card border border-brand-line">
            {listings.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-brand-dark">
                    {l.name}
                  </div>
                </div>
                <span
                  className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${
                    l.is_published
                      ? "bg-green-100 text-green-800"
                      : "bg-brand-line text-brand-mute"
                  }`}
                >
                  {l.is_published ? "Published" : "Draft"}
                </span>
                <Link
                  href={`/dashboard/listings/${l.id}/edit`}
                  className="text-xs font-medium text-brand-primary hover:underline"
                >
                  Edit →
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-brand-mute">
            Edit any listing to set photos, location, rooms, amenities, pricing
            and policies. Publish flips it live for guests.
          </p>
        </section>
      ) : null}

      {/* Empty-state placeholders matching the new chrome layout */}
      {host && (!listings || listings.length === 0) ? (
        <section className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="font-display text-lg font-bold text-brand-ink">
            No listings yet
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Your first listing was created during onboarding. If you removed it,
            you can create another from the Listings page.
          </p>
        </section>
      ) : null}
    </div>
  );
}
