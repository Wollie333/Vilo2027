"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";

import { buyProductAction } from "./actions";

export function BuyForm({
  slug,
  free,
  sessionEmail,
}: {
  slug: string;
  free: boolean;
  // Set when the buyer is already signed in — the email step is skipped and the
  // button goes straight to payment. The server ignores any client email and
  // uses the session's, so we don't even send this value.
  sessionEmail?: string | null;
}) {
  const [email, setEmail] = useState("");
  // null = idle; otherwise a modal is shown with this phase.
  const [phase, setPhase] = useState<null | "working" | "redirecting">(null);

  const busy = phase !== null;
  const authed = !!sessionEmail;

  function submit() {
    setPhase("working");
    (async () => {
      try {
        // Authed → the action resolves the email from the session; the arg is
        // ignored server-side. Anonymous → send the typed email.
        const r = await buyProductAction(slug, authed ? "" : email.trim());
        if (r.ok) {
          setPhase("redirecting");
          // Free → magic link (auto sign-in → dashboard); paid → pay page.
          window.location.href = r.url;
        } else {
          setPhase(null);
          toast.error(r.error);
        }
      } catch {
        setPhase(null);
        toast.error("Something went wrong. Please try again.");
      }
    })();
  }

  const canSubmit = authed ? !busy : !busy && !!email.trim();

  return (
    <div className="space-y-2">
      {authed ? (
        <p className="text-[13px] text-brand-mute">
          Signed in as{" "}
          <span className="font-medium text-brand-ink">{sessionEmail}</span>
        </p>
      ) : (
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && email.trim() && !busy) submit();
          }}
        />
      )}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="inline-flex w-full items-center justify-center rounded-md bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
      >
        {free ? "Get access" : "Continue to payment"}
      </button>

      {busy ? <ProgressModal free={free} phase={phase} /> : null}
    </div>
  );
}

function ProgressModal({
  free,
  phase,
}: {
  free: boolean;
  phase: "working" | "redirecting";
}) {
  // Per-flow copy so the user knows exactly what's happening.
  const steps = free
    ? ["Setting up your account", "Granting your beta access", "Signing you in"]
    : ["Confirming your details", "Taking you to secure payment"];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        {phase === "redirecting" ? (
          <CheckCircle2 className="mx-auto h-9 w-9 text-brand-primary" />
        ) : (
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-brand-primary" />
        )}
        <h2 className="mt-3 font-display text-lg font-bold text-brand-ink">
          {free
            ? phase === "redirecting"
              ? "You're in!"
              : "Setting up your access…"
            : phase === "redirecting"
              ? "Redirecting…"
              : "One moment…"}
        </h2>
        <p className="mt-1 text-[13px] text-brand-mute">
          {free
            ? phase === "redirecting"
              ? "Taking you to your dashboard."
              : "This only takes a moment — no payment needed, it's free."
            : phase === "redirecting"
              ? "Off to secure payment."
              : "Getting your secure checkout ready."}
        </p>

        <ul className="mt-4 space-y-1.5 text-left text-[12.5px] text-brand-dark">
          {steps.map((s, i) => {
            const done = phase === "redirecting" || i < steps.length - 1;
            return (
              <li key={s} className="flex items-center gap-2">
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-mute" />
                )}
                <span>{s}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
