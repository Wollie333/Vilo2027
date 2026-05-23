import type { Metadata } from "next";
import { ArrowRight, Crown, ExternalLink } from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

import { HostForm } from "./HostForm";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = {
  title: "Settings · Vilo",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: host }, { data: subscription }] =
    await Promise.all([
      supabase
        .from("user_profiles")
        .select("full_name, phone, email, role")
        .eq("id", user!.id)
        .maybeSingle(),
      supabase
        .from("hosts")
        .select("id, display_name, handle, bio, website_url, is_verified")
        .eq("user_id", user!.id)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("plan, status, current_period_end")
        .eq("host_id", "")
        .maybeSingle(),
    ]);

  // Re-fetch subscription with the actual host id if we have one.
  let sub = subscription;
  if (host) {
    const { data: realSub } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("host_id", host.id)
      .maybeSingle();
    sub = realSub;
  }

  const planLabel =
    sub?.plan === "free"
      ? "Free"
      : sub?.plan
        ? sub.plan[0].toUpperCase() + sub.plan.slice(1)
        : "—";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Your account, your public host page, and your plan.
        </p>
      </header>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-brand-ink">
          Your profile
        </h2>
        <ProfileForm
          defaults={{
            full_name: profile?.full_name ?? "",
            phone: profile?.phone ?? "",
          }}
          email={profile?.email ?? user?.email ?? ""}
        />
      </section>

      {host ? (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-brand-ink">
            Public host page
          </h2>
          <HostForm
            defaults={{
              display_name: host.display_name,
              bio: host.bio ?? "",
              website_url: host.website_url ?? "",
            }}
            handle={host.handle}
            isVerified={host.is_verified}
          />
        </section>
      ) : (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-brand-ink">
            Public host page
          </h2>
          <Link
            href="/signup/host"
            className="flex items-start gap-4 rounded-card border border-brand-primary/40 bg-brand-accent/60 p-5 shadow-card transition-colors hover:bg-brand-accent"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-white text-brand-primary">
              <ArrowRight className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-display font-semibold text-brand-dark">
                Finish setting up your host profile
              </div>
              <p className="mt-0.5 text-sm text-brand-mute">
                Without a host page guests can&rsquo;t book you.
              </p>
            </div>
          </Link>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-brand-ink">
          Subscription
        </h2>
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
              <Crown className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-display text-base font-semibold text-brand-ink">
                {planLabel} plan
              </div>
              <div className="mt-0.5 text-sm text-brand-mute">
                {sub?.status === "active"
                  ? sub.plan === "free"
                    ? "Free during beta — direct bookings enabled, no card required."
                    : `Active${
                        sub.current_period_end
                          ? ` until ${new Date(sub.current_period_end).toLocaleDateString("en-ZA")}`
                          : ""
                      }`
                  : "No active plan — finish onboarding to start."}
              </div>
            </div>
            <Link
              href="/booking-management#pricing"
              target="_blank"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-primary hover:underline"
            >
              See plans
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
          <p className="mt-4 rounded border border-brand-line bg-brand-light/60 p-3 text-xs text-brand-mute">
            Paid plans + billing controls land in Phase 3 (subscription
            management). For now everyone starts free.
          </p>
        </div>
      </section>
    </div>
  );
}
