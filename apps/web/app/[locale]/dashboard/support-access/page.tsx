import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import { GrantActions } from "./GrantActions";

export const metadata: Metadata = { title: "Support access" };
export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function SupportAccessPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/support-access");

  const { data: grants } = await supabase
    .from("admin_support_grants")
    .select("id, status, reason, requested_at, decided_at, expires_at")
    .eq("host_user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(50);

  const now = Date.now();
  const rows = (grants ?? []).map((g) => {
    const active =
      g.status === "approved" &&
      g.expires_at != null &&
      new Date(g.expires_at).getTime() > now;
    return { ...g, active };
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Vilo support access
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Vilo support can always see your account to help. To make changes to
            your <span className="font-medium">financial</span> records
            (bookings, refunds, ledger) they must request your permission here —
            you stay in control.
          </p>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white px-6 py-12 text-center text-sm text-brand-mute">
          No support-access requests. If Vilo support needs to make a change,
          you&apos;ll see the request here.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((g) => (
            <section
              key={g.id}
              className="rounded-card border border-brand-line bg-white p-5 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-[15px] font-semibold text-brand-ink">
                      Edit access
                    </span>
                    <StatusPill status={g.active ? "active" : g.status} />
                  </div>
                  {g.reason ? (
                    <p className="mt-1 text-[13px] text-brand-ink">
                      “{g.reason}”
                    </p>
                  ) : null}
                  <div className="mt-1 text-[11.5px] text-brand-mute">
                    Requested {fmt(g.requested_at)}
                    {g.active ? ` · expires ${fmt(g.expires_at)}` : ""}
                  </div>
                </div>
                {g.status === "pending" ? (
                  <GrantActions grantId={g.id} variant="pending" />
                ) : g.active ? (
                  <GrantActions grantId={g.id} variant="active" />
                ) : null}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:
      "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
    pending:
      "bg-status-pending/10 text-status-pending border-status-pending/30",
    approved: "bg-brand-light text-brand-mute border-brand-line",
    declined:
      "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
    revoked:
      "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
  };
  const cls = map[status] ?? "bg-brand-light text-brand-mute border-brand-line";
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-medium capitalize ${cls}`}
    >
      {status === "approved" ? "expired" : status}
    </span>
  );
}
