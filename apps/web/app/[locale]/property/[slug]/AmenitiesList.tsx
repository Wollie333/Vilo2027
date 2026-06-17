import { getAmenityIndex } from "@/lib/taxonomy/getAmenities";

import { AmenitiesDisclosure, type AmenityItem } from "./AmenitiesDisclosure";

export async function AmenitiesList({ keys }: { keys: string[] }) {
  if (keys.length === 0) {
    return (
      <p className="text-sm text-brand-mute">
        The host hasn&rsquo;t added amenities yet.
      </p>
    );
  }

  const catalog = await getAmenityIndex();

  const items: AmenityItem[] = keys.map((k) => {
    const entry = catalog.get(k);
    return {
      key: k,
      label: entry?.label ?? humanize(k),
      icon: entry?.icon ?? "check-circle-2",
    };
  });

  return <AmenitiesDisclosure items={items} />;
}

function humanize(key: string): string {
  return key
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
