import { Bug, LifeBuoy } from "lucide-react";
import type { ReactNode } from "react";

import { InboxSystemCard, type InboxCardTone } from "./InboxSystemCard";

// Renders a guest "Get help" / "Report a bug" ticket
// (system_event='support_ticket') as the shared premium inbox card, so a
// support request looks the same and as professional as every other system
// card in the thread. Parses the plain-text ticket body written by
// submitHelpRequestAction:
//
//   <Category · TKT-XXXX>
//   Booking: BK-0085
//   Room: Private room
//   Dates: 10 Sep 2026 → 13 Sep 2026
//   Guests: 2 guests
//   <blank line>
//   <free-text message>
//
// The first line is the title, the "Label: value" lines before the blank line
// are the context chips, and everything after is the guest's message.
export function GuestBookingSupportCard({
  body,
  footer,
}: {
  body: string;
  footer?: ReactNode;
}) {
  const lines = (body ?? "").split("\n");
  // Strip a leading emoji/symbol so the card title is clean (the icon conveys it).
  const title = lines[0]?.replace(/^[^\w]+/, "").trim() || "Support request";
  const rest = lines.slice(1);
  const blankIdx = rest.findIndex((l) => l.trim() === "");
  const contextLines = (blankIdx >= 0 ? rest.slice(0, blankIdx) : rest).filter(
    (l) => l.includes(":"),
  );
  const message =
    blankIdx >= 0
      ? rest
          .slice(blankIdx + 1)
          .join("\n")
          .trim()
      : "";

  const isBug = /^bug/i.test(title);
  const tone: InboxCardTone = isBug ? "rose" : "sky";
  const icon = isBug ? (
    <Bug className="h-5 w-5" />
  ) : (
    <LifeBuoy className="h-5 w-5" />
  );

  return (
    <InboxSystemCard tone={tone} icon={icon} title={title} footer={footer}>
      {contextLines.length > 0 ? (
        <div className="space-y-0.5 rounded-[10px] bg-brand-light/60 px-3 py-2 text-[12px]">
          {contextLines.map((l, i) => {
            const idx = l.indexOf(":");
            const k = l.slice(0, idx).trim();
            const v = l.slice(idx + 1).trim();
            return (
              <div key={`${k}-${i}`}>
                <span className="text-brand-mute">{k}:</span>{" "}
                <span className="font-medium text-brand-ink">{v}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      {message ? (
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-brand-ink">
          {message}
        </p>
      ) : null}
    </InboxSystemCard>
  );
}
