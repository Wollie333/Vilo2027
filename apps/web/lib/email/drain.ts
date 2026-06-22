import { createElement } from "react";
import { Resend } from "resend";

import { getBrandName } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";

import { EMAIL_REGISTRY, type EmailRegistryEntry } from "./registry";
import { RESOLVERS } from "./resolvers";

const FROM_ADDRESS =
  process.env.EMAIL_FROM_ADDRESS ?? "Vilo <onboarding@resend.dev>";

const BATCH_SIZE = 50;

export type DrainResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{
    id: string;
    type: string;
    status: "sent" | "failed" | "skipped";
    error?: string;
  }>;
};

type QueueRow = {
  id: string;
  type: string;
  host_id: string | null;
  guest_id: string | null;
  payload: Record<string, unknown> | null;
  user_id: string | null;
  category_id: string | null;
};

export async function drainEmailQueue(): Promise<DrainResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("drainEmailQueue: RESEND_API_KEY is not set");
  }

  const resend = new Resend(apiKey);
  const supabase = createAdminClient();
  // Brand name is injected into every email payload so subjects/templates can
  // use the configured name (falling back to "Vilo") instead of hardcoding it.
  const brandName = await getBrandName();

  // Atomically CLAIM a batch (stamps claimed_at via FOR UPDATE SKIP LOCKED) so
  // two overlapping per-minute ticks never grab the same row and double-send.
  // A crashed worker's claim goes stale after 300s and is reclaimed later.
  const { data: rows, error: fetchError } = await supabase.rpc(
    "claim_email_queue_batch",
    { p_limit: BATCH_SIZE, p_stale_seconds: 300 },
  );

  if (fetchError) {
    throw new Error(`claim queue failed: ${fetchError.message}`);
  }

  const result: DrainResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  if (!rows || rows.length === 0) return result;

  for (const raw of rows as QueueRow[]) {
    result.processed += 1;
    const row = raw;
    const rawPayload = (row.payload as Record<string, unknown>) ?? {};
    const entry: EmailRegistryEntry | undefined = EMAIL_REGISTRY[row.type];

    if (!entry) {
      await markFailed(supabase, row.id, `no_template:${row.type}`);
      result.skipped += 1;
      result.details.push({
        id: row.id,
        type: row.type,
        status: "skipped",
        error: `no_template:${row.type}`,
      });
      continue;
    }

    // Run the type's resolver (if any) and merge with the row's payload.
    // The payload wins on conflicts so explicit overrides at enqueue time
    // (and the admin preview tool's hand-crafted payloads) still work.
    const resolver = RESOLVERS[row.type];
    let resolved: Record<string, unknown> = {};
    if (resolver) {
      try {
        resolved = await resolver(rawPayload, { supabase });
      } catch (resolverErr) {
        const msg =
          resolverErr instanceof Error
            ? resolverErr.message
            : String(resolverErr);
        await markFailed(supabase, row.id, `resolver:${msg.slice(0, 200)}`);
        result.failed += 1;
        result.details.push({
          id: row.id,
          type: row.type,
          status: "failed",
          error: msg,
        });
        continue;
      }
    }
    const payload: Record<string, unknown> = {
      brand_name: brandName,
      ...resolved,
      ...rawPayload,
    };

    // Defense-in-depth: re-check the recipient's preference at send time.
    // The dispatcher already gated at enqueue, but a category toggled off
    // between enqueue and send shouldn't leak through.
    if (row.user_id && row.category_id) {
      const disabled = await emailDisabledForUser(
        supabase,
        row.user_id,
        row.category_id,
      );
      if (disabled) {
        await markFailed(supabase, row.id, "disabled_by_user");
        result.skipped += 1;
        result.details.push({
          id: row.id,
          type: row.type,
          status: "skipped",
          error: "disabled_by_user",
        });
        continue;
      }
    }

    const recipientEmail = await resolveRecipientEmail(
      supabase,
      row,
      entry,
      payload,
    );
    if (!recipientEmail) {
      await markFailed(supabase, row.id, "no_recipient_email");
      result.failed += 1;
      result.details.push({
        id: row.id,
        type: row.type,
        status: "failed",
        error: "no_recipient_email",
      });
      continue;
    }

    try {
      const { error: sendError } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: recipientEmail,
        subject: entry.subject(payload),
        react: createElement(entry.Template, payload),
      });

      if (sendError) {
        await markFailed(
          supabase,
          row.id,
          `resend:${sendError.name}:${sendError.message}`,
        );
        result.failed += 1;
        result.details.push({
          id: row.id,
          type: row.type,
          status: "failed",
          error: sendError.message,
        });
        continue;
      }

      await markSent(supabase, row.id);
      result.sent += 1;
      result.details.push({ id: row.id, type: row.type, status: "sent" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markFailed(supabase, row.id, `exception:${msg.slice(0, 240)}`);
      result.failed += 1;
      result.details.push({
        id: row.id,
        type: row.type,
        status: "failed",
        error: msg,
      });
    }
  }

  return result;
}

async function resolveRecipientEmail(
  supabase: ReturnType<typeof createAdminClient>,
  row: QueueRow,
  entry: EmailRegistryEntry,
  mergedPayload: Record<string, unknown>,
): Promise<string | null> {
  if (entry.recipient === "custom") {
    const explicit = mergedPayload.recipient_email;
    if (typeof explicit === "string" && explicit.includes("@")) {
      return explicit;
    }
    return null;
  }

  if (entry.recipient === "guest") {
    if (!row.guest_id) return null;
    const { data, error } = await supabase
      .from("user_profiles")
      .select("email")
      .eq("id", row.guest_id)
      .maybeSingle();
    if (error || !data?.email) return null;
    return data.email;
  }

  if (!row.host_id) return null;
  const { data, error } = await supabase
    .from("hosts")
    .select("user_id, user_profiles!hosts_user_id_fkey(email)")
    .eq("id", row.host_id)
    .maybeSingle();
  if (error || !data) return null;
  const profile = data.user_profiles as unknown as {
    email: string | null;
  } | null;
  return profile?.email ?? null;
}

async function emailDisabledForUser(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  categoryId: string,
): Promise<boolean> {
  const { data } = await supabase
    .rpc("resolve_notification_prefs", {
      p_user_id: userId,
      p_category_id: categoryId,
    })
    .single();
  if (!data) return false;
  const row = data as { email_enabled: boolean; is_locked: boolean };
  if (row.is_locked) return false;
  return row.email_enabled === false;
}

async function markSent(
  supabase: ReturnType<typeof createAdminClient>,
  id: string,
) {
  await supabase
    .from("notification_queue")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id);
}

async function markFailed(
  supabase: ReturnType<typeof createAdminClient>,
  id: string,
  error: string,
) {
  await supabase
    .from("notification_queue")
    .update({ failed_at: new Date().toISOString(), error })
    .eq("id", id);
}
