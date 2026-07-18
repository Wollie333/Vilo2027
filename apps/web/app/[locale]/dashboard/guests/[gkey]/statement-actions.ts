"use server";

import { z } from "zod";

import { routing } from "@/i18n/routing";
import { requireHost } from "@/lib/host/current";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/send";
import {
  signStatementToken,
  type StatementToken,
} from "@/lib/finance/statement-token";

// Host → Guest Statement of Account (F4). Mints an ephemeral signed link over
// the host↔guest ledger (no doc number, no stored row). "Build" returns the
// path for the host to open/download; "Send" emails the guest the link and
// posts it into their thread when one exists.

const rangeSchema = z.object({
  gkey: z.string().min(1),
  from: z.string().datetime().nullable().optional(),
  to: z.string().datetime().nullable().optional(),
});

type BuildResult =
  | { ok: true; path: string; guestName: string; guestEmail: string | null }
  | { ok: false; error: string };

async function mint(input: {
  gkey: string;
  from?: string | null;
  to?: string | null;
}): Promise<
  | {
      ok: true;
      path: string;
      guestName: string;
      guestEmail: string | null;
      admin: ReturnType<typeof createAdminClient>;
      hostId: string;
    }
  | { ok: false; error: string }
> {
  const parsed = rangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const host = await requireHost();
  if (!host.ok) return { ok: false, error: host.error };

  const admin = createAdminClient();
  // Ownership + identity check (the RPC is ownership-scoped to this host).
  const { data: rec } = await admin.rpc("fetch_guest_record", {
    p_host_id: host.hostId,
    p_gkey: parsed.data.gkey,
  });
  const guest = rec as {
    name?: string | null;
    email?: string | null;
    error?: string;
  } | null;
  if (!guest || guest.error) {
    return { ok: false, error: "Guest not found." };
  }

  // Statement currency = the host's settlement currency (Model 2), not a
  // hard-coded ZAR — a EUR/GBP host's statement must read in their currency.
  const { data: hostRow } = await admin
    .from("hosts")
    .select("default_currency")
    .eq("id", host.hostId)
    .maybeSingle();

  const issuedAt = new Date().toISOString();
  const token: StatementToken = {
    v: 1,
    ctx: "host_guest",
    hostId: host.hostId,
    gkey: parsed.data.gkey,
    from: parsed.data.from ?? null,
    to: parsed.data.to ?? issuedAt,
    issuedAt,
    currency: hostRow?.default_currency ?? "ZAR",
  };
  // Locale-prefixed so an absolute open (window.open) / emailed link resolves —
  // the /statement route lives under [locale], so a bare /statement/… is a 404.
  const path = `/${routing.defaultLocale}/statement/${signStatementToken(token)}`;
  return {
    ok: true,
    path,
    guestName: guest.name || "Guest",
    guestEmail: guest.email ?? null,
    admin,
    hostId: host.hostId,
  };
}

export async function buildGuestStatementAction(input: {
  gkey: string;
  from?: string | null;
  to?: string | null;
}): Promise<BuildResult> {
  const r = await mint(input);
  if (!r.ok) return r;
  return {
    ok: true,
    path: r.path,
    guestName: r.guestName,
    guestEmail: r.guestEmail,
  };
}

const sendSchema = rangeSchema.extend({
  origin: z.string().url(),
});

export async function sendGuestStatementAction(input: {
  gkey: string;
  from?: string | null;
  to?: string | null;
  origin: string;
}): Promise<
  { ok: true; emailed: boolean; posted: boolean } | { ok: false; error: string }
> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const r = await mint(input);
  if (!r.ok) return r;

  const url = `${parsed.data.origin.replace(/\/$/, "")}${r.path}`;

  // Email the guest the link (the reliable channel).
  let emailed = false;
  if (r.guestEmail) {
    const res = await sendTransactionalEmail({
      to: r.guestEmail,
      subject: "Your statement of account",
      html: `<p>Hi ${escapeHtml(r.guestName)},</p><p>Here is your statement of account:</p><p><a href="${url}">View your statement</a></p><p>This is a summary of your account activity — a running balance, not a tax invoice.</p>`,
    });
    emailed = res.ok;
  }

  // Best-effort: post into the host↔guest thread when one already exists.
  let posted = false;
  try {
    const { data: rec } = await r.admin.rpc("fetch_guest_record", {
      p_host_id: r.hostId,
      p_gkey: parsed.data.gkey,
    });
    const guest = rec as { guest_id?: string | null; email?: string | null };
    const guestUserIds = new Set<string>();
    if (guest?.guest_id) guestUserIds.add(guest.guest_id);
    if (guest?.email) {
      const { data: same } = await r.admin
        .from("user_profiles")
        .select("id")
        .ilike("email", guest.email);
      for (const p of same ?? []) guestUserIds.add(p.id as string);
    }
    if (guestUserIds.size > 0) {
      const { data: conv } = await r.admin
        .from("conversations")
        .select("id")
        .eq("host_id", r.hostId)
        .in("guest_id", [...guestUserIds])
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (conv?.id) {
        const { data: host } = await r.admin
          .from("hosts")
          .select("user_id")
          .eq("id", r.hostId)
          .maybeSingle();
        await r.admin.from("messages").insert({
          conversation_id: conv.id,
          sender_id: host?.user_id ?? null,
          body: `Here is your statement of account: ${url}`,
          read_by_host: true,
        });
        posted = true;
      }
    }
  } catch {
    // best-effort; email is the primary channel
  }

  if (!emailed && !posted) {
    return {
      ok: false,
      error: "Couldn't reach this guest — no email or message thread on file.",
    };
  }
  return { ok: true, emailed, posted };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
