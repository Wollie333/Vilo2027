import * as React from "react";

// Canonical admin table — matches the host **Guests list** design
// (dashboard/guests/GuestsBoard): a single rounded-card holding, top→bottom,
// the segment tabs, an in-card toolbar (search/filters) on #FBFDFC, the column
// header (uppercase muted labels), grid-feel rows with a #F8FCF9 hover and a
// brand accent bar, and an in-card footer (pagination) on #FBFDFC. Used across
// every admin list (users, listings, …) so they all feel identical to the host.

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
  toolbar,
  footer,
}: {
  columns: AdminColumn<T>[];
  rows: T[];
  getKey: (row: T) => string;
  empty?: string;
  /** Bar inside the card above the toolbar (e.g. segment tabs). */
  topBar?: React.ReactNode;
  /** In-card toolbar row (search/filters), on the host's #FBFDFC tint. */
  toolbar?: React.ReactNode;
  /** In-card footer row (pagination/summary), on the host's #FBFDFC tint. */
  footer?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      {topBar}
      {toolbar ? (
        <div className="border-b border-brand-line bg-[#FBFDFC] px-4 py-2.5">
          {toolbar}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        {rows.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-brand-line bg-white text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]">
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
            <tbody>
              {rows.map((row) => (
                <tr
                  key={getKey(row)}
                  className="border-b border-[#F1F6F2] transition-colors hover:bg-[#F8FCF9] hover:[box-shadow:inset_3px_0_0_0_#10B981]"
                >
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
      {footer ? (
        <div className="border-t border-brand-line bg-[#FBFDFC] px-4 py-3">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
