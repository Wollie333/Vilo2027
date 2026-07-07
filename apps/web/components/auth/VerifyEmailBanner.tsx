"use client";

import { MailWarning } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resendVerificationEmailAction } from "@/app/[locale]/(auth)/actions";

// Persistent "please confirm your email" nag for signed-in users whose email
// isn't verified yet (soft verification — they can still use the app). Rendered
// by the dashboard + portal layouts only when `user.email_confirmed_at` is null.
// Not dismissible by design: it stays until they click the link in their inbox.

export function VerifyEmailBanner({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  function resend() {
    start(async () => {
      const r = await resendVerificationEmailAction();
      if (r.ok) {
        setSent(true);
        toast.success("Verification email sent — check your inbox.");
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 lg:px-6">
      <MailWarning className="h-4 w-4 shrink-0 text-amber-600" />
      <span className="min-w-0 flex-1">
        Please confirm your email
        {email ? <span className="font-medium"> ({email})</span> : null} to
        secure your account.
      </span>
      <button
        type="button"
        onClick={resend}
        disabled={pending || sent}
        className="shrink-0 rounded border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
      >
        {sent ? "Email sent" : pending ? "Sending…" : "Resend email"}
      </button>
    </div>
  );
}
