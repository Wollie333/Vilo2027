import type { Metadata } from "next";

import { BroadcastBanner } from "@/app/_components/BroadcastBanner";
import {
  NotificationsList,
  type ListNotification,
} from "@/components/notifications/NotificationsList";
import { getBrandName } from "@/lib/brand";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Notifications",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

// Guest notifications inbox, rendered inside the portal shell. Relocated from
// the orphaned /account/notifications route.
export default async function PortalNotificationsPage() {
  const brandName = await getBrandName();
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("in_app_notifications")
    .select(
      "id, kind, title, body, link, read_at, created_at, category_id, severity, payload",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  const initial = (data ?? []) as ListNotification[];

  return (
    <div>
      <BroadcastBanner />
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">
          Notifications
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          Trip confirmations, refunds, reviews and announcements from{" "}
          {brandName}.
        </p>
      </header>
      <NotificationsList initial={initial} />
    </div>
  );
}
