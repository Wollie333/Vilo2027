import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";

export const metadata: Metadata = {
  title: "Messages",
};

export const dynamic = "force-dynamic";

// Right-pane placeholder when no conversation is open. The conversation LIST is
// rendered by the inbox layout (two-pane shell); on mobile this page is hidden
// while the list shows.
export default function PortalInboxIndex() {
  return (
    <div className="flex h-full flex-1 items-center justify-center p-8 text-center">
      <div className="max-w-xs">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand-primary shadow-sm">
          <MessageSquare className="h-6 w-6" />
        </div>
        <p className="font-display text-[15px] font-bold text-brand-ink">
          Your messages
        </p>
        <p className="mt-1 text-[13px] text-brand-mute">
          Pick a conversation on the left to see your chat history with the
          host.
        </p>
      </div>
    </div>
  );
}
