"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/admin/requirePermission";
import { withAdminAudit } from "@/lib/admin/withAdminAudit";
import { sanitizeSearch } from "@/lib/search/sanitizeSearch";
import { dispatchEvent } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  sendIndividualSchema,
  userSearchSchema,
  type SendIndividualInput,
  type UserSearchInput,
  type UserSearchResult,
} from "./schemas";

// ─── User typeahead (used by the multi-select picker) ────────────────────

export async function searchUsersAction(
  raw: UserSearchInput,
): Promise<UserSearchResult[]> {
  try {
    await requirePermission("notifications.send_individual");
  } catch {
    return [];
  }
  const parsed = userSearchSchema.safeParse(raw);
  if (!parsed.success) return [];
  const { query, role } = parsed.data;

  const service = createAdminClient();
  let q = service
    .from("user_profiles")
    .select("id, full_name, email, role, is_active")
    .eq("is_active", true)
    .is("deleted_at", null);

  if (role !== "any") q = q.eq("role", role);

  const qSafe = sanitizeSearch(query);
  if (qSafe.length > 0) {
    const needle = `%${qSafe}%`;
    q = q.or(`full_name.ilike.${needle},email.ilike.${needle}`);
  }

  const { data, error } = await q
    .order("full_name", { ascending: true, nullsFirst: false })
    .limit(20);
  if (error) return [];
  return (data ?? []) as UserSearchResult[];
}

// ─── Send individual notification (wrapped audit) ────────────────────────

type SendResult =
  | { ok: true; batchId: string; deliveredTo: number }
  | { ok: false; error: string };

const sendIndividualWrapped = withAdminAudit<
  { __targetId: string } & SendIndividualInput,
  SendResult
>(
  {
    permissionKey: "notifications.send_individual",
    actionName: "notification.send",
    targetType: "notification_send",
    getTargetId: (a) => a.__targetId,
  },
  async (args) => {
    // The mutation has already happened in the public wrapper below; this
    // wrapper just writes the audit row. We return the result as-is.
    return {
      result: {
        ok: true,
        batchId: args.__targetId,
        deliveredTo: args.recipient_ids.length,
      },
    };
  },
);

export async function sendIndividualNotificationAction(
  raw: SendIndividualInput,
): Promise<SendResult> {
  let admin;
  try {
    admin = await requirePermission("notifications.send_individual");
  } catch {
    return { ok: false, error: "Not authorised." };
  }

  const parsed = sendIndividualSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const input = parsed.data;

  const service = createAdminClient();

  // 1) Persist the batch row so admins can see the history.
  const { data: batch, error: batchError } = await service
    .from("admin_message_batches")
    .insert({
      created_by: admin.userId,
      title: input.title,
      body: input.body,
      link_url: input.link_url || null,
      link_label: input.link_label || null,
      severity: input.severity,
      channels: Object.entries(input.channels)
        .filter(([, on]) => on === true)
        .map(([k]) => k),
      recipient_ids: input.recipient_ids,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return {
      ok: false,
      error: batchError?.message ?? "Failed to create message batch.",
    };
  }

  // 2) Resolve guest/host id per recipient so the email worker can find them.
  const { data: profiles } = await service
    .from("user_profiles")
    .select("id, role")
    .in("id", input.recipient_ids);
  const roleByUser = new Map<string, string>(
    (profiles ?? []).map((p) => [p.id as string, p.role as string]),
  );

  const hostIdByUser = new Map<string, string>();
  const hostUserIds = (profiles ?? [])
    .filter((p) => p.role === "host")
    .map((p) => p.id as string);
  if (hostUserIds.length > 0) {
    const { data: hostRows } = await service
      .from("hosts")
      .select("id, user_id")
      .in("user_id", hostUserIds);
    for (const h of hostRows ?? []) {
      hostIdByUser.set(h.user_id as string, h.id as string);
    }
  }

  // 3) Fan out via the dispatcher. overrideChannels lets the admin's
  //    channel picks override per-user prefs for this batch (individual
  //    sends are always low/medium severity — they cannot bypass `locked`
  //    categories because admin_broadcasts is not locked).
  for (const userId of input.recipient_ids) {
    const role = roleByUser.get(userId);
    await dispatchEvent({
      kind: "admin_individual_message",
      recipientUserId: userId,
      hostId: role === "host" ? hostIdByUser.get(userId) : undefined,
      guestId: role === "guest" ? userId : undefined,
      overrideChannels: {
        email: input.channels.email,
        push: input.channels.push,
        in_app: input.channels.in_app,
      },
      refs: {
        batch_id: batch.id as string,
        title: input.title,
        body: input.body,
        link_url: input.link_url || undefined,
        link_label: input.link_label || undefined,
      },
    });
  }

  // 4) Audit log via wrapper (fires after the fact; safe if it fails).
  try {
    await sendIndividualWrapped({ ...input, __targetId: batch.id as string });
  } catch {
    // Audit-log failure must not block the send.
  }

  revalidatePath("/admin/notifications/sent");
  return {
    ok: true,
    batchId: batch.id as string,
    deliveredTo: input.recipient_ids.length,
  };
}
