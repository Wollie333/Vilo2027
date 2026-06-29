import { redirect } from "next/navigation";
import { Bell, Plus, Trash2, MapPin, Calendar, Users } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";
import { hostHasFeature } from "@/lib/products/featureGate";
import { LookingForLocked } from "../_components/LookingForLocked";
import { Button } from "@/components/ui/button";

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

      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-mute">
          Get notified when new requests match your criteria
        </p>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Alert
        </Button>
      </div>

      {!alerts || alerts.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-mute">
            <Bell className="h-6 w-6" />
          </div>
          <h3 className="font-display text-lg font-semibold text-brand-ink">
            No alerts set up
          </h3>
          <p className="mt-2 text-sm text-brand-mute">
            Create an alert to get notified when guest requests match your
            property.
          </p>
          <Button className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" />
            Create Your First Alert
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start justify-between rounded-card border border-brand-line bg-white p-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-brand-ink">
                    {alert.name ?? "Unnamed Alert"}
                  </h3>
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      alert.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {alert.is_active ? "Active" : "Paused"}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-3 text-sm text-brand-mute">
                  {alert.category && (
                    <span className="flex items-center gap-1">
                      <span className="capitalize">{alert.category}</span>
                    </span>
                  )}
                  {alert.location_region && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {alert.location_region}
                    </span>
                  )}
                  {(alert.min_guests || alert.max_guests) && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {alert.min_guests && alert.max_guests
                        ? `${alert.min_guests}–${alert.max_guests} guests`
                        : alert.min_guests
                          ? `${alert.min_guests}+ guests`
                          : `Up to ${alert.max_guests} guests`}
                    </span>
                  )}
                  {(alert.check_in_from || alert.check_in_to) && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {alert.check_in_from && alert.check_in_to
                        ? `${new Date(alert.check_in_from).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} – ${new Date(alert.check_in_to).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
                        : alert.check_in_from
                          ? `From ${new Date(alert.check_in_from).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
                          : `Until ${new Date(alert.check_in_to!).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs text-brand-mute">
                  {alert.match_count} matches
                  {alert.last_notified_at && (
                    <span>
                      {" "}
                      · Last notified{" "}
                      {new Date(alert.last_notified_at).toLocaleDateString(
                        "en-ZA",
                      )}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-brand-mute">
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
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
