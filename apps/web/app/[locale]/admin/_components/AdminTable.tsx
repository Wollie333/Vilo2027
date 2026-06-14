import * as React from "react";

// Canonical admin table — matches the host dashboard table style (invoices /
// quotes): light header row, uppercase muted labels, divided rows, hover. Server
// component; pass column render fns. Used across every admin list so they feel
// identical.

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
}: {
  columns: AdminColumn<T>[];
  rows: T[];
  getKey: (row: T) => string;
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-brand-line bg-white shadow-card">
      {rows.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="bg-brand-light/60 text-left text-[11px] uppercase tracking-wider text-brand-mute">
            <tr>
              {columns.map((c, i) => (
                <th
                  key={i}
                  className={`px-4 py-3 font-semibold ${
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
  );
}
