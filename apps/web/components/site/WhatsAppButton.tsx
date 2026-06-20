import { MessageCircle } from "lucide-react";

import type { SiteConversion } from "@/lib/site/types";

/**
 * Floating WhatsApp click-to-chat button (Phase 6A slice 2). Pure presentational
 * — a fixed bottom-right link to `wa.me` with an optional pre-filled message.
 * Renders nothing unless enabled with a number. WhatsApp green is kept for
 * recognisability rather than the theme accent.
 */
export function WhatsAppButton({
  whatsapp,
}: {
  whatsapp?: SiteConversion["whatsapp"];
}) {
  if (!whatsapp?.enabled) return null;
  const digits = (whatsapp.number ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;

  const message = whatsapp.message?.trim();
  const href = `https://wa.me/${digits}${
    message ? `?text=${encodeURIComponent(message)}` : ""
  }`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lift transition-transform hover:scale-105"
    >
      <MessageCircle className="h-7 w-7" fill="currentColor" stroke="none" />
    </a>
  );
}
