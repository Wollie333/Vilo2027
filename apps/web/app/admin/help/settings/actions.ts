"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";

const trendingSchema = z.object({
  trending: z.array(z.string().min(1).max(60)).max(10),
  reason: z.string().optional(),
});

const contactSchema = z.object({
  liveChatOnline: z.boolean(),
  callbackEnabled: z.boolean(),
  supportEmail: z.string().email(),
  medianResponseMinutes: z.number().int().min(1).max(180),
  communityMemberCount: z.number().int().min(0).max(10_000_000),
  reason: z.string().optional(),
});

const communityThreadSchema = z.object({
  title: z.string().min(3).max(160),
  author: z.string().min(1).max(60),
  replies: z.number().int().min(0).max(99999),
  ago: z.string().min(1).max(40),
  initials: z.string().min(1).max(4),
  accent: z.enum(["primary", "secondary", "mute"]),
});

const communitySchema = z.object({
  community: z.array(communityThreadSchema).max(10),
  reason: z.string().optional(),
});

async function upsertSetting(
  service: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  key: string,
  value: unknown,
) {
  const { error } = await service
    .from("help_settings")
    .upsert({
      key,
      value: value as never,
      updated_at: new Date().toISOString(),
    })
    .eq("key", key);
  if (error) throw new Error(error.message);
}

export const saveTrendingAction = withAdminAudit<
  z.infer<typeof trendingSchema>,
  { ok: true }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.settings.trending",
    targetType: "help_settings",
    getTargetId: () => "00000000-0000-0000-0000-000000000001",
  },
  async (args, service) => {
    await upsertSetting(service, "trending", args.trending);
    revalidatePath("/admin/help/settings");
    revalidatePath("/dashboard/help");
    revalidatePath("/help");
    return { result: { ok: true }, after: { trending: args.trending } };
  },
);

export const saveContactAction = withAdminAudit<
  z.infer<typeof contactSchema>,
  { ok: true }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.settings.contact",
    targetType: "help_settings",
    getTargetId: () => "00000000-0000-0000-0000-000000000002",
  },
  async (args, service) => {
    const payload = {
      live_chat_online: args.liveChatOnline,
      callback_enabled: args.callbackEnabled,
      support_email: args.supportEmail,
      median_response_minutes: args.medianResponseMinutes,
      community_member_count: args.communityMemberCount,
    };
    await upsertSetting(service, "contact", payload);
    revalidatePath("/admin/help/settings");
    revalidatePath("/dashboard/help");
    revalidatePath("/help");
    return { result: { ok: true }, after: payload };
  },
);

export const saveCommunityAction = withAdminAudit<
  z.infer<typeof communitySchema>,
  { ok: true }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.settings.community",
    targetType: "help_settings",
    getTargetId: () => "00000000-0000-0000-0000-000000000003",
  },
  async (args, service) => {
    await upsertSetting(service, "community", args.community);
    revalidatePath("/admin/help/settings");
    revalidatePath("/dashboard/help");
    revalidatePath("/help");
    return { result: { ok: true }, after: { community: args.community } };
  },
);

export async function saveTrending(input: {
  trending: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = trendingSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  try {
    await saveTrendingAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function saveContact(input: {
  liveChatOnline: boolean;
  callbackEnabled: boolean;
  supportEmail: string;
  medianResponseMinutes: number;
  communityMemberCount: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  try {
    await saveContactAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function saveCommunity(input: {
  community: z.infer<typeof communityThreadSchema>[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = communitySchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  try {
    await saveCommunityAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}
