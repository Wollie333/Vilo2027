"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateEmailAction, updatePasswordAction } from "./actions";

const inputCls =
  "w-full rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-brand-line bg-white shadow-card">
      <header className="border-b border-brand-line px-6 py-4">
        <h2 className="font-display text-lg font-semibold text-brand-ink">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-brand-mute">{description}</p>
      </header>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

export function SecurityForm({ email }: { email: string }) {
  return (
    <div className="space-y-8">
      <EmailSection currentEmail={email} />
      <PasswordSection />
    </div>
  );
}

function EmailSection({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState(currentEmail);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const r = await updateEmailAction({ email });
      if (r.ok) {
        toast.success(
          "Check your new inbox — we sent a link to confirm the change.",
        );
      } else toast.error(r.error);
    });
  }

  return (
    <SectionCard
      title="Email"
      description="Your sign-in email. We'll send a confirmation link to the new address before it changes."
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-brand-ink">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={inputCls}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={pending || email.trim() === currentEmail}
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-secondary disabled:opacity-60"
          >
            {pending ? "Saving…" : "Update email"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

function PasswordSection() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();

  function save() {
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    start(async () => {
      const r = await updatePasswordAction({ password });
      if (r.ok) {
        toast.success("Password updated.");
        setPassword("");
        setConfirm("");
      } else toast.error(r.error);
    });
  }

  return (
    <SectionCard
      title="Password"
      description="Choose a new password — at least 8 characters."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brand-ink">
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brand-ink">
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className={inputCls}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={pending || password.length < 8}
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-secondary disabled:opacity-60"
          >
            {pending ? "Saving…" : "Update password"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}
