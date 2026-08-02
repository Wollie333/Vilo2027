"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { guestPostToWieloThread } from "@/lib/inbox/platform-thread";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

// Reusable "Get help" / "Report a bug" ticket filer. Files the request into the
// guest's existing Wielo Support thread (channel='platform') as a formatted
// message so it lands in /admin/inbox as unread — no new table needed. The
// category makes it extensible: 'support' today, 'bug' for a future bug-report
// entry point, both sharing this one action + modal.

const CATEGORY_META = {
  support: { emoji: "🆘", label: "Support request" },
  bug: { emoji: "🐞", label: "Bug report" },
} as const;

export type HelpCategory = keyof typeof CATEGORY_META;

const helpSchema = z.object({
  category: z.enum(["support", "bug"]).default("support"),
  message: z.string().trim().min(5, "Add a little more detail.").max(4000),
  // Optional human source label ("Trip · Seaview Cottage") + structured context
  // lines ({label, value}) captured from wherever the modal was opened.
  sourceLabel: z.string().trim().max(200).optional().nullable(),
  context: z
    .array(
      z.object({
        label: z.string().trim().max(80),
        value: z.string().trim().max(400),
      }),
    )
    .max(12)
    .optional()
    .nullable(),
  // Booking the ticket is about (when opened from a trip) — links it so the
  // trip timeline surfaces "You contacted Wielo Support".
  bookingId: z.string().uuid().optional().nullable(),
});

export type SubmitHelpResult =
  | { ok: true; ticket: string }
  | { ok: false; error: string };

// A short, human-readable ticket reference. Not a durable DB key (the thread
// message IS the record) — a reference the guest and support can quote.
function makeTicketRef(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `TKT-${s}`;
}

export async function submitHelpRequestAction(input: {
  category?: HelpCategory;
  message: string;
  sourceLabel?: string | null;
  context?: { label: string; value: string }[] | null;
  bookingId?: string | null;
}): Promise<SubmitHelpResult> {
  const parsed = helpSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the form.",
    };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to contact support." };

  const meta = CATEGORY_META[parsed.data.category];
  const ticket = makeTicketRef();

  // Build the ticket body: header (emoji · type · ticket#), a source/context
  // block so support has everything without asking, then the free text.
  const lines: string[] = [`${meta.emoji} ${meta.label} · ${ticket}`];
  if (parsed.data.sourceLabel) lines.push(`About: ${parsed.data.sourceLabel}`);
  for (const c of parsed.data.context ?? []) {
    if (c.value) lines.push(`${c.label}: ${c.value}`);
  }
  lines.push("", parsed.data.message.trim());
  const body = lines.join("\n");

  try {
    await guestPostToWieloThread(createAdminClient(), {
      guestUserId: user.id,
      body,
      // Renders as the premium GuestBookingSupportCard in the thread (and a
      // readable plain-text fallback anywhere the card isn't wired).
      systemEvent: "support_ticket",
      bookingId: parsed.data.bookingId ?? null,
    });
  } catch {
    return { ok: false, error: "Couldn't file your request. Try again." };
  }

  revalidatePath("/portal/inbox");
  return { ok: true, ticket };
}
