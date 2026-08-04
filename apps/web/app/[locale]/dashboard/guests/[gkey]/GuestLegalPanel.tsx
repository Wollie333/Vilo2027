"use client";

import { ScrollText } from "lucide-react";

import {
  LegalSnapshotViewer,
  type BookingGroup,
} from "@/components/legal/LegalSnapshotViewer";

// The guest record's "Legal" tab (host side). Only the host↔guest documents:
// the host's own policies frozen onto each booking with this guest, plus the
// Wielo Terms & Privacy the guest accepted at that booking's checkout. No
// account/programme section and no role badge — every row here is this guest's
// booking with this host. Each opens the exact signed snapshot, printable to PDF.
export function GuestLegalPanel({
  bookings,
  guestName,
}: {
  bookings: BookingGroup[];
  guestName: string;
}) {
  const who = guestName?.trim() ? guestName.trim() : "this guest";
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <ScrollText className="h-4 w-4 text-brand-primary" />
        <h2 className="font-display text-[15px] font-bold text-brand-ink">
          Legal &amp; consent
        </h2>
      </div>
      <p className="text-[12.5px] text-brand-mute">
        Everything {who} agreed to on their bookings with you — your policies
        frozen onto each booking, plus the Wielo Terms and Privacy they accepted
        at checkout. Open any one to read the exact signed snapshot, then Print
        / Save as PDF. These records are immutable.
      </p>
      <LegalSnapshotViewer
        account={[]}
        bookings={bookings}
        showRole={false}
        emptyText="No signed booking documents on record for this guest yet."
      />
    </section>
  );
}
