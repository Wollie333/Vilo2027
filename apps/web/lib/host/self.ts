import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// The app never lets a host/user send a quote, booking, message or enquiry to
// THEMSELVES — the recipient is, by definition, someone else. Email is the
// canonical guest identity (BUSINESS_PRINCIPLES #1). Returns true when the given
// email or guest account belongs to the signed-in user.
//
// Pass the signed-in user's own email when you already have it (avoids a query);
// otherwise it's resolved from user_profiles by userId.
export async function isSelfRecipient(opts: {
  userId: string;
  selfEmail?: string | null;
  recipientEmail?: string | null;
  recipientGuestId?: string | null;
}): Promise<boolean> {
  if (opts.recipientGuestId && opts.recipientGuestId === opts.userId) {
    return true;
  }
  const recipient = opts.recipientEmail?.trim().toLowerCase();
  if (!recipient) return false;

  let self = opts.selfEmail?.trim().toLowerCase() ?? null;
  if (!self) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("user_profiles")
      .select("email")
      .eq("id", opts.userId)
      .maybeSingle();
    self = data?.email?.trim().toLowerCase() ?? null;
  }
  return Boolean(self) && self === recipient;
}

export const SELF_RECIPIENT_ERROR =
  "You can't send this to your own account — enter a different person's details.";
