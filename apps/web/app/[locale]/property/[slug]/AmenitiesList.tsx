import { getAmenityCatalog } from "@/lib/taxonomy/getAmenities";
import { buildAmenityCategories } from "@/lib/taxonomy/groupAmenities";
import { AmenitiesCategorized } from "@/components/listing/AmenitiesCategorized";

/**
 * Marketplace listing amenities — grouped by admin-managed category (Booking.com
 * style) in Vilo green. A host's selected keys are matched against the published
 * catalog; keys not in the catalog (legacy/custom) fall into an "Other" bucket so
 * nothing is dropped.
 */
export async function AmenitiesList({ keys }: { keys: string[] }) {
  if (keys.length === 0) {
    return (
      <p className="text-sm text-brand-mute">
        The host hasn&rsquo;t added amenities yet.
      </p>
    );
  }

  const catalog = await getAmenityCatalog();
  const categories = buildAmenityCategories(catalog, keys);

  return <AmenitiesCategorized categories={categories} />;
}
