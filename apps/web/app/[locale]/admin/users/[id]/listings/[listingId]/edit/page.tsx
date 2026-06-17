import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { Editor } from "@/app/[locale]/dashboard/listings/[id]/edit/Editor";
import { loadListingEditorData } from "@/app/[locale]/dashboard/listings/[id]/edit/editorData";

export const dynamic = "force-dynamic";

// Admin-side full listing editor. Renders the exact same host Editor (every
// field) inside the admin content area, loaded with the service-role client so
// any host's listing is editable. Saves go through the shared edit actions,
// which let platform staff with listings.edit through the ownership gate and
// write an admin_audit_log row (surfaces on the user's Activity tab).
export default async function AdminEditListingPage({
  params,
  searchParams,
}: {
  params: { id: string; listingId: string };
  searchParams?: { tab?: string };
}) {
  // Listings are open to any active admin (financials + bookings are the
  // permission-gated areas; the admin layout already enforces staff access).
  await requireAdmin();

  const service = createAdminClient();

  // Keep the URL honest: the listing must belong to the user in the path.
  const { data: owner } = await service
    .from("properties")
    .select("name, host:hosts!inner ( user_id )")
    .eq("id", params.listingId)
    .maybeSingle();
  const ownerUserId = (owner as unknown as { host: { user_id: string } } | null)
    ?.host?.user_id;
  if (!owner || ownerUserId !== params.id) notFound();

  const data = await loadListingEditorData(service, params.listingId);
  if (!data) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admin/users/${params.id}?tab=listings`}
          className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 py-1.5 text-[13px] font-medium text-brand-ink transition-colors hover:bg-brand-light"
        >
          <ArrowLeft className="h-4 w-4 text-brand-mute" /> Back to user
        </Link>
        <div className="text-[13px] text-brand-mute">
          Editing{" "}
          <span className="font-semibold text-brand-ink">{owner.name}</span> as
          admin — changes are audited
        </div>
      </div>

      <Editor {...data} initialTab={searchParams?.tab} />
    </div>
  );
}
