"use client";

import { BadgePercent, Check, Megaphone, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { acceptAffiliateTermsAction } from "../actions";

const PERKS = [
  {
    icon: BadgePercent,
    title: "Earn on every referral",
    body: "Commission is set per product. You earn on what the people you refer actually pay.",
  },
  {
    icon: Megaphone,
    title: "Ready-made marketing",
    body: "Grab your link and download banners with your referral built in.",
  },
  {
    icon: Wallet,
    title: "Get paid out",
    body: "Request payouts by EFT, Paystack or PayPal once your balance clears.",
  },
];

export function AffiliateTermsGate({
  brand,
  termsVersion,
  termsContent,
}: {
  brand: string;
  termsVersion: string;
  termsContent: string;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [pending, startTransition] = useTransition();

  // Admin-authored terms: blank lines → paragraphs, {brand} → live brand name.
  const paragraphs = termsContent
    .replace(/\{brand\}/g, brand)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  function handleAccept() {
    if (!agreed) return;
    startTransition(async () => {
      const res = await acceptAffiliateTermsAction();
      if (res.ok) {
        toast.success("You're in — welcome to the affiliate programme.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div
        className="overflow-hidden rounded-card text-white shadow-card"
        style={{
          backgroundImage:
            "linear-gradient(145deg, #030806 0%, #0a1510 50%, #051209 100%)",
        }}
      >
        <div className="p-7 sm:p-9">
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/80">
            Affiliate programme
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Earn with {brand}.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/70">
            Refer hosts and travellers to {brand} and earn commission on the
            products they buy. Accept the affiliate terms to unlock your
            dashboard, links and marketing material.
          </p>

          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            {PERKS.map((p) => (
              <div
                key={p.title}
                className="rounded-card border border-white/10 bg-white/[0.04] p-4"
              >
                <p.icon className="h-5 w-5 text-emerald-300" />
                <div className="mt-2 text-sm font-semibold">{p.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-white/60">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-card border border-brand-line bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-semibold text-brand-ink">
          Affiliate terms
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-brand-mute">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p className="text-xs text-brand-mute/70">
            Terms version {termsVersion}
          </p>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-card border border-brand-line bg-brand-light/40 p-4">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
          />
          <span className="text-sm text-brand-ink">
            I have read and agree to the {brand} affiliate terms.
          </span>
        </label>

        <div className="mt-5 flex justify-end">
          <Button
            onClick={handleAccept}
            disabled={!agreed || pending}
            className="gap-1.5"
          >
            <Check className="h-4 w-4" />
            {pending ? "Setting up…" : "Join the programme"}
          </Button>
        </div>
      </div>
    </div>
  );
}
