import { Headphones, Mail, MessageSquarePlus, ShieldCheck } from "lucide-react";

// Honest "talk to a human" block. The old version advertised live chat, phone
// callbacks, "respond within 4 hours", "24/7 emergency" and "11 SA languages" —
// none of which are real yet. Until they are, the only real, always-true path is
// email support, so that's all we promise.
type Props = {
  supportEmail: string;
};

export function ContactSupport({ supportEmail }: Props) {
  return (
    <div
      id="contact"
      className="relative scroll-mt-20 overflow-hidden rounded-card p-6 text-white lg:p-8"
      style={{
        background:
          "radial-gradient(circle at 12% 0%, rgba(16,185,129,.16) 0, transparent 45%), radial-gradient(circle at 92% 120%, rgba(6,78,59,.12) 0, transparent 50%), #064E3B",
      }}
    >
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-white/15 backdrop-blur">
          <Headphones className="h-3 w-3" /> Talk to a human
        </div>
        <h3 className="mt-4 font-display text-2xl font-bold leading-tight lg:text-3xl">
          Still stuck? Email our team.
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-white/75">
          Can&apos;t find your answer? Send us the details and a real person
          will get back to you.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a
            href={`mailto:${supportEmail}`}
            className="rounded-card bg-white p-4 text-left text-brand-secondary transition-shadow hover:shadow-lift"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded bg-brand-accent text-brand-secondary">
              <Mail className="h-4 w-4" />
            </div>
            <div className="mt-3 font-display text-sm font-semibold">
              Email us
            </div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-brand-mute">
              {supportEmail}
            </div>
          </a>

          <a
            href="#suggest"
            className="rounded-card bg-white/10 p-4 text-left text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/15"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded bg-white/15 text-white">
              <MessageSquarePlus className="h-4 w-4" />
            </div>
            <div className="mt-3 font-display text-sm font-semibold">
              Suggest an article
            </div>
            <div className="mt-0.5 text-[11px] text-white/70">
              Tell us what&apos;s missing
            </div>
          </a>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-6 border-t border-white/15 pt-6 text-xs text-white/70">
          <div className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> We reply to every message
          </div>
        </div>
      </div>
    </div>
  );
}
