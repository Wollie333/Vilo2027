"use client";

import {
  BadgeCheck,
  ExternalLink,
  Mail,
  Phone,
  ReceiptText,
  ScrollText,
  Wallet,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ChatComposer } from "@/components/inbox/ChatComposer";
import {
  ChatMessageWall,
  type ChatMessage,
} from "@/components/inbox/ChatMessageWall";
import { ChatThreadHeader } from "@/components/inbox/ChatThreadHeader";
import {
  ConversationList,
  ConversationRow,
} from "@/components/inbox/ConversationList";
import { InboxAvatar } from "@/components/inbox/InboxAvatar";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

import {
  adminMarkPlatformReadAction,
  adminReplyPlatformAction,
} from "./actions";

export type AdminConversation = {
  id: string;
  hostId: string | null;
  hostUserId: string | null;
  // Display name/avatar of the counterparty — the host on host threads, the
  // guest on guest-support threads (host_id null).
  hostName: string | null;
  hostHandle: string | null;
  hostAvatarUrl: string | null;
  // True when this is a guest↔Wielo support thread (no host).
  isGuest: boolean;
  unread: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
};

export type HostDetails = {
  isGuest: boolean;
  hostId: string | null;
  userId: string | null;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  memberSince: string | null;
  plan: string | null;
  planStatus: string | null;
  billingCycle: string | null;
  renewsAt: string | null;
  listings: number;
  netToWielo: number;
  currency: string;
};

type Filter = "all" | "unread";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// The Wielo support inbox — full-bleed two-pane message centre built on the SAME
// chat components as the host inbox, so it looks identical (just in /admin).
export function AdminInboxView({
  conversations,
  selectedId,
  messages,
  selfId,
  hostDetails,
}: {
  conversations: AdminConversation[];
  selectedId: string | null;
  messages: ChatMessage[];
  /** The Wielo Support participant id — the admin's "self" side for alignment. */
  selfId: string;
  hostDetails: HostDetails | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const threadOpen = Boolean(selected);

  useEffect(() => setDrawerOpen(false), [selectedId]);

  // Mark read on open (clears the admin-side unread).
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId || markedRef.current === selectedId) return;
    markedRef.current = selectedId;
    if (selected && selected.unread > 0) {
      void adminMarkPlatformReadAction(selectedId).then(() => router.refresh());
    }
  }, [selectedId, selected, router]);

  // Realtime: refresh on any message/conversation change.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("admin-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [router]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && c.unread === 0) return false;
      if (
        needle &&
        !`${c.hostName ?? ""} ${c.hostHandle ?? ""} ${c.lastMessagePreview ?? ""}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [conversations, filter, q]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* List pane */}
      <aside
        className={`min-h-0 w-full shrink-0 flex-col border-r border-brand-line lg:flex lg:w-[360px] ${
          threadOpen ? "hidden lg:flex" : "flex"
        }`}
      >
        <ConversationList
          title="Support inbox"
          search={q}
          onSearchChange={setQ}
          searchPlaceholder="Search hosts…"
          filters={FILTERS}
          activeFilter={filter}
          onFilterChange={setFilter}
          isEmpty={shown.length === 0}
          emptyText={
            conversations.length === 0
              ? "A thread appears once a host opens their inbox or you message them from the ledger."
              : "No conversations match."
          }
        >
          {shown.map((c) => (
            <ConversationRow
              key={c.id}
              href={`/admin/inbox?c=${c.id}`}
              active={c.id === selectedId}
              name={
                c.hostName || c.hostHandle || (c.isGuest ? "Guest" : "Host")
              }
              avatarUrl={c.hostAvatarUrl}
              chip={
                c.isGuest
                  ? { label: "Guest", tone: "sky" }
                  : { label: "Host", tone: "green" }
              }
              listingName={c.hostHandle ? `@${c.hostHandle}` : null}
              preview={c.lastMessagePreview}
              lastAt={c.lastMessageAt ?? c.createdAt}
              unread={c.unread}
            />
          ))}
        </ConversationList>
      </aside>

      {/* Thread pane */}
      <div
        className={`relative min-h-0 min-w-0 flex-1 flex-col bg-[#E6EFE9] ${
          threadOpen ? "flex" : "hidden lg:flex"
        }`}
      >
        {selected ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <ChatThreadHeader
              name={selected.hostName || selected.hostHandle || "Host"}
              subtitle={selected.hostHandle ? `@${selected.hostHandle}` : null}
              avatarUrl={selected.hostAvatarUrl}
              onBack={() => router.push("/admin/inbox")}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="ml-1 inline-flex h-9 items-center gap-2 rounded-full border border-brand-line px-3.5 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
                >
                  <ReceiptText className="h-4 w-4 text-brand-primary" />
                  <span className="hidden sm:inline">Details</span>
                </button>
              }
            />
            <ChatMessageWall
              messages={messages}
              selfId={selfId}
              viewer="guest"
              quotesById={{}}
              bookingsById={{}}
              emptyText="No messages yet — say hello."
              platformThread
            />
            <ChatComposer
              placeholder={`Reply to ${selected.hostName?.split(" ")[0] ?? "the host"}…`}
              onSend={async (text) => {
                const r = await adminReplyPlatformAction({
                  conversationId: selected.id,
                  body: text,
                });
                if (r.ok) {
                  router.refresh();
                  return true;
                }
                toast.error(r.error);
                return false;
              }}
            />
          </div>
        ) : (
          <div className="flex h-full flex-1 items-center justify-center p-8 text-center">
            <div className="max-w-xs">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand-primary shadow-sm">
                <ReceiptText className="h-6 w-6" />
              </div>
              <p className="font-display text-[15px] font-bold text-brand-ink">
                Support inbox
              </p>
              <p className="mt-1 text-[13px] text-brand-mute">
                Pick a host on the left to read and reply.
              </p>
            </div>
          </div>
        )}

        {selected ? (
          <HostDetailsDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            host={hostDetails}
          />
        ) : null}
      </div>
    </div>
  );
}

// Slide-over with the current host's account snapshot — the admin sibling of the
// host inbox's guest details drawer.
function HostDetailsDrawer({
  open,
  onClose,
  host,
}: {
  open: boolean;
  onClose: () => void;
  host: HostDetails | null;
}) {
  return (
    <>
      <div
        onClick={onClose}
        className={`absolute inset-0 z-40 bg-[rgba(5,46,31,.32)] transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`absolute inset-y-0 right-0 z-50 flex w-[380px] max-w-[92vw] flex-col bg-white shadow-[-10px_0_40px_-12px_rgba(6,78,59,.25)] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center border-b border-brand-line px-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
              {host?.isGuest ? "Guest account" : "Host account"}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-brand-ink">
              {host?.handle ? `@${host.handle}` : "—"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-brand-mute hover:bg-brand-light hover:text-brand-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto">
          {host ? (
            <>
              {/* Identity */}
              <div className="px-5 pb-4 pt-5">
                <div className="flex items-center gap-3">
                  <InboxAvatar
                    name={host.name ?? host.email ?? "Host"}
                    imageUrl={host.avatarUrl}
                    size={44}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-bold text-brand-ink">
                      {host.name ?? "Host"}
                    </div>
                    {host.email ? (
                      <div className="truncate text-[12px] text-brand-mute">
                        {host.email}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
                  {host.phone ? (
                    <a
                      href={`https://wa.me/${host.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-line px-3 py-1.5 font-medium text-brand-ink hover:bg-brand-light"
                    >
                      <Phone className="h-3.5 w-3.5 text-brand-primary" />{" "}
                      WhatsApp
                    </a>
                  ) : null}
                  {host.email ? (
                    <a
                      href={`mailto:${host.email}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-line px-3 py-1.5 font-medium text-brand-ink hover:bg-brand-light"
                    >
                      <Mail className="h-3.5 w-3.5 text-brand-primary" /> Email
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Account snapshot — host-only (a guest support thread has no
                  subscription / listings / ledger). */}
              {!host.isGuest ? (
                <div className="px-5 pb-5">
                  <DrawerHeading>Account</DrawerHeading>
                  <dl>
                    <Row label="Plan">
                      <span className="capitalize">{host.plan ?? "—"}</span>
                      {host.planStatus ? (
                        <span className="ml-1.5 text-[11px] text-brand-mute">
                          ({host.planStatus})
                        </span>
                      ) : null}
                    </Row>
                    {host.billingCycle ? (
                      <Row label="Billing">
                        <span className="capitalize">{host.billingCycle}</span>
                      </Row>
                    ) : null}
                    {host.renewsAt ? (
                      <Row label="Renews">{fmtDate(host.renewsAt)}</Row>
                    ) : null}
                    <Row label="Listings">{host.listings}</Row>
                    <Row label="Paid to Wielo">
                      <span className="inline-flex items-center gap-1 font-display font-bold text-brand-ink">
                        <Wallet className="h-3.5 w-3.5 text-brand-primary" />
                        {formatMoney(host.netToWielo, host.currency)}
                      </span>
                    </Row>
                    {host.memberSince ? (
                      <Row label="Member since">
                        <span className="inline-flex items-center gap-1">
                          <BadgeCheck className="h-3.5 w-3.5 text-brand-primary" />
                          {fmtDate(host.memberSince)}
                        </span>
                      </Row>
                    ) : null}
                  </dl>
                </div>
              ) : null}

              {/* Quick links */}
              <div className="space-y-2 px-5 pb-6">
                {host.userId ? (
                  <Link
                    href={`/admin/users/${host.userId}`}
                    className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-brand-primary text-sm font-semibold text-white hover:bg-brand-secondary"
                  >
                    <ExternalLink className="h-4 w-4" /> Open user record
                  </Link>
                ) : null}
                {host.email ? (
                  <Link
                    href={`/admin/subscriptions/revenue?user=${encodeURIComponent(host.email)}`}
                    className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-brand-line bg-white text-sm font-semibold text-brand-ink hover:bg-brand-light"
                  >
                    <ScrollText className="h-4 w-4 text-brand-primary" /> View
                    in ledger
                  </Link>
                ) : null}
              </div>
            </>
          ) : (
            <p className="px-5 py-10 text-center text-[13px] text-brand-mute">
              No account details.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}

function DrawerHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
      {children}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3 border-t border-[#F1F6F2] py-2.5 text-[13.5px] first:border-t-0">
      <dt className="text-brand-mute">{label}</dt>
      <dd className="text-right font-semibold text-brand-ink">{children}</dd>
    </div>
  );
}
