import Link from "next/link";

import { requirePermission } from "@/lib/admin";
import { getAmenitiesForAdmin } from "@/lib/taxonomy/getAmenities";

import { AmenitiesEditor } from "./AmenitiesEditor";

export const dynamic = "force-dynamic";

export default async function AdminAmenitiesPage() {
  await requirePermission("taxonomy.manage");
  const { groups, items } = await getAmenitiesForAdmin();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Amenities
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-brand-mute">
            Shown to hosts when they edit a listing, and rendered on the public
            listing detail page. Group amenities so they read as collapsible
            sections to guests.
          </p>
        </div>
        <Link
          href="/admin/platform/amenities/groups"
          className="inline-flex h-9 items-center rounded-md border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-ink hover:bg-brand-light"
        >
          Manage groups
        </Link>
      </header>

      <AmenitiesEditor
        groups={groups.filter((g) => !g.deleted_at)}
        items={items.filter((i) => !i.deleted_at)}
      />
    </div>
  );
}
