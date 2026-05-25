import Link from "next/link";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { SuggestionRow } from "./SuggestionRow";

export const dynamic = "force-dynamic";

const STATUS_VALUES = [
  "all",
  "open",
  "planned",
  "shipped",
  "dismissed",
] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

function isStatus(v: string | undefined): v is StatusFilter {
  return STATUS_VALUES.includes((v ?? "") as StatusFilter);
}

export default async function AdminHelpSuggestionsPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  await requirePermission("help.manage");
  const service = createAdminClient();
  const status: StatusFilter = isStatus(searchParams?.status)
    ? (searchParams!.status as StatusFilter)
    : "open";

  let q = service
    .from("help_article_suggestions")
    .select("id, email, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") q = q.eq("status", status);

  const { data: rows } = await q;
  type Row = NonNullable<typeof rows>[number];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Article suggestions
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            What hosts and guests asked us to write next. Triage weekly.
          </p>
        </div>
        <div className="inline-flex rounded-pill border border-brand-line bg-brand-light p-1 text-[11px] font-medium">
          {STATUS_VALUES.map((s) => (
            <Link
              key={s}
              href={
                s === "open"
                  ? "/admin/help/suggestions"
                  : `/admin/help/suggestions?status=${s}`
              }
              className={`rounded-pill px-3 py-1 capitalize ${status === s ? "bg-white text-brand-ink shadow-card" : "text-brand-mute hover:text-brand-ink"}`}
            >
              {s}
            </Link>
          ))}
        </div>
      </header>

      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {rows && rows.length > 0 ? (
          <ul className="divide-y divide-brand-line">
            {(rows as Row[]).map((r) => (
              <SuggestionRow
                key={(r as { id: string }).id}
                row={
                  r as {
                    id: string;
                    email: string | null;
                    message: string;
                    status: "open" | "planned" | "shipped" | "dismissed";
                    created_at: string;
                  }
                }
              />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-brand-mute">
            No suggestions match this filter.
          </p>
        )}
      </div>
    </div>
  );
}
