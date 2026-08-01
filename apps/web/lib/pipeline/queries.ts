import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Server-side reads for the admin Pipeline (board + lead record). Funnel tables
// are super-admin-only under RLS, so these use the service-role client — every
// caller is already gated by requirePermission('pipeline.view') at the page.

export type Audience = "host" | "affiliate";

export type BoardLead = {
  id: string;
  name: string;
  email: string | null;
  stageId: string;
  score: number;
  status: string;
  sourceKind: string;
  sourceLabel: string | null;
  affiliateRef: string | null;
  ownerInitials: string | null;
  ageDays: number;
  suppressed: boolean;
};

export type BoardStage = {
  id: string;
  key: string;
  label: string;
  isWon: boolean;
  isLost: boolean;
  leads: BoardLead[];
};

export type BoardKpis = {
  newToday: number;
  inProgress: number;
  won: number;
  total: number;
  conversionPct: number;
};

export type Board = {
  audience: Audience;
  stages: BoardStage[];
  kpis: BoardKpis;
};

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function initials(name: string | null): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || null;
}

export async function getBoard(audience: Audience): Promise<Board> {
  const admin = createAdminClient();

  const [{ data: stageRows }, { data: leadRows }] = await Promise.all([
    admin
      .from("pipeline_stages")
      .select("id, key, label, sort_order, is_won, is_lost")
      .eq("audience", audience)
      .order("sort_order"),
    admin
      .from("pipeline_leads")
      .select(
        "id, stage_id, score, status, source_kind, source_label, affiliate_ref, owner_staff_id, created_at, last_activity_at, suppress_default_nurture, user_profiles(full_name, email)",
      )
      .eq("audience", audience)
      .order("score", { ascending: false }),
  ]);

  const leads = leadRows ?? [];

  // Resolve owner initials in one batch.
  const ownerIds = [
    ...new Set(leads.map((l) => l.owner_staff_id).filter(Boolean)),
  ] as string[];
  const ownerInitials = new Map<string, string | null>();
  if (ownerIds.length) {
    const { data: owners } = await admin
      .from("user_profiles")
      .select("id, full_name")
      .in("id", ownerIds);
    for (const o of owners ?? [])
      ownerInitials.set(o.id, initials(o.full_name));
  }

  const byStage = new Map<string, BoardLead[]>();
  for (const l of leads) {
    const prof = l.user_profiles as {
      full_name?: string;
      email?: string;
    } | null;
    const lead: BoardLead = {
      id: l.id,
      name: prof?.full_name || prof?.email || "Unnamed lead",
      email: prof?.email ?? null,
      stageId: l.stage_id,
      score: l.score,
      status: l.status,
      sourceKind: l.source_kind,
      sourceLabel: l.source_label,
      affiliateRef: l.affiliate_ref,
      ownerInitials: l.owner_staff_id
        ? (ownerInitials.get(l.owner_staff_id) ?? null)
        : null,
      ageDays: daysSince(l.last_activity_at ?? l.created_at),
      suppressed: Boolean(l.suppress_default_nurture),
    };
    const arr = byStage.get(l.stage_id) ?? [];
    arr.push(lead);
    byStage.set(l.stage_id, arr);
  }

  const stages: BoardStage[] = (stageRows ?? []).map((s) => ({
    id: s.id,
    key: s.key,
    label: s.label,
    isWon: s.is_won,
    isLost: s.is_lost,
    leads: byStage.get(s.id) ?? [],
  }));

  // KPIs.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const total = leads.length;
  const newToday = leads.filter(
    (l) => new Date(l.created_at).getTime() >= startOfToday.getTime(),
  ).length;
  const won = leads.filter((l) => l.status === "won").length;
  const inProgress = leads.filter((l) => l.status === "open").length;
  const conversionPct = total ? Math.round((won / total) * 100) : 0;

  return {
    audience,
    stages,
    kpis: { newToday, inProgress, won, total, conversionPct },
  };
}

export type LeadActivity = {
  id: string;
  kind: string;
  body: string | null;
  staffName: string | null;
  createdAt: string;
  meta: Record<string, unknown>;
};

export type LeadRecord = {
  id: string;
  audience: Audience;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  score: number;
  sourceKind: string;
  sourceLabel: string | null;
  affiliateRef: string | null;
  marketingConsent: boolean;
  ownerStaffId: string | null;
  ownerName: string | null;
  createdAt: string;
  lastActivityAt: string | null;
  establishment: string | null;
  rooms: string | null;
  utm: Record<string, unknown>;
  adSource: string | null;
  ref: string;
  stageId: string;
  stages: { id: string; label: string; isWon: boolean; isLost: boolean }[];
  activities: LeadActivity[];
};

export async function getLead(leadId: string): Promise<LeadRecord | null> {
  const admin = createAdminClient();

  const { data: lead } = await admin
    .from("pipeline_leads")
    .select(
      "id, audience, stage_id, score, status, source_kind, source_label, affiliate_ref, marketing_consent, owner_staff_id, ad_source, utm, created_at, last_activity_at, user_profiles(full_name, email, phone)",
    )
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return null;

  const [{ data: stageRows }, { data: actRows }, ownerRes] = await Promise.all([
    admin
      .from("pipeline_stages")
      .select("id, label, is_won, is_lost, sort_order")
      .eq("audience", lead.audience)
      .order("sort_order"),
    admin
      .from("pipeline_activities")
      .select("id, kind, body, staff_id, meta, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false }),
    lead.owner_staff_id
      ? admin
          .from("user_profiles")
          .select("full_name")
          .eq("id", lead.owner_staff_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const activities = actRows ?? [];
  // Resolve staff names for the timeline in one batch.
  const staffIds = [
    ...new Set(activities.map((a) => a.staff_id).filter(Boolean)),
  ] as string[];
  const staffNames = new Map<string, string | null>();
  if (staffIds.length) {
    const { data: staff } = await admin
      .from("user_profiles")
      .select("id, full_name")
      .in("id", staffIds);
    for (const s of staff ?? []) staffNames.set(s.id, s.full_name);
  }

  // Establishment + rooms live in the 'created' activity's meta.
  const created = activities.find((a) => a.kind === "created");
  const createdMeta = (created?.meta ?? {}) as Record<string, unknown>;

  const prof = lead.user_profiles as {
    full_name?: string;
    email?: string;
    phone?: string;
  } | null;

  return {
    id: lead.id,
    audience: lead.audience as Audience,
    name: prof?.full_name || prof?.email || "Unnamed lead",
    email: prof?.email ?? null,
    phone: prof?.phone ?? null,
    status: lead.status,
    score: lead.score,
    sourceKind: lead.source_kind,
    sourceLabel: lead.source_label,
    affiliateRef: lead.affiliate_ref,
    marketingConsent: lead.marketing_consent,
    ownerStaffId: lead.owner_staff_id,
    ownerName:
      (ownerRes.data as { full_name?: string } | null)?.full_name ?? null,
    createdAt: lead.created_at,
    lastActivityAt: lead.last_activity_at,
    establishment: (createdMeta.establishment_address as string) || null,
    rooms: (createdMeta.rooms as string) || null,
    utm: (lead.utm as Record<string, unknown>) ?? {},
    adSource: lead.ad_source,
    ref: `LD-${lead.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    stageId: lead.stage_id,
    stages: (stageRows ?? []).map((s) => ({
      id: s.id,
      label: s.label,
      isWon: s.is_won,
      isLost: s.is_lost,
    })),
    activities: activities.map((a) => ({
      id: a.id,
      kind: a.kind,
      body: a.body,
      staffName: a.staff_id ? (staffNames.get(a.staff_id) ?? null) : null,
      createdAt: a.created_at,
      meta: (a.meta as Record<string, unknown>) ?? {},
    })),
  };
}
