import { redirect } from "next/navigation";

import {
  ensureWieloGuestThread,
  ensureWieloThread,
} from "@/lib/inbox/platform-thread";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

// Canonical "Get help / Support" entry point. Every in-app help/support button
// links here; we find-or-create the signed-in user's direct **Wielo Support**
// inbox thread and drop them straight into it (host → /dashboard/inbox, guest →
// /portal/inbox). Logged-out users are sent to sign in first.
export const dynamic = "force-dynamic";

export default async function SupportRedirectPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/support");

  const admin = createAdminClient();

  // A host (owns a live host record) → their host↔Wielo thread in the dashboard
  // inbox; everyone else → their guest↔Wielo thread in the portal inbox.
  const { data: host } = await admin
    .from("hosts")
    .select("id, user_id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (host) {
    const convId = await ensureWieloThread(admin, {
      id: host.id as string,
      userId: user.id,
    });
    redirect(`/dashboard/inbox?c=${convId}`);
  }

  const convId = await ensureWieloGuestThread(admin, user.id);
  redirect(`/portal/inbox/${convId}`);
}
