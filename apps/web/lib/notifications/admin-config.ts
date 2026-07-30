import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  AREAS,
  MESSAGE_CATALOG,
  channelsSupported,
  type AreaKey,
  type CatalogEntry,
} from "./catalog";
import { NOTIFICATION_REGISTRY, type EventKind } from "./registry";

// Server-side data for the Communications hub: the message catalog merged with
// each message's admin override (notification_overrides) and 24h delivery
// health. Read-only aggregation; writes go through the route's server actions.

export type ChannelState = { supported: boolean; enabled: boolean };

export type MessageConfig = {
  kind: EventKind;
  area: AreaKey;
  label: string;
  description: string;
  isNew: boolean;
  masterEnabled: boolean;
  email: ChannelState;
  push: ChannelState;
  inApp: ChannelState;
  /** subject/intro override present → the "Customised" badge. */
  customised: boolean;
  subjectOverride: string | null;
  introOverride: string | null;
  /** 24h health. sent+failed=0 → treated as "never sent" in the UI. */
  sent24h: number;
  failed24h: number;
};

type OverrideRow = {
  event_kind: string;
  master_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  subject_override: string | null;
  intro_override: string | null;
};

// email_template_key → kind, to attribute email-queue failures back to a kind.
const TEMPLATE_TO_KIND = new Map<string, EventKind>();
for (const kind of Object.keys(NOTIFICATION_REGISTRY) as EventKind[]) {
  const t = (NOTIFICATION_REGISTRY[kind] as { emailTemplate?: string })
    .emailTemplate;
  if (t) TEMPLATE_TO_KIND.set(t, kind);
}

function buildConfig(
  entry: CatalogEntry,
  ov: OverrideRow | undefined,
  sent: number,
  failed: number,
): MessageConfig {
  const sup = channelsSupported(entry.kind);
  const masterEnabled = ov?.master_enabled ?? true;
  const subjectOverride = ov?.subject_override ?? null;
  const introOverride = ov?.intro_override ?? null;
  return {
    kind: entry.kind,
    area: entry.area,
    label: entry.label,
    description: entry.description,
    isNew: Boolean(entry.isNew),
    masterEnabled,
    email: {
      supported: sup.email,
      enabled: (ov?.email_enabled ?? true) && sup.email,
    },
    push: {
      supported: sup.push,
      enabled: (ov?.push_enabled ?? true) && sup.push,
    },
    inApp: {
      supported: sup.inApp,
      enabled: (ov?.in_app_enabled ?? true) && sup.inApp,
    },
    customised: Boolean(subjectOverride || introOverride),
    subjectOverride,
    introOverride,
    sent24h: sent,
    failed24h: failed,
  };
}

/** Every automated message, merged with its override + 24h health. */
export async function listMessageConfigs(): Promise<MessageConfig[]> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: overrides }, { data: logs }, { data: fails }] =
    await Promise.all([
      admin
        .from("notification_overrides")
        .select(
          "event_kind, master_enabled, email_enabled, push_enabled, in_app_enabled, subject_override, intro_override",
        ),
      admin
        .from("notification_delivery_log")
        .select("event_kind")
        .gte("created_at", cutoff)
        .limit(5000),
      admin
        .from("notification_queue")
        .select("type")
        .not("failed_at", "is", null)
        .gte("failed_at", cutoff)
        .limit(5000),
    ]);

  const ovByKind = new Map<string, OverrideRow>(
    ((overrides as OverrideRow[]) ?? []).map((o) => [o.event_kind, o]),
  );
  const sentByKind = tally(
    (logs as { event_kind: string }[]) ?? [],
    (r) => r.event_kind,
  );
  const failByKind = new Map<string, number>();
  for (const r of (fails as { type: string }[]) ?? []) {
    const kind = TEMPLATE_TO_KIND.get(r.type);
    if (kind) failByKind.set(kind, (failByKind.get(kind) ?? 0) + 1);
  }

  return MESSAGE_CATALOG.map((entry) =>
    buildConfig(
      entry,
      ovByKind.get(entry.kind),
      sentByKind.get(entry.kind) ?? 0,
      failByKind.get(entry.kind) ?? 0,
    ),
  );
}

/** Group the configs by area, preserving AREAS order and dropping empty areas. */
export function groupByArea(
  configs: MessageConfig[],
): { key: AreaKey; label: string; icon: string; items: MessageConfig[] }[] {
  return AREAS.map((a) => ({
    ...a,
    items: configs.filter((c) => c.area === a.key),
  })).filter((g) => g.items.length > 0);
}

function tally<T>(rows: T[], key: (r: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
