"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

import { redeemBackupCodeAction } from "@/app/[locale]/account/security/actions";

/**
 * The TOTP verification runs in the BROWSER on purpose: mfa.verify() returns an
 * upgraded AAL2 session, and it has to be written to the client's own auth
 * storage for the rest of the app to see it. Verifying server-side would elevate
 * a session the browser never receives.
 *
 * The recovery path is the opposite — it needs the service role to burn a code
 * and remove the factor — so that half is a server action.
 */
export function MfaChallengeForm({
  factorId,
  next,
}: {
  factorId: string;
  next: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  async function verify() {
    if (!factorId) {
      toast.error("No authenticator found on this account.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: challenge, error: cErr } =
        await supabase.auth.mfa.challenge({ factorId });
      if (cErr || !challenge) {
        toast.error("Could not verify that code. Try again.");
        return;
      }
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.replace(/\s/g, ""),
      });
      if (error) {
        toast.error("That code isn't right. Try the next one.");
        return;
      }
      // Server components must re-read the now-AAL2 session.
      router.replace(next || "/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function redeem() {
    start(async () => {
      const r = await redeemBackupCodeAction(recovery);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Signed in — two-factor has been turned off.");
      router.replace("/account/security");
      router.refresh();
    });
  }

  if (useRecovery) {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-[12px] font-semibold text-brand-ink">
            Recovery code
          </label>
          <Input
            value={recovery}
            onChange={(e) => setRecovery(e.target.value)}
            placeholder="ABCDE-FGHJK"
            autoComplete="one-time-code"
            className="mt-1.5 font-mono"
          />
        </div>
        {/* Said before they act, not after: a recovery code gets you in by
            switching 2FA off, and we will not pretend otherwise. */}
        <p className="rounded-input border border-[#FDE9C8] bg-[#FFFBEB] p-3 text-[12.5px] leading-relaxed text-[#B45309]">
          Using a recovery code turns two-factor <strong>off</strong> so you can
          get back in. You&apos;ll be asked to set it up again afterwards.
        </p>
        <Button
          type="button"
          className="w-full"
          onClick={redeem}
          disabled={pending || !recovery.trim()}
        >
          {pending ? "Checking…" : "Use recovery code"}
        </Button>
        <button
          type="button"
          onClick={() => setUseRecovery(false)}
          className="w-full text-[13px] font-semibold text-brand-primary hover:underline"
        >
          Back to authenticator code
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[12px] font-semibold text-brand-ink">
          6-digit code
        </label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          className="mt-1.5 font-mono text-lg tracking-widest"
        />
      </div>
      <Button
        type="button"
        className="w-full"
        onClick={verify}
        disabled={busy || code.replace(/\s/g, "").length < 6}
      >
        {busy ? "Verifying…" : "Verify and continue"}
      </Button>
      <button
        type="button"
        onClick={() => setUseRecovery(true)}
        className="w-full text-[13px] font-semibold text-brand-primary hover:underline"
      >
        Lost your phone? Use a recovery code
      </button>
    </div>
  );
}
