import { SectionShell, SectionHeading, Muted, Card } from "./sections/_shared";

// Builder V3 — the booking CONFIRMATION card, shared by the LIVE /book/thank-you
// route AND the builder's `booking_confirmation` system-page element, so both
// render the exact same markup (the live page IS the system page). Presentational
// only — the caller supplies the (real or demo) booking data. Every stylable part
// reads its `--el-<key>-*` var (host edits via the Style tab), with `--site-*`
// theme fallbacks so an unstyled card matches the active theme.

export type ConfirmationRow = { label: string; value: string };

export function BookingConfirmationCard({
  heading,
  message,
  rows,
  total,
  eft,
}: {
  heading: string;
  message: string;
  rows: ConfirmationRow[];
  /** Pre-formatted total (currency string), e.g. "R 3,900". */
  total: string;
  /** Banking-details rows for the EFT-pending state (null = card/confirmed). */
  eft?: ConfirmationRow[] | null;
}) {
  return (
    <SectionShell width="narrow">
      <SectionHeading
        className="mb-3"
        style={{
          color: "var(--el-title-fg, var(--site-ink))",
          fontSize: "var(--el-title-size, var(--site-h2))",
          fontWeight:
            "var(--el-title-weight, var(--site-weight-heading))" as unknown as number,
        }}
      >
        {heading}
      </SectionHeading>
      <Muted className="mb-8 text-center text-base">{message}</Muted>

      <Card
        className="p-6"
        style={{
          background: "var(--el-card-bg, var(--site-surface))",
          border: "var(--el-card-bd, 1px solid var(--site-card-border))",
          borderRadius: "var(--el-card-radius, var(--site-card-radius))",
          boxShadow: "var(--el-card-shadow, var(--site-card-shadow))",
        }}
      >
        <div className="space-y-2.5 text-sm">
          {rows.map((r) => (
            <Row key={r.label} label={r.label}>
              {r.value}
            </Row>
          ))}
          <div
            style={{ borderColor: "var(--site-line)" }}
            className="mt-2 flex items-center justify-between border-t pt-3"
          >
            <span
              style={{ color: "var(--el-total-fg, var(--site-ink))" }}
              className="font-semibold"
            >
              Total
            </span>
            <span
              style={{
                color: "var(--el-total-fg, var(--site-ink))",
                fontSize: "var(--el-total-size, 1.125rem)",
                fontWeight: "var(--el-total-weight, 700)" as unknown as number,
              }}
              className="text-lg font-bold"
            >
              {total}
            </span>
          </div>
        </div>

        {eft && eft.length > 0 ? (
          <div
            style={{
              borderColor: "var(--site-line)",
              background: "var(--el-bank-bg, transparent)",
              color: "var(--el-bank-fg, var(--site-ink))",
              borderRadius: "var(--el-bank-radius, 0px)",
            }}
            className="mt-5 border-t pt-5"
          >
            <h3
              style={{ color: "var(--el-bank-fg, var(--site-ink))" }}
              className="mb-3 text-sm font-semibold"
            >
              Banking details
            </h3>
            <div className="space-y-2 text-sm">
              {eft.map((r) => (
                <Row key={r.label} label={r.label}>
                  {r.value}
                </Row>
              ))}
            </div>
          </div>
        ) : null}
      </Card>
    </SectionShell>
  );
}

// Detail row — label uses the muted tone, value reads `--el-row-*` (Builder V3).
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3"
      style={{ fontSize: "var(--el-row-size, inherit)" }}
    >
      <span style={{ color: "var(--site-mute)" }}>{label}</span>
      <span
        style={{ color: "var(--el-row-fg, var(--site-ink))" }}
        className="text-right font-medium"
      >
        {children}
      </span>
    </div>
  );
}
