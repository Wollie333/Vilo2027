"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  requestType: z.enum(["export", "deletion"]),
  notes: z.string().max(2000).optional().nullable(),
});

type Result = { ok: true } | { ok: false; error: string };

export async function createDataRequestAction(input: {
  requestType: "export" | "deletion";
  notes?: string | null;
}): Promise<Result> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Block stacking — at most one pending request per user per type.
  const { data: existing } = await supabase
    .from("data_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("request_type", parsed.data.requestType)
    .in("status", ["pending", "processing"])
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      error: `You already have a pending ${parsed.data.requestType} request.`,
    };
  }

  const { error } = await supabase.from("data_requests").insert({
    user_id: user.id,
    request_type: parsed.data.requestType,
    notes: parsed.data.notes?.trim() || null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/data");
  return { ok: true };
}

const cancelSchema = z.object({ requestId: z.string().uuid() });

export async function cancelDataRequestAction(input: {
  requestId: string;
}): Promise<Result> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("data_requests")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.requestId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/data");
  return { ok: true };
}
