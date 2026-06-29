import { redirect } from "next/navigation";
import { Search } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";
import { hostHasFeature } from "@/lib/products/featureGate";

import { LookingForLocked } from "./_components/LookingForLocked";
import { RequestsBoard } from "./_components/RequestsBoard";
import { QuotaWidget } from "./_components/QuotaWidget";

export default async function LookingForBrowsePage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/looking-for");
  }

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!host) {
    redirect("/dashboard");
  }

  const canLookingFor = await hostHasFeature(host.id, "looking_for_access");

  if (!canLookingFor) {
    return (
      <div className="space-y-6">
        <LookingForHeader />
        <LookingForLocked />
      </div>
    );
  }

  // Fetch quota status for the host
  const { data: quotaStatus } = await supabase.rpc("check_host_quote_quota", {
    p_host_id: host.id,
  });

  return (
    <div className="space-y-6">
      <LookingForHeader />
      <QuotaWidget
        remainingToday={quotaStatus?.remaining_today ?? 0}
        remainingMonth={quotaStatus?.remaining_month ?? 0}
        allowed={quotaStatus?.allowed ?? true}
      />
      <RequestsBoard hostId={host.id} />
    </div>
  );
}

function LookingForHeader() {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
        <Search className="h-6 w-6" />
      </div>
      <div>
        <h1 className="font-display text-xl font-bold text-brand-ink">
          Looking For
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Browse what travellers are looking for and send them personalised
          quotes
        </p>
      </div>
    </div>
  );
}
