"use client";

import { useRouter } from "next/navigation";

export function ListingPicker({
  listings,
  current,
}: {
  listings: Array<{ id: string; name: string }>;
  current: string;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 rounded border border-brand-line bg-white px-3 py-2 text-sm">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        Listing
      </span>
      <select
        value={current}
        onChange={(e) =>
          router.push(`/dashboard/calendar?listing=${e.target.value}`)
        }
        className="bg-transparent font-medium text-brand-ink outline-none"
      >
        {listings.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
