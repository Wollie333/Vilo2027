import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import { ContactsExportButton } from "./ContactsExportButton";

export const metadata: Metadata = {
  title: "Contacts",
};

export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<string, string> = {
  new_quote: "New quote",
  quote_sent: "Quote sent",
  negotiating: "Negotiating",
  accepted: "Accepted",
  declined: "Declined",
  lost: "Lost",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ContactsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/inbox/contacts");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: contacts } = host
    ? await supabase
        .from("host_contacts")
        .select("id, name, email, phone, last_stage, last_seen_at")
        .eq("host_id", host.id)
        .order("last_seen_at", { ascending: false })
        .limit(1000)
    : { data: [] as never[] };

  const rows = contacts ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/dashboard/inbox"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-mute hover:text-brand-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Inbox
          </Link>
          <h1 className="mt-2 flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-brand-ink">
            <Users className="h-5 w-5 text-brand-primary" /> Contacts
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            Everyone who has enquired, been quoted or booked — collected
            automatically.
          </p>
        </div>
        <ContactsExportButton disabled={rows.length === 0} />
      </div>

      <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-brand-mute">
            No contacts yet. They appear here the moment a guest requests a
            quote or books.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-brand-line text-left text-[11px] uppercase tracking-wider text-brand-mute">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Stage</th>
                  <th className="px-5 py-3">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-brand-light/40">
                    <td className="px-5 py-3 font-medium text-brand-ink">
                      {c.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-brand-mute">{c.email}</td>
                    <td className="px-5 py-3 text-brand-mute">
                      {c.phone ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      {c.last_stage ? (
                        <span className="inline-flex items-center rounded-pill bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand-secondary">
                          {STAGE_LABEL[c.last_stage] ?? c.last_stage}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num px-5 py-3 text-brand-mute">
                      {fmtDate(c.last_seen_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
