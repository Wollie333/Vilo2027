import type { Metadata } from "next";

import {
  NotificationsList,
  type ListNotification,
} from "@/components/notifications/NotificationsList";
import { requireAdmin } from "@/lib/admin";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Notifications",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

// Staff "view all" notifications page — the admin twin of the host/guest
// /dashboard|portal/notifications page. Same in_app_notifications table, same
// NotificationsList component; RLS (user_id = auth.uid()) scopes it to the
// signed-in staff member's own rows, so no per-role filtering is needed here.
export default async function AdminNotificationsPage() {
  // requireAdmin gates the whole /admin subtree already; this is defence-in-depth
  // and gives us the authenticated user id for the seed query.
  const admin = await requireAdmin();
  const supabase = createServerClient();

  const { data } = await supabase
    .from("in_app_notifications")
    .select(
      "id, kind, title, body, link, read_at, created_at, category_id, severity, payload",
    )
    .eq("user_id", admin.userId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  const initial = (data ?? []) as ListNotification[];

  return (
    <section>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-brand-ink md:text-3xl">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Everything the platform has sent you as a staff member — partner
          payouts, competition results to settle, refunds and system alerts.
          Filter by category, mark items read, or open them to jump to the
          related screen.
        </p>
      </header>
      <NotificationsList initial={initial} />
    </section>
  );
}
