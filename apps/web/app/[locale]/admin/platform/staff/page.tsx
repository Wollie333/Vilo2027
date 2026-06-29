import { requirePermission } from "@/lib/admin";
import { getBrandName } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";

import { StaffManager } from "./StaffManager";

export const dynamic = "force-dynamic";

export default async function PlatformStaffPage() {
  await requirePermission("platform.staff");
  const brandName = await getBrandName();
  const service = createAdminClient();

  const [{ data: staff }, { data: invites }, { data: roles }] =
    await Promise.all([
      service
        .from("platform_staff")
        .select(
          "user_id, role_id, is_active, accepted_at, last_active_at, created_at, user_profiles!platform_staff_user_id_fkey(email, full_name)",
        )
        .order("created_at", { ascending: false }),
      service
        .from("platform_staff_invites")
        .select("id, email, role_id, expires_at, accepted_at, created_at")
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
      service
        .from("admin_roles")
        .select("id, name, description, is_system")
        .order("is_system", { ascending: false }),
    ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          {brandName} staff
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Invite teammates, assign roles, and deactivate access. Invitees accept
          via an emailed link and sign in with the invited email.
        </p>
      </header>

      <StaffManager
        staff={(staff ?? []).map((s) => {
          const profile = s.user_profiles as {
            email?: string | null;
            full_name?: string | null;
          } | null;
          return {
            user_id: s.user_id,
            role_id: s.role_id,
            is_active: s.is_active,
            accepted_at: s.accepted_at,
            email: profile?.email ?? null,
            full_name: profile?.full_name ?? null,
          };
        })}
        invites={(invites ?? []).map((inv) => ({
          id: inv.id,
          email: inv.email,
          role_id: inv.role_id,
          expires_at: inv.expires_at,
        }))}
        roles={(roles ?? []).map((r) => ({ id: r.id, name: r.name }))}
      />

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-brand-ink">
          Available roles
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {(roles ?? []).map((r) => (
            <div
              key={r.id}
              className="rounded-card border border-brand-line bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <div className="font-display font-semibold text-brand-ink">
                  {r.name}
                </div>
                {r.is_system ? (
                  <span className="rounded-pill bg-brand-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-primary">
                    System
                  </span>
                ) : null}
              </div>
              <div className="mt-1 font-mono text-[11px] text-brand-mute">
                {r.id}
              </div>
              {r.description ? (
                <p className="mt-2 text-[12.5px] text-brand-mute">
                  {r.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
