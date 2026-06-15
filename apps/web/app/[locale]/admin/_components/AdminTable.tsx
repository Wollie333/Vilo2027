import * as React from "react";

// Canonical admin table — matches the host **Guests list** design
// (dashboard/guests): white header with uppercase muted labels, divided rows,
// hover. Server component; pass column render fns. Used across every admin list
// (users, listings, bookings, payments, ledger) so they all feel identical to
// the host's tables.

export type AdminColumn<T> = {
  header: string;
  align?: "left" | "right";
  className?: string;
  cell: (row: T) => React.ReactNode;
};

export function AdminTable<T>({
  columns,
  rows,
  getKey,
  empty = "Nothing here yet.",
  topBar,
}: {
  columns: AdminColumn<T>[];
  rows: T[];
  getKey: (row: T) => string;
  empty?: string;
  /** Optional bar inside the card above the table (e.g. segment tabs). */
  topBar?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      {topBar}
      <div className="overflow-x-auto">
        {rows.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-brand-line text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]">
              <tr>
                {columns.map((c, i) => (
                  <th
                    key={i}
                    className={`px-4 py-2.5 ${
                      c.align === "right" ? "text-right" : ""
                    } ${c.className ?? ""}`}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {rows.map((row) => (
                <tr key={getKey(row)} className="hover:bg-brand-light/40">
                  {columns.map((c, i) => (
                    <td
                      key={i}
                      className={`px-4 py-3 align-middle ${
                        c.align === "right" ? "text-right" : ""
                      } ${c.className ?? ""}`}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-brand-mute">
            {empty}
          </p>
        )}
      </div>
    </div>
  );
}
