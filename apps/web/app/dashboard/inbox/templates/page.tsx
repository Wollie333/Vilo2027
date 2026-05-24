import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import { TemplatesManager, type TemplateRow } from "./TemplatesManager";

export const metadata: Metadata = {
  title: "Quick reply templates · Inbox · Vilo",
};

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/inbox/templates");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!host) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h1 className="font-display text-lg font-bold text-brand-ink">
            Set up your host profile first
          </h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Quick-reply templates attach to a host profile.
          </p>
        </div>
      </div>
    );
  }

  const { data: rows } = await supabase
    .from("message_templates")
    .select("id, title, body, sort_order, created_at")
    .eq("host_id", host.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const templates: TemplateRow[] = (rows ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    body: t.body,
    sortOrder: t.sort_order,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link
          href="/dashboard/inbox"
          className="inline-flex items-center gap-1 text-[12px] text-brand-mute hover:text-brand-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to inbox
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Quick reply templates
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Save common replies once — confirm dates, share check-in details, send
          banking details, politely decline — and reuse them with one click from
          the inbox composer.
        </p>
      </header>

      <TemplatesManager initialTemplates={templates} />
    </div>
  );
}
