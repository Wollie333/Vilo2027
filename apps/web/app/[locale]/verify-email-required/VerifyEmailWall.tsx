"use client";

import { MailCheck, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { resendVerificationEmailAction } from "@/app/[locale]/(auth)/actions";

// Interactive half of the /verify-email-required wall. The page is a server
// component (it decides whether to wall or bounce); this handles the resend +
// "I've confirmed" recheck. Kept separate so the page stays a server component.
// The resend action resolves the signed-in user's email server-side, so this
// component needs no props.
export function VerifyEmailWall() {
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
    <div className="mt-6 space-y-3">
      <Button
        type="button"
        onClick={resend}
        disabled={pending || sent}
        className="w-full"
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        {sent ? "Email sent" : pending ? "Sending…" : "Resend the email"}
      </Button>
      {/* A full navigation (not client-side) so the layout re-runs its
          verification check server-side after they confirm in another tab. */}
      <a href="/dashboard" className="block">
        <Button type="button" variant="outline" className="w-full">
          <MailCheck className="mr-2 h-4 w-4" />
          I&apos;ve confirmed — continue
        </Button>
      </a>
    </div>
  );
}
