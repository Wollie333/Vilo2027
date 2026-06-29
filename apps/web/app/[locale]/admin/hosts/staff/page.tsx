import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { HostStaffGlobalList } from "./HostStaffGlobalList";

export const dynamic = "force-dynamic";

export default async function AdminHostStaffPage() {
  await requirePermission("hosts.verify");
  const service = createAdminClient();

  const { data } = await service
    .from("staff_members")
    .select(
      "host_id, user_id, created_at, hosts!staff_members_host_id_fkey(display_name, handle), user_profiles!staff_members_user_id_fkey(email, full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []).map((r) => {
    const h = r.hosts as {
      display_name?: string | null;
      handle?: string | null;
    } | null;
    const u = r.user_profiles as {
      email?: string | null;
      full_name?: string | null;
    } | null;
    return {
      hostId: r.host_id,
      userId: r.user_id,
      hostName: h?.display_name ?? null,
      hostHandle: h?.handle ?? null,
      email: u?.email ?? null,
      fullName: u?.full_name ?? null,
      createdAt: r.created_at as string,
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Host staff
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Every user assigned as staff to a host across the platform. Add staff
          from a host&apos;s own page.
        </p>
      </header>
      <HostStaffGlobalList rows={rows} />
    </div>
  );
}
