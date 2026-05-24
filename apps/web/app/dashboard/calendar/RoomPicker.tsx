"use client";

import { useRouter, useSearchParams } from "next/navigation";

export type CalendarRoom = { id: string; name: string };

export function RoomPicker({
  listingId,
  rooms,
  current,
}: {
  listingId: string;
  rooms: CalendarRoom[];
  current: string;
}) {
  const router = useRouter();
  const search = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(search?.toString() ?? "");
    params.set("listing", listingId);
    if (value === "" || value === "any") {
      params.delete("room");
    } else {
      params.set("room", value);
    }
    router.push(`/dashboard/calendar?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 rounded border border-brand-line bg-white px-3 py-2 text-sm">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        Room
      </span>
      <select
        value={current || "any"}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-medium text-brand-ink outline-none"
      >
        <option value="any">Any room</option>
        <option value="whole">Whole place</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  );
}
