"use server";

import { createServerClient } from "@/lib/supabase/server";

import {
  deleteFormDraft,
  parseTarget,
  upsertFormDraft,
  type FormDraftTarget,
} from "./store";

async function currentUserId(): Promise<{
  supabase: ReturnType<typeof createServerClient>;
  userId: string | null;
}> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

/** Sync the live form state to the durable draft store (Layer B). */
export async function saveFormDraftAction(
  target: FormDraftTarget,
  payload: unknown,
): Promise<{ ok: boolean }> {
  const valid = parseTarget(target);
  if (!valid) return { ok: false };
  const { supabase, userId } = await currentUserId();
  if (!userId) return { ok: false };
  return upsertFormDraft(supabase, userId, valid, payload);
}

/** Drop the durable draft — on save-success or an explicit "Discard". */
export async function discardFormDraftAction(
  target: FormDraftTarget,
): Promise<{ ok: boolean }> {
  const valid = parseTarget(target);
  if (!valid) return { ok: false };
  const { supabase, userId } = await currentUserId();
  if (!userId) return { ok: false };
  return deleteFormDraft(supabase, userId, valid);
}
