"use client";

import { Mail, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  changeStaffRole,
  inviteStaff,
  revokeInvite,
  setStaffActive,
} from "./actions";

type Role = { id: string; name: string };
type Staff = {
  user_id: string;
  role_id: string;
  is_active: boolean;
  accepted_at: string | null;
  email: string | null;
  full_name: string | null;
};
type Invite = {
  id: string;
  email: string;
  role_id: string;
  expires_at: string;
};

export function StaffManager({
  staff,
  invites,
  roles,
}: {
  staff: Staff[];
  invites: Invite[];
  roles: Role[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [pending, start] = useTransition();

  function run(p: Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await p;
      if (res.ok) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed.");
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Invite */}
      <section className="rounded-card border border-brand-line bg-white p-4">
        <h2 className="mb-3 flex items-center gap-1.5 font-display text-base font-semibold text-brand-ink">
          <UserPlus className="h-4 w-4 text-brand-primary" /> Invite a teammate
        </h2>
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="min-w-[220px] flex-1">
            <label className="block text-[12px] font-semibold text-brand-ink">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="mt-1 w-full rounded-[10px] border border-brand-line px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-brand-ink">
              Role
            </label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="mt-1 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={pending || !email.trim() || !roleId}
            onClick={() => {
              run(inviteStaff({ email: email.trim(), roleId }), "Invite sent.");
              setEmail("");
            }}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-50"
          >
            <Mail className="h-4 w-4" /> Send invite
          </button>
        </div>
      </section>

      {/* Active staff */}
      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-brand-ink">
          Staff
        </h2>
        <div className="overflow-hidden rounded-card border border-brand-line bg-white">
          <table className="w-full text-[13px]">
            <thead className="border-b border-brand-line text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]">
              <tr>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr
                  key={s.user_id}
                  className="border-b border-brand-line last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium text-brand-ink">
                    {s.email ?? s.user_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={s.role_id}
                      disabled={pending}
                      onChange={(e) =>
                        run(
                          changeStaffRole({
                            userId: s.user_id,
                            roleId: e.target.value,
                          }),
                          "Role updated.",
                        )
                      }
                      className="rounded border border-brand-line bg-white px-2 py-1 text-[12px] text-brand-ink outline-none focus:border-brand-primary"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
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
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          setStaffActive({
                            userId: s.user_id,
                            isActive: !s.is_active,
                          }),
                          s.is_active ? "Deactivated." : "Reactivated.",
                        )
                      }
                      className="rounded border border-brand-line bg-white px-2.5 py-1 text-[12px] font-medium text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
                    >
                      {s.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
              {staff.length === 0 ? (
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

      {/* Pending invites */}
      {invites.length > 0 ? (
        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-brand-ink">
            Pending invites
          </h2>
          <div className="overflow-hidden rounded-card border border-brand-line bg-white">
            <table className="w-full text-[13px]">
              <thead className="border-b border-brand-line text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]">
                <tr>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Expires</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
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
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(
                            revokeInvite({ inviteId: inv.id }),
                            "Invite revoked.",
                          )
                        }
                        className="inline-flex items-center gap-1 rounded border border-brand-line bg-white px-2.5 py-1 text-[12px] font-medium text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink disabled:opacity-50"
                      >
                        <X className="h-3 w-3" /> Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
