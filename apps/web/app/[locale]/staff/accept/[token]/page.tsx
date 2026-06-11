import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

import { CircleAlert, CircleSlash, UserCheck } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  STAFF_ROLE_LABEL,
  type StaffRole,
} from "../../../dashboard/staff/schemas";

import { AcceptButton } from "./AcceptButton";

export const metadata: Metadata = {
  title: "Join the team",
};

export const dynamic = "force-dynamic";

export default async function StaffAcceptPage({
  params,
}: {
  params: { token: string };
}) {
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("staff_invites")
    .select(
      "id, host_id, email, role, expires_at, accepted_at, host:hosts!staff_invites_host_id_fkey ( display_name, handle )",
    )
    .eq("token", params.token)
    .maybeSingle();

  if (!invite) {
    return <Shell tone="error" message="This invite link isn't valid." />;
  }
  if (invite.accepted_at) {
    return (
      <Shell
        tone="info"
        message="This invite has already been used."
        cta={{ href: "/dashboard", label: "Go to dashboard" }}
      />
    );
  }
  if (new Date(invite.expires_at) < new Date()) {
    return (
      <Shell
        tone="error"
        message="This invite has expired. Ask the host to send a fresh one."
      />
    );
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed out → bounce to /register with the email + token so registration
  // can hand back here once auth lands.
  if (!user) {
    const qs = new URLSearchParams({
      email: invite.email,
      invite_token: params.token,
      next: `/staff/accept/${params.token}`,
    });
    redirect(`/register?${qs.toString()}`);
  }

  // Signed in with a different email → ask them to re-auth.
  const profileEmail = (user.email ?? "").toLowerCase();
  if (profileEmail !== invite.email.toLowerCase()) {
    return (
      <Shell
        tone="error"
        message={`This invite is for ${invite.email}. Sign in with that account to accept.`}
        cta={{ href: "/login", label: "Switch account" }}
      />
    );
  }

  const hostObj = Array.isArray(invite.host)
    ? invite.host[0]
    : (invite.host as { display_name?: string; handle?: string } | null);

  return (
    <div className="min-h-screen bg-brand-light px-4 py-10">
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded bg-brand-primary text-2xl font-bold text-white">
            V
          </div>
          <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Staff invite
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Join {hostObj?.display_name ?? "the team"}
          </h1>
          <p className="mt-2 text-sm text-brand-mute">
            You&rsquo;ll join as a{" "}
            <span className="font-medium text-brand-ink">
              {STAFF_ROLE_LABEL[invite.role as StaffRole]}
            </span>
            {hostObj?.handle ? (
              <> on @{hostObj.handle}&rsquo;s host account.</>
            ) : (
              "."
            )}
          </p>
        </header>

        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <dl className="space-y-2 text-sm">
            <Row label="Email" value={invite.email} />
            <Row
              label="Role"
              value={STAFF_ROLE_LABEL[invite.role as StaffRole]}
            />
            <Row label="Host" value={hostObj?.display_name ?? "—"} />
            <Row
              label="Expires"
              value={new Date(invite.expires_at).toLocaleDateString("en-ZA")}
            />
          </dl>
        </div>

        <AcceptButton token={params.token} />

        <p className="text-center text-[11px] text-brand-mute">
          Joining shares the host&rsquo;s bookings, calendar and inbox with you.
          You can leave at any time from your account settings.
        </p>
      </div>
    </div>
  );
}

function Shell({
  tone,
  message,
  cta,
}: {
  tone: "info" | "error";
  message: string;
  cta?: { href: string; label: string };
}) {
  const Icon = tone === "error" ? CircleSlash : CircleAlert;
  return (
    <div className="min-h-screen bg-brand-light px-4 py-10">
      <div className="mx-auto max-w-md space-y-4 text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded bg-brand-primary text-2xl font-bold text-white">
          V
        </div>
        <Icon
          className={`mx-auto h-8 w-8 ${
            tone === "error" ? "text-status-cancelled" : "text-status-pending"
          }`}
        />
        <p className="text-sm text-brand-ink">{message}</p>
        {cta ? (
          <Link
            href={cta.href}
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
          >
            <UserCheck className="h-4 w-4" />
            {cta.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[10px] uppercase tracking-wider text-brand-mute">
        {label}
      </dt>
      <dd className="font-medium text-brand-ink">{value}</dd>
    </div>
  );
}
