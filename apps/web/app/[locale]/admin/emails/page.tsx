import { Link } from "@/i18n/navigation";
import { ChevronRight, Mail } from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_REGISTRY } from "@/lib/email/registry";

export const dynamic = "force-dynamic";

type QueueStats = {
  pending: number;
  sent24h: number;
  failed24h: number;
};

async function loadStats(): Promise<QueueStats> {
  const service = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count: pending }, { count: sent24h }, { count: failed24h }] =
    await Promise.all([
      service
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .is("sent_at", null)
        .is("failed_at", null),
      service
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .not("sent_at", "is", null)
        .gte("sent_at", since),
      service
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .not("failed_at", "is", null)
        .gte("failed_at", since),
    ]);
  return {
    pending: pending ?? 0,
    sent24h: sent24h ?? 0,
    failed24h: failed24h ?? 0,
  };
}

export default async function AdminEmailsPage() {
  await requireAdmin();
  const stats = await loadStats();

  const types = Object.keys(EMAIL_REGISTRY).sort();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Email templates
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Preview every registered template with realistic sample data and send
          a test to your own inbox. Real sends are driven by notification_queue
          and the worker at /api/email-worker.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Pending in queue"
          value={stats.pending}
          tone={stats.pending > 0 ? "warn" : "neutral"}
        />
        <Stat label="Sent (last 24h)" value={stats.sent24h} tone="ok" />
        <Stat
          label="Failed (last 24h)"
          value={stats.failed24h}
          tone={stats.failed24h > 0 ? "bad" : "neutral"}
        />
      </section>

      <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <header className="flex items-center gap-2 border-b border-brand-line px-5 py-3">
          <Mail className="h-4 w-4 text-brand-primary" />
          <h2 className="font-display text-sm font-semibold text-brand-ink">
            Registered templates ({types.length})
          </h2>
        </header>
        <ul className="divide-y divide-brand-line">
          {types.map((type) => {
            const entry = EMAIL_REGISTRY[type];
            return (
              <li key={type}>
                <Link
                  href={`/admin/emails/${type}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-brand-light/60"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[13px] font-semibold text-brand-ink">
                      {type}
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-brand-mute">
                      {entry.subject({})}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <RecipientPill recipient={entry.recipient} />
                    <ChevronRight className="h-4 w-4 text-brand-mute" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "bad" | "neutral";
}) {
  const colorMap = {
    ok: "text-status-confirmed",
    warn: "text-status-pending",
    bad: "text-status-cancelled",
    neutral: "text-brand-ink",
  } as const;
  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="text-[11px] uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-2xl font-bold tabular-nums ${colorMap[tone]}`}
      >
        {value}
      </div>
    </div>
  );
}

function RecipientPill({
  recipient,
}: {
  recipient: "host" | "guest" | "custom";
}) {
  const map: Record<string, string> = {
    host: "bg-brand-accent text-brand-primary border-brand-primary/20",
    guest:
      "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
    custom: "bg-brand-light text-brand-mute border-brand-line",
  };
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[11px] font-medium capitalize ${map[recipient]}`}
    >
      {recipient}
    </span>
  );
}
