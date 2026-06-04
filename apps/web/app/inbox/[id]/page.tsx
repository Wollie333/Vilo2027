import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Role-agnostic inbox deep link. Notifications (and mobile push) point at
// /inbox/[conversationId]; there's no shared inbox on web, so resolve the
// viewer and forward them to the right one — guests to the portal thread,
// hosts/staff to the dashboard inbox with the conversation pre-selected.
export default async function InboxRedirect({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/inbox/${params.id}`);

  // RLS only returns the row to a participant (host or guest). If the viewer is
  // the guest on this conversation, send them to the portal thread.
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, guest_id")
    .eq("id", params.id)
    .maybeSingle();

  if (conv && conv.guest_id === user.id) {
    redirect(`/portal/inbox/${params.id}`);
  }
  redirect(`/dashboard/inbox?c=${params.id}`);
}
