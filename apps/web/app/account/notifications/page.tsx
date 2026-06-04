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

// Guest-side notifications view. Mirrors /dashboard/notifications but
// rendered inside the public /account chrome (no host sidebar).

export default async function GuestNotificationsListPage() {
  const brandName = await getBrandName();
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-brand-mute">
          Sign in to view your notifications.
        </p>
      </section>
    );
  }

  const { data } = await supabase
    .from("in_app_notifications")
    .select(
      "id, kind, title, body, link, read_at, created_at, category_id, severity, payload",
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  const initial = (data ?? []) as ListNotification[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BroadcastBanner />
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-brand-ink md:text-3xl">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Trip confirmations, refunds, reviews and announcements from{" "}
          {brandName}.
        </p>
      </header>
      <NotificationsList initial={initial} />
    </div>
  );
}
