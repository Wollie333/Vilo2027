"use client";

import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { claimGuestAccountAction } from "./actions";

export function ClaimForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    start(async () => {
      const result = await claimGuestAccountAction({ password });
      if (result.ok) {
        setDone(true);
        toast.success("Account secured");
        setTimeout(() => router.push("/portal/trips"), 900);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-confirmed/10 text-status-confirmed">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm text-brand-mute">
          Your account is set. Taking you to your trips…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-brand-mute">
          New password
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
          required
        />
      </label>
      <label className="block">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-brand-mute">
          Confirm password
        </span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className="mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
          required
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Lock className="h-4 w-4" />
        )}
        {pending ? "Securing…" : "Set password & claim account"}
      </button>
    </form>
  );
}
