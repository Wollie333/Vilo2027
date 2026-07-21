import "server-only";

import { Resend } from "resend";

import { getBrandName } from "@/lib/brand";
import { emailFrom } from "@/lib/email/sender";
import { createAdminClient } from "@/lib/supabase/admin";

// Broadcast send — invoked from the sendBroadcastAction Server Action. Mirrors
// the app's existing Resend usage (lib/email/send.ts). Recipients are always
// re-resolved server-side via broadcast_audience (never trusted from the client),
// deduped by email, and only status='ok' guests are emailed. Every message
// carries a one-click unsubscribe footer + List-Unsubscribe header (POPIA).

const FROM = emailFrom();
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wielo.co.za";

// Extract the bare address from a "Name <addr>" or "addr" FROM string.
function fromAddress(): string {
  const m = FROM.match(/<([^>]+)>/);
  return (m ? m[1] : FROM).trim();
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHtml(opts: {
  bodyText: string;
  brand: string;
  unsubUrl: string;
}): string {
  const paragraphs = esc(opts.bodyText)
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#F0FDF4;padding:24px;font-family:Inter,Arial,sans-serif;color:#052E1F">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #DCEAE0;border-radius:16px;overflow:hidden">
    <div style="padding:18px 24px;border-bottom:1px solid #DCEAE0;font-weight:700;font-size:16px;color:#064E3B">${esc(opts.brand)}</div>
    <div style="padding:24px;font-size:14px">${paragraphs}</div>
    <div style="padding:16px 24px;border-top:1px solid #DCEAE0;font-size:11px;color:#4A7C6A">
      You're receiving this because you've stayed or enquired with ${esc(opts.brand)}.
      <a href="${opts.unsubUrl}" style="color:#10B981">Unsubscribe</a>.
    </div>
  </div>
</body></html>`;
}

export type BroadcastResult =
  | { ok: true; sent: number; skipped: number }
  | { ok: false; error: string };

export async function sendGuestBroadcast(opts: {
  hostId: string;
  userId: string;
  hostBrandName: string | null;
  replyTo: string | null;
  audience: string;
  subject: string;
  body: string;
}): Promise<BroadcastResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "Email isn't configured yet." };

  const admin = createAdminClient();

  // Server-side recompute of recipients (never trust the client).
  const { data: audienceRows, error: audErr } = await admin.rpc(
    "broadcast_audience",
    { p_host_id: opts.hostId, p_audience: opts.audience },
  );
  if (audErr) return { ok: false, error: "Could not resolve recipients." };

  const rows = (audienceRows ?? []) as {
    gkey: string;
    email: string;
    first_name: string;
    status: string;
  }[];

  // Eligible + deduped by lowercased email.
  const byEmail = new Map<string, { gkey: string; firstName: string }>();
  for (const r of rows) {
    if (r.status !== "ok" || !r.email) continue;
    if (!byEmail.has(r.email))
      byEmail.set(r.email, {
        gkey: r.gkey,
        firstName: r.first_name || "there",
      });
  }
  const recipients = [...byEmail.entries()].map(([email, v]) => ({
    email,
    ...v,
  }));
  if (recipients.length === 0)
    return { ok: false, error: "No eligible recipients for this audience." };

  // Mint guest_marketing rows (for unsub tokens) without disturbing existing
  // subscription state, then read back every token.
  await admin.from("guest_marketing").upsert(
    recipients.map((r) => ({
      host_id: opts.hostId,
      gkey: r.gkey,
      email: r.email,
      source: "booking",
    })),
    { onConflict: "host_id,gkey", ignoreDuplicates: true },
  );
  const { data: tokenRows } = await admin
    .from("guest_marketing")
    .select("gkey, unsub_token")
    .eq("host_id", opts.hostId)
    .in(
      "gkey",
      recipients.map((r) => r.gkey),
    );
  const tokenByGkey = new Map(
    (tokenRows ?? []).map((t) => [t.gkey, t.unsub_token]),
  );

  const brand = opts.hostBrandName || (await getBrandName());
  const from = `${brand} <${fromAddress()}>`;
  const resend = new Resend(apiKey);

  const personalise = (text: string, name: string) =>
    text.replace(/\{\{?\s*(?:first_name|guest_name)\s*\}?\}/gi, name);

  let sent = 0;
  const CONCURRENCY = 20;
  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    const chunk = recipients.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((r) => {
        const token = tokenByGkey.get(r.gkey);
        if (!token) return Promise.resolve({ skipped: true });
        const unsubUrl = `${SITE_URL}/unsubscribe/${token}`;
        return resend.emails.send({
          from,
          to: r.email,
          replyTo: opts.replyTo ?? undefined,
          subject: personalise(opts.subject, r.firstName),
          html: renderHtml({
            bodyText: personalise(opts.body, r.firstName),
            brand,
            unsubUrl,
          }),
          headers: {
            "List-Unsubscribe": `<${unsubUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
      }),
    );
    for (const res of results) {
      if (
        res.status === "fulfilled" &&
        !(res.value as { skipped?: boolean }).skipped &&
        !(res.value as { error?: unknown }).error
      )
        sent++;
    }
  }

  // INSERT-only send log (also powers the monthly cap + Recent broadcasts).
  await admin.from("guest_broadcasts").insert({
    host_id: opts.hostId,
    subject: opts.subject,
    body: opts.body,
    audience: opts.audience,
    recipient_count: sent,
    status: sent > 0 ? "sent" : "failed",
    created_by: opts.userId,
  });

  return { ok: true, sent, skipped: recipients.length - sent };
}
