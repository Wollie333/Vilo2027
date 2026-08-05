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
  /** Payment is faltering (past_due / paused / dunning) — a save-the-customer flag. */
  atRisk: boolean;
  /** Wielo account state behind the card: passwordless lead vs claimed account. */
  isLead: boolean;
  /** ZAR value on the card: realized Wielo revenue (paid) or the trial's expected price. */
  value: number;
  valueKind: "paid" | "trial" | null;
};

export type BoardStage = {
  id: string;
  key: string;
  label: string;
  isWon: boolean;
  isLost: boolean;
  /** Trial + Won — a customer stage: cards here are locked against deletion. */
  isCustomer: boolean;
  /** Paid-then-left. A distinct terminal from Lost (never converted). */
  isChurned: boolean;
  /** Trial / Won / Churned — set by lifecycle triggers, never a manual drop. */
  systemManaged: boolean;
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
      .select(
        "id, key, label, sort_order, is_won, is_lost, is_customer, system_managed",
      )
      .eq("audience", audience)
      .order("sort_order"),
    admin
      .from("pipeline_leads")
      .select(
        "id, user_id, stage_id, score, status, source_kind, source_label, affiliate_ref, owner_staff_id, created_at, last_activity_at, suppress_default_nurture, at_risk, user_profiles(full_name, email, is_lead)",
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

  // Per-lead ZAR value for the card: realized Wielo revenue (sum of settled
  // charges) if they've paid, else the expected price of a live trial.
  const leadUserIds = [
    ...new Set(leads.map((l) => l.user_id).filter(Boolean)),
  ] as string[];
  const realizedByUser = new Map<string, number>();
  const trialByUser = new Map<string, number>();
  if (leadUserIds.length) {
    const { data: charges } = await admin
      .from("platform_ledger")
      .select("user_id, amount")
      .in("user_id", leadUserIds)
      .eq("type", "charge")
      .eq("status", "completed");
    for (const c of charges ?? []) {
      if (!c.user_id) continue;
      realizedByUser.set(
        c.user_id,
        (realizedByUser.get(c.user_id) ?? 0) + Number(c.amount ?? 0),
      );
    }
    const { data: trials } = await admin
      .from("subscriptions")
      .select("products(price), hosts!inner(user_id)")
      .eq("status", "trialing")
      .in("hosts.user_id", leadUserIds);
    for (const t of trials ?? []) {
      const uid = (t.hosts as { user_id?: string } | null)?.user_id;
      const price = Number(
        (t.products as { price?: number } | null)?.price ?? 0,
      );
      if (uid && price > 0 && !trialByUser.has(uid))
        trialByUser.set(uid, price);
    }
  }

  const byStage = new Map<string, BoardLead[]>();
  for (const l of leads) {
    const prof = l.user_profiles as {
      full_name?: string;
      email?: string;
      is_lead?: boolean;
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
      atRisk: Boolean(l.at_risk),
      isLead: Boolean(prof?.is_lead),
      value: (() => {
        const realized = realizedByUser.get(l.user_id) ?? 0;
        return realized > 0 ? realized : (trialByUser.get(l.user_id) ?? 0);
      })(),
      valueKind:
        (realizedByUser.get(l.user_id) ?? 0) > 0
          ? "paid"
          : (trialByUser.get(l.user_id) ?? 0) > 0
            ? "trial"
            : null,
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
    isCustomer: Boolean(s.is_customer),
    isChurned: s.key === "churned",
    systemManaged: Boolean(s.system_managed),
    leads: byStage.get(s.id) ?? [],
  }));

  // KPIs.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
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

export type FunnelSummary = {
  id: string;
  audience: Audience;
  slug: string;
  name: string;
  headline: string | null;
  subcopy: string | null;
  isActive: boolean;
  hasBrochure: boolean;
  brochureName: string | null;
  hasVideo: boolean;
  leadCount: number;
};

/**
 * Directory of the public /go/<slug> funnel pages (landing + thank-you), for the
 * admin "Landing pages" view. Read-only — a place to see what's live and grab the
 * URLs, not a CMS. Lead counts are a lightweight per-funnel head count.
 */
export async function getFunnels(): Promise<FunnelSummary[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("funnels")
    .select(
      "id, audience, slug, name, headline, subcopy, brochure_path, brochure_name, video_url, is_active",
    )
    .order("audience")
    .order("name");

  const funnels = rows ?? [];
  const counts = await Promise.all(
    funnels.map(async (f) => {
      const { count } = await admin
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("funnel_id", f.id);
      return count ?? 0;
    }),
  );

  return funnels.map((f, i) => ({
    id: f.id,
    audience: f.audience as Audience,
    slug: f.slug,
    name: f.name,
    headline: f.headline,
    subcopy: f.subcopy,
    isActive: f.is_active,
    hasBrochure: Boolean(f.brochure_path),
    brochureName: f.brochure_name,
    hasVideo: Boolean(f.video_url),
    leadCount: counts[i] ?? 0,
  }));
}

export type LeadTask = {
  id: string;
  title: string;
  dueAt: string | null;
  status: "open" | "done";
  assigneeName: string | null;
  completedAt: string | null;
  createdAt: string;
};

export async function getLeadTasks(leadId: string): Promise<LeadTask[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("pipeline_tasks")
    .select(
      "id, title, due_at, status, assignee_staff_id, completed_at, created_at",
    )
    .eq("lead_id", leadId)
    .order("status")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  const tasks = rows ?? [];

  const assigneeIds = [
    ...new Set(tasks.map((t) => t.assignee_staff_id).filter(Boolean)),
  ] as string[];
  const names = new Map<string, string | null>();
  if (assigneeIds.length) {
    const { data: people } = await admin
      .from("user_profiles")
      .select("id, full_name")
      .in("id", assigneeIds);
    for (const p of people ?? []) names.set(p.id, p.full_name);
  }

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueAt: t.due_at,
    status: t.status as "open" | "done",
    assigneeName: t.assignee_staff_id
      ? (names.get(t.assignee_staff_id) ?? null)
      : null,
    completedAt: t.completed_at,
    createdAt: t.created_at,
  }));
}

export type LeadFile = {
  id: string;
  name: string;
  sizeBytes: number | null;
  mime: string | null;
  uploaderName: string | null;
  createdAt: string;
  downloadUrl: string | null;
};

export async function getLeadFiles(leadId: string): Promise<LeadFile[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("pipeline_files")
    .select("id, name, path, size_bytes, mime, uploaded_by, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  const files = rows ?? [];

  const uploaderIds = [
    ...new Set(files.map((f) => f.uploaded_by).filter(Boolean)),
  ] as string[];
  const names = new Map<string, string | null>();
  if (uploaderIds.length) {
    const { data: people } = await admin
      .from("user_profiles")
      .select("id, full_name")
      .in("id", uploaderIds);
    for (const p of people ?? []) names.set(p.id, p.full_name);
  }

  // Short-lived signed download URLs (private bucket).
  const signed = await Promise.all(
    files.map((f) =>
      admin.storage
        .from("pipeline-files")
        .createSignedUrl(f.path, 60 * 60)
        .then((r) => r.data?.signedUrl ?? null)
        .catch(() => null),
    ),
  );

  return files.map((f, i) => ({
    id: f.id,
    name: f.name,
    sizeBytes: f.size_bytes,
    mime: f.mime,
    uploaderName: f.uploaded_by ? (names.get(f.uploaded_by) ?? null) : null,
    createdAt: f.created_at,
    downloadUrl: signed[i],
  }));
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
  atRisk: boolean;
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
  /** Wielo account state: a passwordless lead (is_lead) vs a claimed account. */
  isLead: boolean;
  /** The funnel page this lead came through (null for direct/competition). */
  funnelName: string | null;
  funnelSlug: string | null;
  stageId: string;
  stageLabel: string | null;
  stages: { id: string; label: string; isWon: boolean; isLost: boolean }[];
  activities: LeadActivity[];
};

export async function getLead(leadId: string): Promise<LeadRecord | null> {
  const admin = createAdminClient();

  const { data: lead } = await admin
    .from("pipeline_leads")
    .select(
      "id, audience, stage_id, score, status, source_kind, source_label, affiliate_ref, at_risk, marketing_consent, owner_staff_id, ad_source, utm, created_at, last_activity_at, funnel_id, funnels(name, slug), user_profiles(full_name, email, phone, is_lead)",
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
    is_lead?: boolean;
  } | null;
  const funnel = lead.funnels as { name?: string; slug?: string } | null;
  const stageRowsArr = stageRows ?? [];

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
    atRisk: Boolean(lead.at_risk),
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
    isLead: Boolean(prof?.is_lead),
    funnelName: funnel?.name ?? null,
    funnelSlug: funnel?.slug ?? null,
    stageId: lead.stage_id,
    stageLabel: stageRowsArr.find((s) => s.id === lead.stage_id)?.label ?? null,
    stages: stageRowsArr.map((s) => ({
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
