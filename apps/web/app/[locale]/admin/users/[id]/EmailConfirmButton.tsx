"use client";

import { Loader2, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { confirmUserEmailAction } from "./actions";

// Admin control in the user record's "Verified" row: a green "Email" pill once
// the address is confirmed, otherwise a one-click "Confirm email" button that
// stamps email_verified_at (for guests the founder has vouched for).
export function EmailConfirmButton({
  userId,
  verified,
}: {
  userId: string;
  verified: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(verified);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-brand-accent px-2 py-0.5 text-[11px] font-semibold text-brand-secondary">
        <MailCheck className="h-3 w-3" />
        Email
      </span>
    );
  }

  function confirm() {
    if (pending) return;
    start(async () => {
      try {
        await confirmUserEmailAction({ userId });
        setDone(true);
        toast.success("Email marked as confirmed.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not confirm.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={confirm}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-white px-2.5 py-0.5 text-[11px] font-semibold text-brand-secondary transition hover:border-[#CDE6D8] hover:bg-[#FAFCFB] hover:text-brand-primary disabled:opacity-50"
      title="Mark this user's email as confirmed"
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <MailCheck className="h-3 w-3" />
      )}
      Confirm email
    </button>
  );
}
