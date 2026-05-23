import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";

import { ComingSoon } from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Inbox · Vilo",
};

export default function InboxPage() {
  return (
    <ComingSoon
      icon={MessageSquare}
      title="Inbox"
      tagline="Conversations with your guests, in one realtime feed."
      phase="Phase 3"
      bullets={[
        "Pre-booking enquiries from guests",
        "System messages for every booking status change",
        "File attachments + push notifications to iOS / Android",
        "Saved replies + canned templates (Pro+)",
      ]}
    />
  );
}
