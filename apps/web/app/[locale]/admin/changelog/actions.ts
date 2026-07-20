"use server";

import { revalidatePath } from "next/cache";

import { withAdminAudit } from "@/lib/admin";
import { sanitiseListingHtml } from "@/lib/sanitiseHtml";

const PERMISSION = "platform.settings" as const;

function normaliseSlug(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type SaveChangelogInput = {
  id?: string;
  slug: string;
  title: string;
  html: string;
  creditedHostId?: string | null;
  creditedName?: string | null;
  featureRequestId?: string | null;
  shippedAt?: string | null; // YYYY-MM-DD or empty
  isPublished: boolean;
  reason?: string;
};

export const saveChangelogEntryAction = withAdminAudit<
  SaveChangelogInput,
  { id: string }
>(
  {
    permissionKey: PERMISSION,
    actionName: "changelog_entry.save",
    targetType: "changelog_entry",
    getTargetId: (a) => a.id ?? "",
  },
  async (args, service) => {
    const slug = normaliseSlug(args.slug);
    const title = args.title.trim();
    if (slug.length < 2) throw new Error("Enter a valid slug.");
    if (title.length < 2) throw new Error("Enter a title.");

    const html = args.html.trim();
    const bodyHtml = html.length > 0 ? sanitiseListingHtml(html) : null;
    const shippedAt =
      args.shippedAt && args.shippedAt.length > 0
        ? new Date(`${args.shippedAt}T12:00:00Z`).toISOString()
        : null;

    // Snapshot the credit name from the chosen host (canonical), else free text.
    let creditedName = args.creditedName?.trim() || null;
    const creditedHostId = args.creditedHostId || null;
    if (creditedHostId) {
      const { data: host } = await service
        .from("hosts")
        .select("user_profiles:user_id(full_name, email)")
        .eq("id", creditedHostId)
        .maybeSingle();
      const profile = host?.user_profiles as unknown as {
        full_name: string | null;
        email: string | null;
      } | null;
      creditedName =
        profile?.full_name?.trim() || profile?.email || creditedName;
    }

    const fields = {
      slug,
      title,
      body_html: bodyHtml,
      credited_host_id: creditedHostId,
      credited_name: creditedName,
      feature_request_id: args.featureRequestId || null,
      shipped_at: shippedAt,
      is_published: args.isPublished,
      // Stamp published_at the first time it goes live.
      ...(args.isPublished ? { published_at: new Date().toISOString() } : {}),
    };

    let id = args.id ?? "";
    if (args.id) {
      const { error } = await service
        .from("changelog_entries")
        .update(fields)
        .eq("id", args.id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await service
        .from("changelog_entries")
        .insert(fields)
        .select("id")
        .single();
      if (error) {
        if (error.message.toLowerCase().includes("duplicate")) {
          throw new Error("That slug is already in use.");
        }
        throw new Error(error.message);
      }
      id = data.id;
    }

    revalidatePath("/admin/changelog");
    revalidatePath("/change-log");
    return { result: { id }, after: { id, ...fields } };
  },
);

export const deleteChangelogEntryAction = withAdminAudit<
  { id: string; reason?: string },
  { ok: true }
>(
  {
    permissionKey: PERMISSION,
    actionName: "changelog_entry.delete",
    targetType: "changelog_entry",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const { data, error } = await service
      .from("changelog_entries")
      .delete()
      .eq("id", args.id)
      .select("id, title")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/changelog");
    revalidatePath("/change-log");
    return { result: { ok: true }, after: data };
  },
);
