import { redirect } from "next/navigation";

import { getBrandName } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { AcceptInvite } from "./AcceptInvite";

export const dynamic = "force-dynamic";

function Shell({
  brand,
  children,
}: {
  brand: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-light p-6">
      <div className="w-full max-w-md rounded-card border border-brand-line bg-white p-7 shadow-card">
        <h1 className="font-display text-xl font-bold text-brand-ink">
          {brand} admin invite
        </h1>
        <div className="mt-4 space-y-4 text-[14px] text-brand-ink">
          {children}
        </div>
      </div>
    </main>
  );
}

export default async function StaffInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const brand = await getBrandName();

  if (!token) {
    return (
      <Shell brand={brand}>
        <p className="text-brand-mute">
          This invite link is missing its token.
        </p>
      </Shell>
    );
  }

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("platform_staff_invites")
    .select("email, role_id, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle();

  let problem: string | null = null;
  if (!invite) problem = "This invite link is invalid.";
  else if (invite.accepted_at) problem = "This invite has already been used.";
  else if (new Date(invite.expires_at) < new Date())
    problem = "This invite has expired. Ask an admin to send a new one.";

  if (problem || !invite) {
    return (
      <Shell brand={brand}>
        <p className="text-brand-mute">{problem}</p>
      </Shell>
    );
  }

  // Must be signed in to accept (the staff row links to the user account). Send
  // to login with a return path; new teammates can register with the invited email.
  const sb = createServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const nextPath = `/staff-invite?token=${token}`;
  if (!user) {
    // Not signed in — send to login pre-filled with the invited email so they
    // sign in (or register) as the right account, then return here to auto-accept.
    redirect(
      `/login?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(nextPath)}`,
    );
  }

  // Compare against the profile email (the accept action does the same), so the
  // page and the server action agree on whether this is the right account.
  const { data: profile } = await admin
    .from("user_profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();
  const userEmail = (profile?.email ?? user.email ?? "").toLowerCase();
  const matches = userEmail === invite.email.toLowerCase();

  return (
    <Shell brand={brand}>
      <p>
        You&apos;ve been invited to join the {brand} admin team as{" "}
        <strong>{invite.role_id}</strong>.
      </p>
      {matches ? (
        <p className="text-[13px] text-brand-mute">
          Invite for <strong>{invite.email}</strong> — activating your access
          now.
        </p>
      ) : (
        <p className="text-[13px] text-brand-mute">
          This invite is for <strong>{invite.email}</strong>, but you&apos;re
          signed in as {userEmail}. Continue below to switch accounts.
        </p>
      )}
      <AcceptInvite
        token={token}
        inviteEmail={invite.email}
        matches={matches}
      />
    </Shell>
  );
}
