"use client";

import {
  FileText,
  Printer,
  Receipt,
  ScrollText,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";

// Admin-facing viewer for the immutable legal snapshots a user consented to.
// Records are minted per booking, so booking consents are batched by booking
// number; account/programme consents (affiliate agreement, competition rules)
// sit in their own section. Clicking any document opens the exact stored text,
// with Print / Save as PDF. Nothing here can alter a record.

export type LegalAcceptance = {
  id: string;
  kind: string;
  title: string;
  version: string;
  /** ISO timestamp, or "" for booking-scoped docs (the booking carries the date). */
  acceptedAt: string;
  ip: string | null;
  signatory: string | null;
  sha256: string | null;
  bodyHtml: string;
  context?: string | null;
};

export type BookingGroup = {
  bookingId: string;
  reference: string;
  date: string;
  role: "guest" | "host";
  counterparty: string | null;
  docs: LegalAcceptance[];
};

function fmtDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function fmtDateTime(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Open a clean, print-ready window of just this signed document → Save as PDF. */
function printSnapshot(a: LegalAcceptance, groupLabel?: string) {
  const w = window.open("", "_blank", "width=820,height=1040");
  if (!w) return;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const metaBits = [
    `<strong>Version:</strong> ${esc(a.version)}`,
    a.context ? esc(a.context) : "",
    groupLabel ? esc(groupLabel) : "",
    a.acceptedAt ? `Accepted ${esc(fmtDateTime(a.acceptedAt))}` : "",
    a.ip ? `IP ${esc(a.ip)}` : "",
    a.signatory ? esc(a.signatory) : "",
  ].filter(Boolean);
  w.document.write(`<!doctype html><html><head><meta charset="utf-8" />
<title>${esc(a.title)} — ${esc(a.version)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #14201b; max-width: 720px; margin: 0 auto; padding: 48px 40px; line-height: 1.55; }
  .hd { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  .meta { font-family: system-ui, sans-serif; font-size: 12px; color: #5b6b63; }
  .rule { border: none; border-top: 1px solid #d9e2dd; margin: 18px 0 24px; }
  .doc h2 { font-size: 16px; margin: 18px 0 6px; }
  .doc h3 { font-size: 14px; margin: 14px 0 4px; }
  .doc p, .doc li { font-size: 13.5px; }
  .doc ol, .doc ul { padding-left: 22px; }
  .foot { font-family: ui-monospace, monospace; font-size: 10px; color: #8a988f; margin-top: 32px; border-top: 1px solid #eef3f0; padding-top: 10px; word-break: break-all; }
  @media print { body { padding: 24px 8px; } }
</style></head><body>
<div class="hd">
  <h1>${esc(a.title)}</h1>
  <div class="meta">${metaBits.join(" &middot; ")}</div>
</div>
<hr class="rule" />
<div class="doc">${a.bodyHtml || "<p><em>(no text stored)</em></p>"}</div>
${a.sha256 ? `<div class="foot">Integrity hash (SHA-256): ${esc(a.sha256)}</div>` : ""}
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

const KIND_ICON: Record<string, typeof FileText> = {
  "Affiliate agreement": ShieldCheck,
  "Competition rules": ShieldCheck,
  "Platform consent": FileText,
  "Booking policy": ScrollText,
};

function DocRow({
  doc,
  onOpen,
}: {
  doc: LegalAcceptance;
  onOpen: (d: LegalAcceptance) => void;
}) {
  const Icon = KIND_ICON[doc.kind] ?? FileText;
  return (
    <button
      type="button"
      onClick={() => onOpen(doc)}
      className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-brand-light/50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-brand-light text-brand-mute group-hover:text-brand-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-brand-ink group-hover:text-brand-primary">
          {doc.title}
        </span>
        <span className="block truncate text-[11px] text-brand-mute">
          {doc.kind}
          {doc.context ? ` · ${doc.context}` : ""}
        </span>
      </span>
      <span className="rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {doc.version}
      </span>
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary opacity-0 transition group-hover:opacity-100">
        <FileText className="h-3.5 w-3.5" />
        View
      </span>
    </button>
  );
}

export function LegalSnapshotViewer({
  account,
  bookings,
  emptyText = "No signed documents on record for this user yet.",
  showRole = true,
}: {
  account: LegalAcceptance[];
  bookings: BookingGroup[];
  emptyText?: string;
  /** Admin (platform) view shows the as-guest/as-host role + counterparty on
   *  each booking. The host guest record (always the guest's booking with this
   *  host) sets this false: no role badge, and the counterparty renders plainly
   *  (the property) without a "host:/guest:" prefix. */
  showRole?: boolean;
}) {
  const [open, setOpen] = useState<{
    doc: LegalAcceptance;
    groupLabel?: string;
  } | null>(null);

  if (account.length === 0 && bookings.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-brand-light/40 p-8 text-center text-[13px] text-brand-mute">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {account.length > 0 ? (
        <section>
          <SectionLabel label="Account & platform" count={account.length} />
          <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="divide-y divide-brand-line">
              {account.map((d) => (
                <DocRow key={d.id} doc={d} onOpen={(doc) => setOpen({ doc })} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {bookings.length > 0 ? (
        <section>
          <SectionLabel label="Bookings" count={bookings.length} />
          <div className="space-y-3">
            {bookings.map((g) => {
              const label = `Booking ${g.reference}`;
              return (
                <div
                  key={g.bookingId}
                  className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-brand-line bg-[#FAFCFB] px-4 py-2.5">
                    <Receipt className="h-4 w-4 shrink-0 text-brand-primary" />
                    <span className="font-display text-[13.5px] font-bold text-brand-ink">
                      {g.reference}
                    </span>
                    {showRole ? (
                      <span
                        className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          g.role === "host"
                            ? "bg-brand-secondary/10 text-brand-secondary"
                            : "bg-brand-accent text-brand-primary"
                        }`}
                      >
                        {g.role === "host" ? "As host" : "As guest"}
                      </span>
                    ) : null}
                    {g.counterparty ? (
                      <span className="text-[11.5px] text-brand-mute">
                        {showRole
                          ? `${g.role === "host" ? "guest" : "host"}: ${g.counterparty}`
                          : g.counterparty}
                      </span>
                    ) : null}
                    <span className="ml-auto text-[11.5px] text-brand-mute">
                      {fmtDate(g.date)}
                    </span>
                  </div>
                  <div className="divide-y divide-brand-line">
                    {g.docs.map((d) => (
                      <DocRow
                        key={d.id}
                        doc={d}
                        onOpen={(doc) => setOpen({ doc, groupLabel: label })}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-card border border-brand-line bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-brand-line px-5 py-3.5">
              <div className="min-w-0">
                <div className="font-display text-[15px] font-bold text-brand-ink">
                  {open.doc.title}
                </div>
                <div className="mt-0.5 text-[11.5px] text-brand-mute">
                  {[
                    `Version ${open.doc.version}`,
                    open.doc.context,
                    open.groupLabel,
                    open.doc.acceptedAt
                      ? `Accepted ${fmtDateTime(open.doc.acceptedAt)}`
                      : "",
                    open.doc.ip ? `IP ${open.doc.ip}` : "",
                    open.doc.signatory,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => printSnapshot(open.doc, open.groupLabel)}
                  className="btn-pri inline-flex h-8 items-center gap-1.5"
                >
                  <Printer className="h-4 w-4" />
                  Print / Save as PDF
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  aria-label="Close"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div
              className="legal-prose flex-1 overflow-y-auto px-5 py-4 text-[13.5px] leading-relaxed text-brand-mute [&_a]:text-brand-primary [&_a]:underline [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-brand-ink [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-brand-ink [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_strong]:text-brand-ink [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{
                __html:
                  open.doc.bodyHtml && open.doc.bodyHtml.trim().length > 0
                    ? open.doc.bodyHtml
                    : "<p><em>No text stored for this record.</em></p>",
              }}
            />
            {open.doc.sha256 ? (
              <div className="mono border-t border-brand-line px-5 py-2 text-[10px] text-brand-mute">
                Integrity hash (SHA-256): {open.doc.sha256}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-mute">
        {label}
      </span>
      <span className="rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
        {count}
      </span>
      <span className="h-px flex-1 bg-brand-line" />
    </div>
  );
}
