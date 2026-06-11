"use client";

import { useSelectedLayoutSegment } from "next/navigation";

import { GuestInboxList, type GuestConvRow } from "./GuestInboxList";

// Two-pane guest inbox (WhatsApp-style): the conversation list lives on the
// left and persists across thread navigation (it's in the inbox LAYOUT); the
// selected thread renders on the right via {children}. On mobile only one pane
// shows at a time — the list until a thread is opened, then the conversation.
export function GuestInboxShell({
  conversations,
  children,
}: {
  conversations: GuestConvRow[];
  children: React.ReactNode;
}) {
  // Non-null once a thread route (/portal/inbox/<id>) is active.
  const segment = useSelectedLayoutSegment();
  const threadOpen = segment !== null;

  return (
    <div className="flex min-h-0 flex-1">
      <aside
        className={`min-h-0 w-full shrink-0 flex-col border-r border-brand-line lg:flex lg:w-[360px] ${
          threadOpen ? "hidden lg:flex" : "flex"
        }`}
      >
        <GuestInboxList conversations={conversations} />
      </aside>
      <div
        className={`min-h-0 min-w-0 flex-1 flex-col bg-[#E6EFE9] ${
          threadOpen ? "flex" : "hidden lg:flex"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
