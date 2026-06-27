import { Globe } from "lucide-react";

// A website contact/booking-form enquiry rendered inline in a conversation
// thread — the analogue of ThreadQuoteCard's "request" card, but for a
// website-sourced enquiry. It carries a "Website enquiry" pill so the host can
// tell at a glance this came through their site (not the booking engine), and
// lists the captured contact line. The guest's full submission still renders as
// the message bubble beneath it.
//
// Purely presentational + keyed on the `website_enquiry` system event — no DB
// shape change. The body it receives is the system message
// ("Website enquiry · Name · email · phone"); we strip the label prefix and
// show the remaining contact tokens as rows.

/** Split "Website enquiry · Name · email · phone" into its contact tokens. */
function contactTokens(body: string | null): string[] {
  if (!body) return [];
  return body
    .split("·")
    .map((s) => s.trim())
    .filter((s) => s && s.toLowerCase() !== "website enquiry");
}

export function WebsiteEnquiryCard({ body }: { body: string | null }) {
  const tokens = contactTokens(body);
  return (
    <div className="mx-auto my-1 max-w-[420px] overflow-hidden rounded-card border border-[#BAE6FD] bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-[#E0F2FE] bg-[#F0F9FF] px-4 py-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0EA5E9] text-white">
          <Globe className="h-4 w-4" />
        </span>
        <span className="inline-flex items-center rounded-pill bg-[#E0F2FE] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#0369A1]">
          Website enquiry
        </span>
      </div>
      {tokens.length > 0 ? (
        <dl className="space-y-1 px-4 py-3 text-[13px] leading-relaxed text-brand-ink">
          {tokens.map((tok, i) => (
            <div key={i} className="truncate">
              {tok}
            </div>
          ))}
        </dl>
      ) : (
        <p className="px-4 py-3 text-[13px] text-brand-mute">
          New enquiry from your website.
        </p>
      )}
    </div>
  );
}
