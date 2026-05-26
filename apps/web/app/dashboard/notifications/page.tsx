import type { Metadata } from "next";

import {
  NotificationsList,
  type ListNotification,
} from "@/components/notifications/NotificationsList";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Notifications · Vilo",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function DashboardNotificationsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout already redirects unauthenticated users; we still defend here.
  if (!user) {
    return (
      <section>
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
    <section className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-brand-ink md:text-3xl">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Everything Vilo has sent you — bookings, payments, announcements and
          more. Filter by category, mark items read, or open them to jump to the
          related page.
        </p>
      </header>
      <NotificationsList initial={initial} />
    </section>
  );
}
