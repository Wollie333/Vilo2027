import { redirect } from "next/navigation";
import { Bell } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";
import { hostHasFeature } from "@/lib/products/featureGate";
import { LookingForLocked } from "../_components/LookingForLocked";
import { AlertsManager } from "./AlertsManager";

export default async function RequestAlertsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/looking-for/alerts");
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
        <AlertsHeader />
        <LookingForLocked />
      </div>
    );
  }

  // Fetch saved search alerts
  const { data: alerts } = await supabase
    .from("looking_for_alerts")
    .select(
      `
      id,
      name,
      category,
      location_region,
      min_budget,
      max_budget,
      min_guests,
      max_guests,
      check_in_from,
      check_in_to,
      is_active,
      match_count,
      last_notified_at,
      created_at
    `,
    )
    .eq("host_id", host.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <AlertsHeader />
      <AlertsManager hostId={host.id} initialAlerts={alerts ?? []} />
    </div>
  );
}

function AlertsHeader() {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
        <Bell className="h-6 w-6" />
      </div>
      <div>
        <h1 className="font-display text-xl font-bold text-brand-ink">
          Request Alerts
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Get notified when new guest requests match your criteria
        </p>
      </div>
    </div>
  );
}
