import { createAdminClient } from "@/lib/supabase/admin";

import { sendPushToTokens } from "./push";
import type { PushPayload } from "./types";

const BATCH_SIZE = 50;

export type PushDrainResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{
    id: string;
    event_kind: string;
    status: "sent" | "failed" | "skipped";
    error?: string;
  }>;
};

type QueueRow = {
  id: string;
  user_id: string;
  event_kind: string;
  payload: Record<string, unknown>;
};

export async function drainPushQueue(): Promise<PushDrainResult> {
  const supabase = createAdminClient();

  // Atomically CLAIM a batch (stamps claimed_at via FOR UPDATE SKIP LOCKED) so
  // two overlapping per-minute ticks never grab the same row and double-send.
  // The claim also honours release_at (quiet-hours deferral) and reclaims a
  // crashed worker's stale claim after 300s.
  const { data: rows, error } = await supabase.rpc("claim_push_queue_batch", {
    p_limit: BATCH_SIZE,
    p_stale_seconds: 300,
  });

  if (error) {
    throw new Error(`claim push queue failed: ${error.message}`);
  }

  const result: PushDrainResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  if (!rows || rows.length === 0) return result;

  for (const row of rows as QueueRow[]) {
    result.processed += 1;

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", row.user_id)
      .eq("is_active", true);

    if (!tokens || tokens.length === 0) {
      await markPushFailed(supabase, row.id, "skipped:no_active_tokens");
      result.skipped += 1;
      result.details.push({
        id: row.id,
        event_kind: row.event_kind,
        status: "skipped",
        error: "no_active_tokens",
      });
      continue;
    }

    const send = await sendPushToTokens(
      tokens.map((t) => t.token as string),
      row.payload as unknown as PushPayload,
    );

    if (send.failed > 0 && send.ok === 0) {
      const err = send.errors[0] ?? "unknown_push_error";
      await markPushFailed(supabase, row.id, err);
      result.failed += 1;
      result.details.push({
        id: row.id,
        event_kind: row.event_kind,
        status: "failed",
        error: err,
      });
      continue;
    }

    await markPushSent(supabase, row.id);
    // best-effort: refresh last_used_at on the user's active tokens
    await supabase
      .from("push_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", row.user_id)
      .eq("is_active", true);

    result.sent += 1;
    result.details.push({
      id: row.id,
      event_kind: row.event_kind,
      status: "sent",
    });
  }

  return result;
}

async function markPushSent(
  supabase: ReturnType<typeof createAdminClient>,
  id: string,
) {
  await supabase
    .from("pending_push_queue")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id);
}

async function markPushFailed(
  supabase: ReturnType<typeof createAdminClient>,
  id: string,
  error: string,
) {
  await supabase
    .from("pending_push_queue")
    .update({
      failed_at: new Date().toISOString(),
      error: error.slice(0, 240),
    })
    .eq("id", id);
}
