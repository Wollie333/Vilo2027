import type { Metadata } from "next";
import { Crown, ExternalLink } from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Subscription · Settings · Vilo",
};

export const dynamic = "force-dynamic";

export default async function SettingsSubscriptionPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user!.id)
    .maybeSingle();

  let sub: {
    plan: string;
    status: string;
    current_period_end: string | null;
  } | null = null;

  if (host) {
    const { data } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("host_id", host.id)
      .maybeSingle();
    sub = data;
  }

  const planLabel =
    sub?.plan === "free"
      ? "Free"
      : sub?.plan
        ? sub.plan[0].toUpperCase() + sub.plan.slice(1)
        : "—";

  return (
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
                        ? ` until ${new Date(
                            sub.current_period_end,
                          ).toLocaleDateString("en-ZA")}`
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
  );
}
