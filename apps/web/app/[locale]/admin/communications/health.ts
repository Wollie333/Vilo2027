import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Aggregate delivery health for the Communications hub's "Delivery health" tab.
// Read-only counts over the notification queue + delivery log.

export type DeliveryHealth = {
  sent24h: number;
  failed24h: number;
  queueDepth: number;
  failureRate: number; // 0..1
  byChannel: { email: number; push: number; inApp: number };
  failures: {
    when: string;
    type: string;
    reason: string;
  }[];
};

export async function loadDeliveryHealth(): Promise<DeliveryHealth> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: sent24h },
    { count: failed24h },
    { count: queueDepth },
    { data: channelRows },
    { data: failRows },
  ] = await Promise.all([
    admin
      .from("notification_queue")
      .select("id", { count: "exact", head: true })
      .not("sent_at", "is", null)
      .gte("sent_at", cutoff),
    admin
      .from("notification_queue")
      .select("id", { count: "exact", head: true })
      .not("failed_at", "is", null)
      .gte("failed_at", cutoff),
    admin
      .from("notification_queue")
      .select("id", { count: "exact", head: true })
      .is("sent_at", null)
      .is("failed_at", null),
    admin
      .from("notification_delivery_log")
      .select("channel")
      .gte("created_at", cutoff)
      .limit(5000),
    admin
      .from("notification_queue")
      .select("type, error, failed_at")
      .not("failed_at", "is", null)
      .gte("failed_at", cutoff)
      .order("failed_at", { ascending: false })
      .limit(25),
  ]);

  const byChannel = { email: 0, push: 0, inApp: 0 };
  for (const r of (channelRows as { channel: string }[]) ?? []) {
    if (r.channel === "email") byChannel.email += 1;
    else if (r.channel === "push") byChannel.push += 1;
    else if (r.channel === "in_app") byChannel.inApp += 1;
  }

  const sent = sent24h ?? 0;
  const failed = failed24h ?? 0;
  const total = sent + failed;

  return {
    sent24h: sent,
    failed24h: failed,
    queueDepth: queueDepth ?? 0,
    failureRate: total > 0 ? failed / total : 0,
    byChannel,
    failures: (
      (failRows as {
        type: string;
        error: string | null;
        failed_at: string;
      }[]) ?? []
    ).map((r) => ({
      when: r.failed_at,
      type: r.type,
      reason: r.error ?? "unknown",
    })),
  };
}
