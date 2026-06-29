import { CheckCircle2, XCircle } from "lucide-react";

import { getBrandName } from "@/lib/brand";

type Cell =
  | { kind: "check" }
  | { kind: "x" }
  | { kind: "text"; text: string; tone?: "mute" | "dark" | "primary" };

type Row = {
  feature: string;
  wielo: Cell;
  airbnb: Cell;
  booking: Cell;
  diy: Cell;
  emphasized?: boolean;
};

const ROWS: Row[] = [
  {
    feature: "Booking commission",
    wielo: { kind: "text", text: "0%", tone: "primary" },
    airbnb: { kind: "text", text: "15–18%", tone: "dark" },
    booking: { kind: "text", text: "15–22%", tone: "dark" },
    diy: { kind: "text", text: "0%", tone: "mute" },
  },
  {
    feature: "Own the guest relationship",
    wielo: { kind: "check" },
    airbnb: { kind: "x" },
    booking: { kind: "x" },
    diy: { kind: "check" },
  },
  {
    feature: "Unified inbox",
    wielo: { kind: "check" },
    airbnb: { kind: "text", text: "in-app only", tone: "mute" },
    booking: { kind: "text", text: "in-app only", tone: "mute" },
    diy: { kind: "x" },
  },
  {
    feature: "iCal calendar sync",
    wielo: { kind: "check" },
    airbnb: { kind: "check" },
    booking: { kind: "check" },
    diy: { kind: "text", text: "DIY", tone: "mute" },
  },
  {
    feature: "Paystack, PayPal & EFT",
    wielo: { kind: "check" },
    airbnb: { kind: "text", text: "card only", tone: "mute" },
    booking: { kind: "text", text: "card only", tone: "mute" },
    diy: { kind: "text", text: "DIY", tone: "mute" },
  },
  {
    feature: "Refund & policy manager",
    wielo: { kind: "check" },
    airbnb: { kind: "check" },
    booking: { kind: "check" },
    diy: { kind: "x" },
  },
  {
    feature: "Monthly cost (5 listings)",
    wielo: { kind: "text", text: "R 499", tone: "primary" },
    airbnb: { kind: "text", text: "~R 11 700", tone: "mute" },
    booking: { kind: "text", text: "~R 14 300", tone: "mute" },
    diy: { kind: "text", text: "R 2 000+", tone: "mute" },
    emphasized: true,
  },
];

function CellView({ cell }: { cell: Cell }) {
  if (cell.kind === "check") {
    return <CheckCircle2 className="h-5 w-5 text-status-confirmed" />;
  }
  if (cell.kind === "x") {
    return <XCircle className="h-5 w-5 text-status-cancelled" />;
  }
  const toneClass =
    cell.tone === "primary"
      ? "text-brand-primary font-semibold"
      : cell.tone === "dark"
        ? "text-brand-dark font-medium"
        : "text-brand-mute text-xs";
  return <span className={toneClass}>{cell.text}</span>;
}

export async function Comparison() {
  const brandName = await getBrandName();
  return (
    <section className="border-b border-brand-line bg-white">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="mb-12 max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Side by side
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
            How {brandName} stacks up.
          </h2>
        </div>

        <div className="overflow-x-auto rounded-card border border-brand-line">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-brand-line bg-brand-light/60">
                <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-brand-mute">
                  Feature
                </th>
                <th className="px-5 py-4 text-left font-display font-semibold text-brand-primary">
                  {brandName}
                </th>
                <th className="px-5 py-4 text-left font-display font-medium text-brand-mute">
                  Airbnb
                </th>
                <th className="px-5 py-4 text-left font-display font-medium text-brand-mute">
                  Booking.com
                </th>
                <th className="px-5 py-4 text-left font-display font-medium text-brand-mute">
                  Your own site
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {ROWS.map((row) => (
                <tr
                  key={row.feature}
                  className={row.emphasized ? "bg-brand-accent/30" : ""}
                >
                  <td
                    className={`px-5 py-4 font-medium text-brand-dark ${row.emphasized ? "" : ""}`}
                  >
                    {row.feature}
                  </td>
                  <td
                    className={`px-5 py-4 ${row.emphasized ? "num-display font-display text-base font-bold text-brand-primary" : ""}`}
                  >
                    <CellView cell={row.wielo} />
                  </td>
                  <td
                    className={`px-5 py-4 ${row.emphasized ? "num-display font-display font-medium text-brand-mute" : ""}`}
                  >
                    <CellView cell={row.airbnb} />
                  </td>
                  <td
                    className={`px-5 py-4 ${row.emphasized ? "num-display font-display font-medium text-brand-mute" : ""}`}
                  >
                    <CellView cell={row.booking} />
                  </td>
                  <td
                    className={`px-5 py-4 ${row.emphasized ? "num-display font-display font-medium text-brand-mute" : ""}`}
                  >
                    <CellView cell={row.diy} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
