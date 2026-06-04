import type { Metadata } from "next";
import { ArrowRight, MessageSquare } from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Messages",
};

export const dynamic = "force-dynamic";

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: diffMs > 365 * 24 * 60 * 60 * 1000 ? "numeric" : undefined,
  });
}

export default async function PortalInboxPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from("conversations")
    .select(
      `
      id,
      status,
      is_enquiry,
      unread_guest,
      last_message_preview,
      last_message_at,
      listing:listings ( name ),
      host:hosts ( display_name, avatar_url )
    `,
    )
    .eq("guest_id", user.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  type Row = {
    id: string;
    status: string;
    is_enquiry: boolean;
    unread_guest: number;
    last_message_preview: string | null;
    last_message_at: string | null;
    listing: { name: string } | { name: string }[] | null;
    host:
      | { display_name: string; avatar_url: string | null }
      | { display_name: string; avatar_url: string | null }[]
      | null;
  };
  const list = (rows as Row[] | null) ?? [];

  // Full-bleed surface (see @/lib/layout/fullBleed): fill the content area
  // height and scroll internally rather than growing the page. Internal
  // padding lives here on the page, not on the layout shell.
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-8 lg:py-8">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">
            Messages
          </h1>
          <p className="mt-2 text-sm text-brand-mute">
            Your conversations with hosts and Vilo support.
          </p>
        </header>

        {list.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
              <MessageSquare className="h-6 w-6" />
            </div>
            <p className="font-display text-lg font-bold text-brand-ink">
              No conversations yet
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
              Message a host from any listing — or start a conversation from
              your booking page.
            </p>
            <Link
              href="/explore"
              className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
            >
              Browse stays <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-brand-line overflow-hidden rounded-card border border-brand-line bg-white">
            {list.map((c) => {
              const host = Array.isArray(c.host) ? c.host[0] : c.host;
              const listing = Array.isArray(c.listing)
                ? c.listing[0]
                : c.listing;
              const initials = (host?.display_name ?? "?")
                .slice(0, 2)
                .toUpperCase();
              return (
                <li key={c.id}>
                  <Link
                    href={`/portal/inbox/${c.id}`}
                    className="flex items-start gap-4 p-4 hover:bg-brand-light/60"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-accent text-xs font-semibold text-brand-secondary">
                      {host?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={host.avatar_url}
                          alt={host.display_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-display text-sm font-semibold text-brand-ink">
                          {host?.display_name ?? "Host"}
                        </div>
                        {listing?.name ? (
                          <span className="truncate text-xs text-brand-mute">
                            · {listing.name}
                          </span>
                        ) : null}
                        {c.is_enquiry ? (
                          <span className="inline-flex items-center rounded-pill bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                            Enquiry
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-brand-mute">
                        {c.last_message_preview ?? "No messages yet."}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[11px] text-brand-mute">
                        {fmtRelative(c.last_message_at)}
                      </div>
                      {c.unread_guest > 0 ? (
                        <span className="mt-1 inline-flex items-center rounded-pill bg-brand-primary px-2 py-0.5 text-[10px] font-bold text-white">
                          {c.unread_guest}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-6 text-xs text-brand-mute">
          Need help from Vilo?{" "}
          <Link
            href="/help"
            className="font-medium text-brand-primary hover:underline"
          >
            Visit the help centre
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
