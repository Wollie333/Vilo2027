"use client";

import { MailWarning, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  checkEmailVerifiedAction,
  resendVerificationEmailAction,
  signOutAction,
} from "@/app/[locale]/(auth)/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

// The email-verification gate, shown as a BLOCKING modal OVER the (blurred)
// dashboard/portal rather than a full-page redirect — the app stays visible
// behind it so verifying feels like a step, not a wall. It auto-detects
// confirmation (polls + re-checks on window focus) and dismisses itself the
// moment user_profiles.email_verified_at is set — no manual "I've confirmed"
// button. Security gating of actions is enforced server-side elsewhere
// (requireHost/assertFullHost); this is purely the human-facing prompt.
export function EmailVerifyGate({ email }: { email: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const doneRef = useRef(false);

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

  useEffect(() => {
    let alive = true;
    async function poll() {
      if (doneRef.current) return;
      try {
        const r = await checkEmailVerifiedAction();
        if (!alive || doneRef.current) return;
        if (r.verified) {
          doneRef.current = true;
          setVerified(true);
          // Brief success flash, then re-run the layout — the flag is now set so
          // the gate won't render again and the app is unlocked.
          window.setTimeout(() => router.refresh(), 1000);
        }
      } catch {
        // Transient — the next tick retries.
      }
    }
    const id = window.setInterval(poll, 4000);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    poll(); // immediate first check on mount
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [router]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-brand-ink/40 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-md rounded-card border border-brand-line bg-white p-8 text-center shadow-lift">
        {verified ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-lg font-bold text-brand-ink">
              Email verified
            </h1>
            <p className="mt-2 text-sm text-brand-mute">
              Thanks — unlocking your account…
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <MailWarning className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-lg font-bold text-brand-ink">
              Wielo needs to verify your email
            </h1>
            <p className="mt-2 text-sm text-brand-mute">
              For your security, click the confirmation link we sent to
              {email ? (
                <span className="font-medium text-brand-ink"> {email}</span>
              ) : (
                " your inbox"
              )}
              . This unlocks automatically the moment you confirm.
            </p>

            <Button
              type="button"
              onClick={resend}
              disabled={pending || sent}
              className="mt-6 w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {sent ? "Email sent" : pending ? "Sending…" : "Resend the email"}
            </Button>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-brand-mute">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-primary" />
              Waiting for you to confirm…
            </div>

            <form action={signOutAction} className="mt-4">
              <Button
                type="submit"
                variant="ghost"
                className="w-full text-brand-mute"
              >
                Sign out
              </Button>
            </form>

            <p className="mt-4 text-xs text-brand-mute">
              Wrong address or need help?{" "}
              <a
                href="mailto:support@wielo.co.za"
                className="font-semibold text-brand-ink underline"
              >
                support@wielo.co.za
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
