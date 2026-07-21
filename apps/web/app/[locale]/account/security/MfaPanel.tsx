"use client";

import { Check, KeyRound, ShieldCheck, ShieldOff, Copy } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  confirmMfaEnrolmentAction,
  disableMfaAction,
  regenerateBackupCodesAction,
  startMfaEnrolmentAction,
} from "./actions";

type Step = "idle" | "scanning" | "codes";

export function MfaPanel({
  enabled,
  backupCodesRemaining,
  hasPassword,
  email,
}: {
  enabled: boolean;
  backupCodesRemaining: number;
  hasPassword: boolean;
  email: string;
}) {
  const [pending, start] = useTransition();
  const [step, setStep] = useState<Step>("idle");
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [codesLeft, setCodesLeft] = useState(backupCodesRemaining);

  function begin() {
    start(async () => {
      const r = await startMfaEnrolmentAction();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (!r.data) return;
      setFactorId(r.data.factorId);
      setQr(r.data.qr);
      setSecret(r.data.secret);
      setStep("scanning");
    });
  }

  function confirm() {
    start(async () => {
      const r = await confirmMfaEnrolmentAction(factorId, code);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (!r.data) return;
      setBackupCodes(r.data.backupCodes);
      setCodesLeft(r.data.backupCodes.length);
      setIsEnabled(true);
      setCode("");
      setStep("codes");
      toast.success("Two-factor is on.");
    });
  }

  function disable() {
    start(async () => {
      const r = await disableMfaAction(currentPassword);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setIsEnabled(false);
      setCodesLeft(0);
      setCurrentPassword("");
      setStep("idle");
      toast.success("Two-factor is off.");
    });
  }

  function regenerate() {
    start(async () => {
      const r = await regenerateBackupCodesAction(currentPassword);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (!r.data) return;
      setBackupCodes(r.data.backupCodes);
      setCodesLeft(r.data.backupCodes.length);
      setCurrentPassword("");
      setStep("codes");
      toast.success("New recovery codes — the old ones no longer work.");
    });
  }

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      toast.success("Recovery codes copied");
    } catch {
      toast.error("Couldn't copy — write them down instead.");
    }
  }

  // Shown once, right after codes are issued. They cannot be retrieved later —
  // only replaced — so this screen says so rather than letting someone assume
  // they can come back for them.
  if (step === "codes") {
    return (
      <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-primary">
          <KeyRound className="h-3.5 w-3.5" /> Recovery codes
        </div>
        <h2 className="mt-2 font-display text-[20px] font-bold text-brand-ink">
          Save these somewhere safe
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-brand-mute">
          Each code works once, and only if you lose your phone. We can&apos;t
          show them again — you can generate a new set, which replaces these.
        </p>
        <ul className="rounded-input mt-5 grid grid-cols-2 gap-2 border border-brand-line bg-brand-light/50 p-4 font-mono text-[13px] text-brand-ink">
          {backupCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={copyCodes}>
            <Copy className="mr-1.5 h-4 w-4" /> Copy codes
          </Button>
          <Button type="button" onClick={() => setStep("idle")}>
            <Check className="mr-1.5 h-4 w-4" /> I&apos;ve saved them
          </Button>
        </div>
      </section>
    );
  }

  if (step === "scanning") {
    return (
      <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <h2 className="font-display text-[20px] font-bold text-brand-ink">
          Scan this with your authenticator app
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-brand-mute">
          Google Authenticator, 1Password, Authy — any of them. Then enter the
          6-digit code it shows.
        </p>
        <div className="mt-5 flex flex-wrap items-start gap-6">
          {/* Supabase returns the QR as an SVG data URI. */}
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="Two-factor QR code"
              className="rounded-input h-44 w-44 border border-brand-line bg-white p-2"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-brand-ink">
              Can&apos;t scan it?
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-brand-mute">
              Enter this key manually:
            </p>
            <code className="rounded-input mt-1.5 block break-all border border-brand-line bg-brand-light/50 p-2.5 font-mono text-[12.5px] text-brand-ink">
              {secret}
            </code>
            <div className="mt-4">
              <label className="text-[12px] font-semibold text-brand-ink">
                6-digit code
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className="mt-1.5 font-mono"
              />
            </div>
            <div className="mt-4 flex gap-3">
              <Button type="button" onClick={confirm} disabled={pending}>
                {pending ? "Checking…" : "Turn on two-factor"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("idle")}
                disabled={pending}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-card ${
            isEnabled
              ? "bg-[#ECFDF5] text-[#047857]"
              : "bg-brand-accent text-brand-secondary"
          }`}
        >
          {isEnabled ? (
            <ShieldCheck className="h-5 w-5" />
          ) : (
            <ShieldOff className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[20px] font-bold text-brand-ink">
            Two-factor authentication
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-brand-mute">
            {isEnabled
              ? "On. You'll be asked for a code from your authenticator app when you sign in."
              : "Off. Turn it on to add a code from your phone at sign-in."}
          </p>
          {isEnabled ? (
            <p className="mt-2 text-[12.5px] text-brand-mute">
              {codesLeft} recovery {codesLeft === 1 ? "code" : "codes"} left.
              {codesLeft <= 2 ? " Generate a new set soon." : null}
            </p>
          ) : null}
        </div>
      </div>

      {!isEnabled ? (
        <div className="mt-5">
          <Button type="button" onClick={begin} disabled={pending}>
            {pending ? "Starting…" : "Turn on two-factor"}
          </Button>
        </div>
      ) : (
        <div className="mt-5 border-t border-brand-line pt-5">
          {hasPassword ? (
            <>
              <label className="text-[12px] font-semibold text-brand-ink">
                Current password
              </label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="mt-1.5 max-w-xs"
              />
              <p className="mt-1 text-[12px] text-brand-mute">
                Required to change these settings — so a stolen session
                can&apos;t simply switch your security off.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={regenerate}
                  disabled={pending}
                >
                  New recovery codes
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={disable}
                  disabled={pending}
                >
                  Turn off two-factor
                </Button>
              </div>
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-brand-mute">
              Your account signs in by email link. To change these settings, set
              a password first — we&apos;ll email you a secure link if you try.
            </p>
          )}
        </div>
      )}

      <p className="mt-5 text-[12.5px] leading-relaxed text-brand-mute">
        Signing in for <span className="font-medium">{email}</span>.
      </p>
    </section>
  );
}
