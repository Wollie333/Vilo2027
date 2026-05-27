import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Users } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import { StaffManager } from "./StaffManager";
import { STAFF_ROLE_LABEL, type StaffRole } from "./schemas";

export const metadata: Metadata = {
  title: "Staff · Vilo",
};

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/staff");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!host) {
    return (
      <div>
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <Users className="h-6 w-6" />
          </div>
          <h1 className="font-display text-lg font-bold text-brand-ink">
            Create your host profile first
          </h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Finish host onboarding before inviting staff.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: members }, { data: invites }, { data: featureRaw }] =
    await Promise.all([
      supabase
        .from("staff_members")
        .select(
          "id, role, created_at, user:user_profiles!staff_members_user_id_fkey ( id, full_name, email, avatar_url )",
        )
        .eq("host_id", host.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("staff_invites")
        .select("id, email, role, expires_at, accepted_at, created_at, token")
        .eq("host_id", host.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
      supabase.rpc("check_feature_permission", {
        p_host_id: host.id,
        p_feature_key: "staff_seats",
      }),
    ]);

  const feature = featureRaw as {
    is_enabled: boolean;
    limit_value: number | null;
  } | null;
  const seatLimit = feature?.is_enabled ? (feature.limit_value ?? 0) : 0;
  const activeMembers = members ?? [];
  const pendingInvites = (invites ?? []).filter(
    (i) => new Date(i.expires_at) > new Date(),
  );
  const used = activeMembers.length + pendingInvites.length;

  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const hostUrl = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const inviteBase = `${proto}://${hostUrl}/staff/accept/`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Staff &amp; co-hosts
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Invite people to help run your listings. Each role grants the access
          they need — nothing more.
        </p>
      </header>

      <SeatBanner used={used} limit={seatLimit} />

      <StaffManager
        members={activeMembers.map((m) => {
          const u = Array.isArray(m.user)
            ? m.user[0]
            : (m.user as {
                id: string;
                full_name: string | null;
                email: string | null;
                avatar_url: string | null;
              } | null);
          return {
            id: m.id,
            role: m.role as StaffRole,
            createdAt: m.created_at,
            fullName: u?.full_name ?? null,
            email: u?.email ?? null,
            avatarUrl: u?.avatar_url ?? null,
          };
        })}
        invites={pendingInvites.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role as StaffRole,
          expiresAt: i.expires_at,
          createdAt: i.created_at,
          url: `${inviteBase}${i.token}`,
        }))}
        seatLimit={seatLimit}
        used={used}
        inviteBaseUrl={inviteBase}
      />

      <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-brand-ink">
          What each role can do
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          {(["co_host", "assistant", "cleaner"] as const).map((r) => (
            <div key={r} className="flex gap-4">
              <dt className="w-24 shrink-0 font-display text-sm font-semibold text-brand-ink">
                {STAFF_ROLE_LABEL[r]}
              </dt>
              <dd className="text-brand-mute">
                {r === "co_host"
                  ? "Full operational access — bookings, listings, inbox, calendar. Can't change billing or delete the host account."
                  : r === "assistant"
                    ? "Handles bookings and inbox replies. Read-only on listings."
                    : "Updates the calendar (block / unblock dates) and reads bookings. No inbox access."}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11px] text-brand-mute">
          Narrower per-role access lands in a follow-up — for v1, every role
          shares the same RLS as the host across bookings, inbox, calendar and
          listings.
        </p>
      </div>
    </div>
  );
}

function SeatBanner({ used, limit }: { used: number; limit: number }) {
  if (limit < 1) {
    return (
      <div className="rounded-card border border-brand-line bg-brand-light/60 p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display text-base font-bold text-brand-ink">
              Staff seats aren&rsquo;t on your plan yet
            </div>
            <p className="mt-1 text-sm text-brand-mute">
              Basic adds 1 seat, Pro adds 3, Business adds 10.
            </p>
          </div>
          <a
            href="/dashboard/settings"
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-secondary"
          >
            Upgrade plan
          </a>
        </div>
      </div>
    );
  }
  const tone = used >= limit ? "text-status-cancelled" : "text-brand-primary";
  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <span className="font-display text-base font-bold text-brand-ink">
            {used} of {limit}
          </span>{" "}
          <span className="text-brand-mute">seats used</span>
        </div>
        <span className={`text-xs font-medium ${tone}`}>
          {used >= limit
            ? "Seat limit reached — upgrade to add more."
            : `${limit - used} seat${limit - used === 1 ? "" : "s"} remaining.`}
        </span>
      </div>
    </div>
  );
}
