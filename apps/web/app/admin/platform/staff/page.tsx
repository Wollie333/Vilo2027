import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function PlatformStaffPage() {
  await requirePermission("platform.staff");
  const service = createAdminClient();

  const [{ data: staff }, { data: invites }, { data: roles }] =
    await Promise.all([
      service
        .from("platform_staff")
        .select(
          "user_id, role_id, is_active, accepted_at, last_active_at, created_at, user_profiles(email, full_name)",
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
          Vilo staff
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Invite teammates, assign roles, deactivate access. MFA enrolment is
          required before a staff row activates — Phase E ships the full invite
          UI.
        </p>
      </header>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-brand-ink">
          Active staff
        </h2>
        <div className="overflow-hidden rounded-card border border-brand-line bg-white">
          <table className="w-full text-[13px]">
            <thead className="border-b border-brand-line bg-brand-light text-left text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              <tr>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Joined</th>
              </tr>
            </thead>
            <tbody>
              {(staff ?? []).map((s) => {
                const profile = s.user_profiles as {
                  email?: string | null;
                  full_name?: string | null;
                } | null;
                return (
                  <tr
                    key={s.user_id}
                    className="border-b border-brand-line last:border-0"
                  >
                    <td className="px-4 py-2.5 font-medium text-brand-ink">
                      {profile?.email ?? s.user_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-brand-mute">
                      {s.role_id}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.is_active ? (
                        <span className="rounded-pill bg-status-confirmed/10 px-2 py-0.5 text-[11px] font-semibold text-status-confirmed">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-pill bg-brand-mute/15 px-2 py-0.5 text-[11px] font-semibold text-brand-mute">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-brand-mute">
                      {s.accepted_at
                        ? new Date(s.accepted_at).toLocaleDateString("en-ZA", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {(staff ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-brand-mute"
                  >
                    No staff members yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {(invites ?? []).length > 0 ? (
        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-brand-ink">
            Pending invites
          </h2>
          <div className="overflow-hidden rounded-card border border-brand-line bg-white">
            <table className="w-full text-[13px]">
              <thead className="border-b border-brand-line bg-brand-light text-left text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                <tr>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Expires</th>
                </tr>
              </thead>
              <tbody>
                {(invites ?? []).map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-brand-line last:border-0"
                  >
                    <td className="px-4 py-2.5 font-medium text-brand-ink">
                      {inv.email}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-brand-mute">
                      {inv.role_id}
                    </td>
                    <td className="px-4 py-2.5 text-brand-mute">
                      {new Date(inv.expires_at).toLocaleString("en-ZA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

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
