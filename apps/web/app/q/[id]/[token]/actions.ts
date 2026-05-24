"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function gateByToken(
  quoteId: string,
  token: string,
): Promise<
  | { ok: true; status: string; validUntil: string | null }
  | { ok: false; error: string }
> {
  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("status, accept_token, valid_until")
    .eq("id", quoteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!quote) return { ok: false, error: "Quote not found." };
  if (quote.accept_token !== token) {
    return { ok: false, error: "Invalid token." };
  }
  if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
    return { ok: false, error: "This quote has expired." };
  }
  if (!["sent"].includes(quote.status)) {
    return { ok: false, error: "This quote can no longer be answered." };
  }
  return { ok: true, status: quote.status, validUntil: quote.valid_until };
}

export async function guestAcceptQuoteAction(
  quoteId: string,
  token: string,
): Promise<ActionResult> {
  const gate = await gateByToken(quoteId, token);
  if (!gate.ok) return gate;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("quotes")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", quoteId);
  if (error) return { ok: false, error: "Could not record your acceptance." };

  revalidatePath(`/q/${quoteId}/${token}`);
  return { ok: true };
}

export async function guestDeclineQuoteAction(
  quoteId: string,
  token: string,
): Promise<ActionResult> {
  const gate = await gateByToken(quoteId, token);
  if (!gate.ok) return gate;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("quotes")
    .update({
      status: "declined",
      declined_at: new Date().toISOString(),
    })
    .eq("id", quoteId);
  if (error) return { ok: false, error: "Could not record your decline." };

  revalidatePath(`/q/${quoteId}/${token}`);
  return { ok: true };
}
