import {
  Clock,
  Globe,
  Headphones,
  Mail,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";

import type { HelpContactSettings } from "@/lib/help/types";

type Props = {
  contact: HelpContactSettings;
};

export function ContactSupport({ contact }: Props) {
  return (
    <div
      id="contact"
      className="relative scroll-mt-20 overflow-hidden rounded-card bg-brand-dark p-6 text-white lg:p-8"
    >
      <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand-primary/25 blur-3xl" />
      <div className="absolute -bottom-12 left-1/3 h-40 w-40 rounded-full bg-brand-primary/15 blur-3xl" />

      <div className="relative">
        <div className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-white/15 backdrop-blur">
          <Headphones className="h-3 w-3" /> Talk to a human
        </div>
        <h3 className="mt-4 font-display text-2xl font-bold leading-tight lg:text-3xl">
          Still stuck? Our team is on it.
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-white/75">
          Real people based in Cape Town & Johannesburg. We respond to most
          tickets within 4 hours, 7 days a week.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            disabled={!contact.live_chat_online}
            className="rounded-card bg-white p-4 text-left text-brand-secondary transition-shadow hover:shadow-lift disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded bg-brand-accent text-brand-secondary">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div className="mt-3 font-display text-sm font-semibold">
              Live chat
            </div>
            <div className="mt-0.5 text-[11px] text-brand-mute">
              {contact.live_chat_online
                ? `~ ${contact.median_response_minutes} min response`
                : "Offline right now"}
            </div>
          </button>

          <a
            href={`mailto:${contact.support_email}`}
            className="rounded-card bg-white/10 p-4 text-left text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/15"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded bg-white/15 text-white">
              <Mail className="h-4 w-4" />
            </div>
            <div className="mt-3 font-display text-sm font-semibold">
              Email us
            </div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-white/70">
              {contact.support_email}
            </div>
          </a>

          <button
            type="button"
            disabled={!contact.callback_enabled}
            className="rounded-card bg-white/10 p-4 text-left text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded bg-white/15 text-white">
              <PhoneCall className="h-4 w-4" />
            </div>
            <div className="mt-3 font-display text-sm font-semibold">
              Request a callback
            </div>
            <div className="mt-0.5 text-[11px] text-white/70">
              {contact.callback_enabled ? "Pro plan" : "Coming soon"}
            </div>
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-6 border-t border-white/15 pt-6 text-xs text-white/70">
          <div className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> 24/7 emergency for active stays
          </div>
          <div className="inline-flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> 11 official SA languages
          </div>
          <div className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure ticket history
          </div>
        </div>
      </div>
    </div>
  );
}
