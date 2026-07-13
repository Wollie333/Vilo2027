// Auto-save drafts — shared Layer B store helpers.
//
// One live recovery draft per (user, entity_type, entity_id, scope_id). Used by
// both the Server Action path (during-edit sync) and the /api/drafts beacon
// (flush on unload). Callers pass an already-authenticated Supabase client and
// the resolved user id, so these stay transport-agnostic.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Entity editors allowed to persist recovery drafts. Keep in lockstep with the
 * editors that mount `useAutosaveDraft` so junk types can't be written. */
export const DRAFT_ENTITY_TYPES = [
  "addon",
  "special",
  "room",
  "coupon",
] as const;
export type DraftEntityType = (typeof DRAFT_ENTITY_TYPES)[number];

export type FormDraftTarget = {
  entityType: DraftEntityType;
  entityId: string | null;
  scopeId: string | null;
};

export function isDraftEntityType(v: unknown): v is DraftEntityType {
  return (
    typeof v === "string" &&
    (DRAFT_ENTITY_TYPES as readonly string[]).includes(v)
  );
}

/** Validate an untrusted target (from a client action / beacon body). */
export function parseTarget(v: unknown): FormDraftTarget | null {
  if (!v || typeof v !== "object") return null;
  const t = v as Record<string, unknown>;
  if (!isDraftEntityType(t.entityType)) return null;
  const entityId =
    typeof t.entityId === "string" && t.entityId.length > 0 ? t.entityId : null;
  const scopeId =
    typeof t.scopeId === "string" && t.scopeId.length > 0 ? t.scopeId : null;
  return { entityType: t.entityType, entityId, scopeId };
}

function scoped(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  target: FormDraftTarget,
) {
  let q = query.eq("entity_type", target.entityType);
  q =
    target.entityId == null
      ? q.is("entity_id", null)
      : q.eq("entity_id", target.entityId);
  q =
    target.scopeId == null
      ? q.is("scope_id", null)
      : q.eq("scope_id", target.scopeId);
  return q;
}

export async function upsertFormDraft(
  supabase: SupabaseClient,
  userId: string,
  target: FormDraftTarget,
  payload: unknown,
): Promise<{ ok: boolean }> {
  const { error } = await supabase.from("form_drafts").upsert(
    {
      user_id: userId,
      entity_type: target.entityType,
      entity_id: target.entityId,
      scope_id: target.scopeId,
      payload: payload as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,entity_type,entity_id,scope_id" },
  );
  return { ok: !error };
}

export async function deleteFormDraft(
  supabase: SupabaseClient,
  userId: string,
  target: FormDraftTarget,
): Promise<{ ok: boolean }> {
  const { error } = await scoped(
    supabase.from("form_drafts").delete().eq("user_id", userId),
    target,
  );
  return { ok: !error };
}

export type LoadedDraft = { payload: unknown; updatedAt: string };

export async function loadFormDraft(
  supabase: SupabaseClient,
  userId: string,
  target: FormDraftTarget,
): Promise<LoadedDraft | null> {
  const { data } = await scoped(
    supabase
      .from("form_drafts")
      .select("payload, updated_at")
      .eq("user_id", userId),
    target,
  ).maybeSingle();
  if (!data) return null;
  return { payload: data.payload, updatedAt: data.updated_at as string };
}
