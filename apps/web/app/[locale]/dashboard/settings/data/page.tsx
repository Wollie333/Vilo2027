import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { History } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import { DeleteAccountSection } from "./DeleteAccountSection";
import { RequestSection } from "./RequestForm";

export const metadata: Metadata = {
  title: "Data & privacy · Settings",
};

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-status-pending/10 text-status-pending border-status-pending/30",
  processing: "bg-brand-accent text-brand-primary border-brand-primary/20",
  completed:
    "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
  rejected:
    "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
  cancelled: "bg-brand-light text-brand-mute border-brand-line",
};

type RequestRow = {
  id: string;
  request_type: "export" | "deletion";
  status: string;
  notes: string | null;
  created_at: string;
  fulfilled_at: string | null;
};

export default async function SettingsDataPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <p className="text-sm text-brand-mute">
        Sign in to manage your data.{" "}
        <Link
          href="/login"
          className="text-brand-primary underline-offset-2 hover:underline"
        >
          Log in →
        </Link>
      </p>
    );
  }

  const { data: requests } = await supabase
    .from("data_requests")
    .select("id, request_type, status, notes, created_at, fulfilled_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (requests as RequestRow[] | null) ?? [];
  const exportRequest = rows.find((r) => r.request_type === "export") ?? null;
  const deletionRequest =
    rows.find((r) => r.request_type === "deletion") ?? null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink">
          Data & privacy
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Exercise your POPIA / GDPR rights. We answer every request within 30
          days as the law requires.
        </p>
      </header>

      <RequestSection
        type="export"
        existing={
          exportRequest &&
          (exportRequest.status === "pending" ||
            exportRequest.status === "processing")
            ? exportRequest
            : null
        }
      />

      <RequestSection
        type="deletion"
        existing={
          deletionRequest &&
          (deletionRequest.status === "pending" ||
            deletionRequest.status === "processing")
            ? deletionRequest
            : null
        }
      />

      <DeleteAccountSection email={user.email ?? ""} />

      {rows.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <History className="h-4 w-4 text-brand-mute" />
            <h2 className="font-display text-base font-bold text-brand-ink">
              Request history
            </h2>
          </div>
          <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <ul className="divide-y divide-brand-line">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
                >
                  <span className="font-medium capitalize text-brand-ink">
                    {r.request_type}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[11px] font-medium ${
                      STATUS_STYLES[r.status] ?? STATUS_STYLES.pending
                    }`}
                  >
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-brand-mute">
                    {new Date(r.created_at).toLocaleDateString("en-ZA")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <p className="text-[12px] text-brand-mute">
        Questions about how we handle your data? See our{" "}
        <Link
          href="/privacy"
          className="text-brand-primary underline-offset-2 hover:underline"
        >
          privacy policy
        </Link>{" "}
        or email{" "}
        <a
          href="mailto:privacy@wieloplatform.com"
          className="text-brand-primary underline-offset-2 hover:underline"
        >
          privacy@wieloplatform.com
        </a>
        .
      </p>
    </div>
  );
}
