"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import {
  ConversationList,
  ConversationRow,
} from "@/components/inbox/ConversationList";

export type GuestConvRow = {
  id: string;
  status: string;
  isEnquiry: boolean;
  unread: number;
  preview: string | null;
  lastAt: string | null;
  listingName: string | null;
  hostName: string;
  hostAvatarUrl: string | null;
};

type Filter = "all" | "unread" | "enquiries";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "enquiries", label: "Enquiries" },
];

export function GuestInboxList({
  conversations,
}: {
  conversations: GuestConvRow[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const pathname = usePathname();
  const activeId = pathname?.startsWith("/portal/inbox/")
    ? (pathname.split("/")[3] ?? null)
    : null;

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && c.unread === 0) return false;
      if (filter === "enquiries" && !c.isEnquiry) return false;
      if (
        query &&
        !`${c.hostName} ${c.preview ?? ""} ${c.listingName ?? ""}`
          .toLowerCase()
          .includes(query)
      )
        return false;
      return true;
    });
  }, [conversations, filter, q]);

  return (
    <ConversationList
      title="Messages"
      search={q}
      onSearchChange={setQ}
      filters={FILTERS}
      activeFilter={filter}
      onFilterChange={setFilter}
      isEmpty={shown.length === 0}
      emptyText={
        conversations.length === 0
          ? "No conversations yet — message a host from any listing."
          : "No conversations match."
      }
    >
      {shown.map((c) => (
        <ConversationRow
          key={c.id}
          href={`/portal/inbox/${c.id}`}
          active={c.id === activeId}
          name={c.hostName}
          avatarUrl={c.hostAvatarUrl}
          chip={c.isEnquiry ? { label: "Enquiry", tone: "amber" } : null}
          listingName={c.listingName}
          preview={c.preview}
          lastAt={c.lastAt}
          unread={c.unread}
        />
      ))}
    </ConversationList>
  );
}
