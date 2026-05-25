import { Activity, ArrowUpRight, MessageCircle, Users } from "lucide-react";
import Link from "next/link";

import type {
  HelpContactSettings,
  HelpStatusComponentStatus,
} from "@/lib/help/types";

const OVERALL_LABEL: Record<
  HelpStatusComponentStatus,
  { label: string; tone: string }
> = {
  normal: {
    label: "All systems normal",
    tone: "bg-brand-accent text-emerald-800",
  },
  degraded: { label: "Degraded service", tone: "bg-amber-100 text-amber-800" },
  incident: { label: "Active incident", tone: "bg-red-100 text-red-700" },
  maintenance: {
    label: "Scheduled maintenance",
    tone: "bg-blue-100 text-blue-800",
  },
};

type Props = {
  contact: HelpContactSettings;
  overallStatus: HelpStatusComponentStatus;
};

export function QuickActions({ contact, overallStatus }: Props) {
  const overall = OVERALL_LABEL[overallStatus];
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
      <Link
        href="#contact"
        className="flex items-start gap-4 rounded-card border border-brand-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-brand-primary text-white">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-bold text-brand-ink">
              Live chat
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-semibold ${
                contact.live_chat_online
                  ? "bg-brand-accent text-emerald-800"
                  : "bg-brand-light text-brand-mute"
              }`}
            >
              {contact.live_chat_online ? "Online" : "Offline"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-brand-mute">
            Chat with a Vilo team member. Median response under{" "}
            <span className="font-mono text-brand-ink">
              {contact.median_response_minutes} min
            </span>
            .
          </p>
        </div>
        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-brand-mute" />
      </Link>

      <Link
        href="#status"
        className="flex items-start gap-4 rounded-card border border-brand-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-secondary">
          <Activity className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-bold text-brand-ink">
              System status
            </h3>
            <span
              className={`inline-flex h-2 w-2 rounded-full ${
                overallStatus === "normal"
                  ? "bg-emerald-500"
                  : overallStatus === "degraded"
                    ? "bg-amber-500"
                    : overallStatus === "incident"
                      ? "bg-red-500"
                      : "bg-blue-500"
              }`}
              aria-hidden
            />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-brand-mute">
            <span
              className={`inline-flex items-center rounded-pill px-1.5 py-0.5 text-[10px] font-semibold ${overall.tone}`}
            >
              {overall.label}
            </span>{" "}
            Live system dashboard updated minutely.
          </p>
        </div>
        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-brand-mute" />
      </Link>

      <Link
        href="#community"
        className="flex items-start gap-4 rounded-card border border-brand-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-brand-secondary text-white">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold text-brand-ink">
            Host community
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-brand-mute">
            <span className="num font-mono text-brand-ink">
              {contact.community_member_count.toLocaleString("en-ZA")}
            </span>{" "}
            hosts swapping tips, pricing strategies & local know-how.
          </p>
        </div>
        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-brand-mute" />
      </Link>
    </section>
  );
}
