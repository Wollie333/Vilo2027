import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ShieldCheck } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import { PolicyManager, type PolicyCard } from "./PolicyManager";
import { isLockedPreset, type PolicyType } from "./schemas";

export const metadata: Metadata = {
  title: "Policies · Vilo",
};

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/policies");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!host) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="font-display text-lg font-bold text-brand-ink">
          Create your host profile first
        </h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
          Finish host onboarding before setting up policies.
        </p>
      </div>
    );
  }

  // Materialise the locked refund presets for this host (idempotent).
  await supabase.rpc("ensure_host_policy_presets", { p_host_id: host.id });

  const { data: policies } = await supabase
    .from("policies")
    .select(
      "id, type, name, summary, preset, is_non_refundable, check_in_time, check_out_time, status",
    )
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .in("status", ["active", "draft"])
    .order("type", { ascending: true })
    .order("created_at", { ascending: true });

  const ids = (policies ?? []).map((p) => p.id);

  const [{ data: rules }, { data: content }] =
    ids.length > 0
      ? await Promise.all([
          supabase
            .from("policy_cancellation_rules")
            .select("policy_id, days_before, refund_percent, label, sort_order")
            .in("policy_id", ids)
            .order("days_before", { ascending: false }),
          supabase
            .from("policy_content")
            .select("policy_id, body_html")
            .in("policy_id", ids)
            .eq("locale", "en"),
        ])
      : [{ data: [] }, { data: [] }];

  const rulesByPolicy = new Map<
    string,
    { days_before: number; refund_percent: number; label: string }[]
  >();
  (rules ?? []).forEach((r) => {
    const arr = rulesByPolicy.get(r.policy_id) ?? [];
    arr.push({
      days_before: r.days_before,
      refund_percent: r.refund_percent,
      label: r.label,
    });
    rulesByPolicy.set(r.policy_id, arr);
  });

  const bodyByPolicy = new Map<string, string>();
  (content ?? []).forEach((c) => {
    if (c.body_html) bodyByPolicy.set(c.policy_id, c.body_html);
  });

  const cards: PolicyCard[] = (policies ?? []).map((p) => ({
    id: p.id,
    type: p.type as PolicyType,
    name: p.name,
    summary: p.summary,
    preset: p.preset,
    locked: isLockedPreset(p.preset),
    isNonRefundable: p.is_non_refundable,
    checkInTime: p.check_in_time,
    checkOutTime: p.check_out_time,
    rules: rulesByPolicy.get(p.id) ?? [],
    bodyHtml: bodyByPolicy.get(p.id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Policies
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-mute">
          Create refund terms, check-in/out times and house rules once, then
          assign them to a whole listing or individual rooms from the listing
          editor. Guests can read the full policy at checkout.
        </p>
      </header>

      <PolicyManager initial={cards} />
    </div>
  );
}
