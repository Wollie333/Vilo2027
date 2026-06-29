"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { removeHostStaff } from "../[id]/actions";

type Row = {
  hostId: string;
  userId: string;
  hostName: string | null;
  hostHandle: string | null;
  email: string | null;
  fullName: string | null;
  createdAt: string;
};

export function HostStaffGlobalList({ rows: initial }: { rows: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.hostName, r.hostHandle, r.email, r.fullName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  function remove(r: Row) {
    start(async () => {
      const res = await removeHostStaff({ hostId: r.hostId, userId: r.userId });
      if (res.ok) {
        setRows((prev) =>
          prev.filter((x) => !(x.hostId === r.hostId && x.userId === r.userId)),
        );
        toast.success("Staff removed.");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-mute" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search host or staff…"
          className="w-full rounded-[10px] border border-brand-line bg-white py-2 pl-8 pr-3 text-sm text-brand-ink outline-none focus:border-brand-primary"
        />
      </div>

      <div className="overflow-hidden rounded-card border border-brand-line bg-white">
        <table className="w-full text-[13px]">
          <thead className="border-b border-brand-line text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]">
            <tr>
              <th className="px-4 py-2.5">Host</th>
              <th className="px-4 py-2.5">Staff member</th>
              <th className="px-4 py-2.5">Added</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={`${r.hostId}:${r.userId}`}
                className="border-b border-brand-line last:border-0"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/admin/hosts/${r.hostId}`}
                    className="font-medium text-brand-primary underline-offset-2 hover:underline"
                  >
                    {r.hostName ?? r.hostHandle ?? r.hostId.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <div className="text-brand-ink">{r.fullName ?? "—"}</div>
                  <div className="font-mono text-[11px] text-brand-mute">
                    {r.email ?? r.userId.slice(0, 8)}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-brand-mute">
                  {new Date(r.createdAt).toLocaleDateString("en-ZA")}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(r)}
                    className="inline-flex items-center gap-1 rounded border border-brand-line bg-white px-2.5 py-1 text-[12px] font-medium text-brand-mute transition-colors hover:bg-brand-light hover:text-status-cancelled disabled:opacity-50"
                  >
                    <X className="h-3 w-3" /> Remove
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-brand-mute"
                >
                  No host staff assignments.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
