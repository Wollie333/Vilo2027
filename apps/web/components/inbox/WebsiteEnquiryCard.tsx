import { Globe } from "lucide-react";

import { InboxSystemCard } from "./InboxSystemCard";

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
    <InboxSystemCard
      tone="sky"
      icon={<Globe className="h-5 w-5" />}
      title="Website enquiry"
    >
      {tokens.length > 0 ? (
        <dl className="space-y-1 text-[13px] leading-relaxed text-brand-ink">
          {tokens.map((tok, i) => (
            <div key={i} className="truncate">
              {tok}
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-[13px] text-brand-mute">
          New enquiry from your website.
        </p>
      )}
    </InboxSystemCard>
  );
}
