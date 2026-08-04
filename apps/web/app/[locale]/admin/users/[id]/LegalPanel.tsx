"use client";

import { ScrollText } from "lucide-react";
import { useEffect, useState } from "react";

import {
  LegalSnapshotViewer,
  type BookingGroup,
  type LegalAcceptance,
} from "@/components/legal/LegalSnapshotViewer";

import { getUserLegalAcceptancesAction } from "./actions";

// The user record's "Legal" tab — every document this user consented to, with
// booking consents batched by booking number (guest side + host side) and
// account/programme consents in their own section. Each opens the exact signed
// snapshot, printable to PDF. Lazy-loads on mount.
export function LegalPanel({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<LegalAcceptance[]>([]);
  const [bookings, setBookings] = useState<BookingGroup[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getUserLegalAcceptancesAction(userId).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setAccount(res.data.account);
        setBookings(res.data.bookings);
      } else {
        setError(res.error);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <ScrollText className="h-4 w-4 text-brand-primary" />
        <h2 className="font-display text-[15px] font-bold text-brand-ink">
          Signed documents
        </h2>
      </div>
      <p className="text-[12.5px] text-brand-mute">
        Every document this user signed with Wielo — the Terms and Privacy
        accepted at registration, the affiliate agreement and competition rules,
        and the Terms, Privacy and host policies frozen onto each of their
        bookings (as guest and as host). Open any one to read the signed
        snapshot, then Print / Save as PDF. These records are immutable.
      </p>
      {loading ? (
        <div className="rounded-card border border-brand-line bg-white p-8 text-center text-[13px] text-brand-mute">
          Loading signed documents…
        </div>
      ) : error ? (
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800">
          {error}
        </div>
      ) : (
        <LegalSnapshotViewer account={account} bookings={bookings} />
      )}
    </section>
  );
}
