import type { Metadata } from "next";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { SignOutButton } from "./SignOutButton";
import { WelcomeToast } from "./WelcomeToast";

export const metadata: Metadata = {
  title: "Dashboard · Vilo",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { welcome?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: host }, { data: listings }] = await Promise.all([
    supabase
      .from("hosts")
      .select("id, handle, display_name")
      .eq("user_id", user.id)
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
    <main className="min-h-screen bg-brand-light text-brand-ink">
      {justOnboarded ? <WelcomeToast /> : null}

      <div className="mx-auto max-w-3xl px-6 py-16">
        {needsOnboarding ? (
          <Link
            href="/signup/host"
            className="mb-6 flex items-start gap-4 rounded-card border border-brand-primary/40 bg-brand-accent/60 p-5 shadow-card transition-colors hover:bg-brand-accent"
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

        <div className="rounded-card border border-brand-line bg-white p-8 shadow-card">
          <span className="inline-flex items-center gap-2 rounded-pill bg-brand-accent px-3 py-1 text-xs font-medium text-brand-primary">
            <span className="h-1.5 w-1.5 rounded-pill bg-brand-primary" />
            Signed in
          </span>

          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-brand-ink">
            Welcome to Vilo
          </h1>
          <p className="mt-2 text-brand-mute">
            You&rsquo;re signed in as{" "}
            <span className="font-medium text-brand-ink">{user.email}</span>.
            {host ? (
              <>
                {" "}
                Your Vilo handle is{" "}
                <span className="font-mono text-brand-ink">
                  viloplatform.com/{host.handle}
                </span>
                .
              </>
            ) : null}
          </p>

          {host && listings && listings.length > 0 ? (
            <div className="mt-8">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Your listings
              </div>
              <ul className="mt-3 divide-y divide-brand-line rounded-card border border-brand-line">
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
                Edit any listing to set photos, location, rooms, amenities,
                pricing and policies. Publish flips it live for guests.
              </p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <SignOutButton />
          </div>
        </div>
      </div>
    </main>
  );
}
