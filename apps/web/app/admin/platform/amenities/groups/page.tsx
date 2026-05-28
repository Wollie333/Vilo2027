import Link from "next/link";

import { requirePermission } from "@/lib/admin";
import { getAmenitiesForAdmin } from "@/lib/taxonomy/getAmenities";

import { GroupsEditor } from "./GroupsEditor";

export const dynamic = "force-dynamic";

export default async function AmenityGroupsPage() {
  await requirePermission("taxonomy.manage");
  const { groups } = await getAmenitiesForAdmin();

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/platform/amenities"
          className="text-[12px] font-medium text-brand-mute hover:text-brand-ink"
        >
          ← Amenities
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold text-brand-ink">
          Amenity groups
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-brand-mute">
          Groups organise amenities into sections (Essentials, Outdoor, Family,
          Safety, Accessibility). Each amenity belongs to exactly one group.
        </p>
      </header>

      <GroupsEditor rows={groups.filter((g) => !g.deleted_at)} />
    </div>
  );
}
