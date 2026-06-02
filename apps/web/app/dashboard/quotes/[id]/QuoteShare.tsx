"use client";

import { Copy, Mail, MessageCircle, MessagesSquare } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { shareQuoteToInboxAction } from "../actions";

// wa.me wants a country-coded number with no symbols. SA mobiles entered as
// 0XX… → 27XX…; anything else is just stripped to digits and used as-is.
function waNumber(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("0")) return `27${digits.slice(1)}`;
  return digits;
}

export function QuoteShare({
  quoteId,
  acceptUrl,
  guestName,
  guestEmail,
  guestPhone,
  quoteNumber,
  listingName,
  total,
  currency,
}: {
  quoteId: string;
  acceptUrl: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  quoteNumber: string;
  listingName: string;
  total: number;
  currency: string;
}) {
  const [pending, start] = useTransition();

  const symbol = currency === "ZAR" ? "R " : `${currency} `;
  const amount = `${symbol}${Math.round(total).toLocaleString("en-ZA").replace(/,/g, " ")}`;
  const firstName = guestName.trim().split(/\s+/)[0] || "there";
  const message = `Hi ${firstName}, here's your quote ${quoteNumber} for ${listingName} — ${amount}. View and accept it here: ${acceptUrl}`;

  const waHref = `https://wa.me/${waNumber(guestPhone)}?text=${encodeURIComponent(message)}`;
  const mailHref = `mailto:${encodeURIComponent(guestEmail)}?subject=${encodeURIComponent(
    `Your quote ${quoteNumber} — ${listingName}`,
  )}&body=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(acceptUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — select the link manually.");
    }
  }

  function sendToInbox() {
    start(async () => {
      const r = await shareQuoteToInboxAction(quoteId, acceptUrl);
      if (r.ok) toast.success("Posted to the guest's inbox thread");
      else toast.error(r.error);
    });
  }

  return (
    <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <h2 className="font-display text-base font-bold text-brand-ink">
        Share with guest
      </h2>
      <p className="mt-1 text-xs text-brand-mute">
        Send the guest their quote link — they can review, accept or decline
        without a Vilo account.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          asChild
          className="gap-1.5 bg-[#25D366] text-white hover:bg-[#1da851]"
        >
          <a href={waHref} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </Button>
        <Button asChild variant="outline" className="gap-1.5">
          <a href={mailHref}>
            <Mail className="h-4 w-4" /> Email
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={sendToInbox}
          disabled={pending}
          className="gap-1.5"
        >
          <MessagesSquare className="h-4 w-4" />
          {pending ? "Posting…" : "Vilo inbox"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={copy}
          className="gap-1.5"
        >
          <Copy className="h-4 w-4" /> Copy link
        </Button>
      </div>

      <code className="mt-3 block overflow-x-auto rounded border border-brand-line bg-brand-light/40 px-3 py-2 font-mono text-[11px] text-brand-ink">
        {acceptUrl}
      </code>
    </section>
  );
}
