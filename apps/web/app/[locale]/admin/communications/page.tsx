import type { Metadata } from "next";

import "@/components/affiliate/affiliate-manager.css";
import "./communications.css";
import { requirePermission } from "@/lib/admin/requirePermission";
import { EMAIL_REGISTRY } from "@/lib/email/registry";
import {
  groupByArea,
  listMessageConfigs,
} from "@/lib/notifications/admin-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSamplePayload } from "../emails/samplePayloads";
import { CommunicationsHub } from "./_components/CommunicationsHub";
import { loadDeliveryHealth } from "./health";

export const metadata: Metadata = { title: "Communications · Admin" };
export const dynamic = "force-dynamic";

export default async function CommunicationsPage() {
  await requirePermission("notifications.broadcast");

  const admin = createAdminClient();
  const [configs, health, { data: broadcasts }] = await Promise.all([
    listMessageConfigs(),
    loadDeliveryHealth(),
    admin
      .from("broadcast_announcements")
      .select(
        "id, title, audience, severity, starts_at, ends_at, cancelled_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const groups = groupByArea(configs);
  const history = (broadcasts ?? []).map((b) => ({
    id: b.id as string,
    title: b.title as string,
    audience: b.audience as string,
    severity: b.severity as string,
    startsAt: b.starts_at as string | null,
    endsAt: b.ends_at as string | null,
    cancelledAt: b.cancelled_at as string | null,
    createdAt: b.created_at as string,
  }));

  // Precompute the default subject/intro preview for each message so the drawer
  // can show "reset to default" copy without a round-trip. Subject comes from
  // the email registry; intro is the template default (rendered client-side).
  const defaults: Record<string, { subject: string }> = {};
  for (const c of configs) {
    const entry = EMAIL_REGISTRY[c.kind];
    defaults[c.kind] = {
      subject: entry ? entry.subject(getSamplePayload(c.kind)) : c.label,
    };
  }

  return (
    <CommunicationsHub
      groups={groups}
      defaults={defaults}
      health={health}
      history={history}
    />
  );
}
