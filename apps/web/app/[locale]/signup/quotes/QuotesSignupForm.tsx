"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import {
  TurnstileWidget,
  turnstileEnabled,
} from "@/components/site/TurnstileWidget";

import { createQuotesAccountAction } from "./actions";

export function QuotesSignupForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  // Honeypot — real users never fill it; a non-empty value = a bot.
  const [honeypot, setHoneypot] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!terms) {
      toast.error("Please accept the terms to continue.");
      return;
    }
    if (turnstileEnabled() && !captchaToken) {
      toast.error("Please complete the human check.");
      return;
    }
    start(async () => {
      const r = await createQuotesAccountAction(
        { first_name: firstName, surname, email, password, terms },
        captchaToken,
        honeypot,
      );
      if (!r.ok) {
        toast.error(r.error);
        setCaptchaReset((n) => n + 1);
        setCaptchaToken(null);
        return;
      }
      toast.success("Welcome to Wielo Quotes!");
      router.push("/dashboard/looking-for");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-brand-ink">
            First name
          </label>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jane"
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-brand-ink">
            Surname
          </label>
          <Input
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            placeholder="Doe"
            autoComplete="family-name"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-brand-ink">
          Email
        </label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-brand-ink">
          Password
        </label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Choose a strong password"
          autoComplete="new-password"
        />
        <PasswordStrengthMeter password={password} />
      </div>
      <label className="flex items-start gap-2.5 text-[12.5px] leading-snug text-brand-mute">
        <input
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
        />
        <span>
          I agree to the{" "}
          <Link
            href="/terms"
            className="font-semibold text-brand-primary hover:underline"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="font-semibold text-brand-primary hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {/* Honeypot — off-screen decoy; real users never see or fill it. */}
      <div
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="company_website">Company website</label>
        <input
          id="company_website"
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      {turnstileEnabled() ? (
        <TurnstileWidget
          onVerify={setCaptchaToken}
          resetSignal={captchaReset}
        />
      ) : null}
      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? "Creating your account…" : "Create my quotes account"}
      </Button>
      <p className="text-center text-[13px] text-brand-mute">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-brand-ink hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
