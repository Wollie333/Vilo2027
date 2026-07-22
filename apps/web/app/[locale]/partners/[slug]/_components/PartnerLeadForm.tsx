"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import { useState } from "react";

// The partner page's signup form.
//
// It does NOT create anything. It collects what the host has already typed and
// hands it to the real signup, so they never retype it — the whole point of the
// handoff. Two things it must get right:
//
//   1. It navigates through /r/<slug>, the ONLY route that drops the referral
//      cookie. Posting straight to /signup/host would lose the partner their
//      commission on every lead this page generates.
//   2. `next` must stay a single encoded value, because it carries its own
//      query string; unencoded, its params would be swallowed by /r's.

const PROPERTY_TYPES = [
  "Guesthouse / B&B",
  "Self-catering",
  "Safari lodge",
  "Whole home",
  "Rooms",
  "Multiple properties",
];

export function PartnerLeadForm({
  slug,
  campaignSlug,
  partnerName,
}: {
  slug: string;
  campaignSlug: string | null;
  partnerName: string;
}) {
  const [pending, setPending] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);

    // Only pass through what the host actually filled in — empty params would
    // overwrite good wizard defaults with blanks.
    const prefill = new URLSearchParams();
    for (const key of ["name", "email", "phone", "propertyType", "town"]) {
      const v = (fd.get(key) as string | null)?.trim();
      if (v) prefill.set(key, v);
    }

    const next = `/signup/host?${prefill.toString()}`;
    const ref = new URLSearchParams({ next });
    if (campaignSlug) ref.set("c", campaignSlug);

    window.location.href = `/r/${encodeURIComponent(slug)}?${ref.toString()}`;
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
      <div>
        <label
          htmlFor="lead-name"
          className="mb-1.5 block text-[12px] font-semibold text-brand-mute"
        >
          Full name
        </label>
        <input
          id="lead-name"
          name="name"
          required
          autoComplete="name"
          placeholder="e.g. Thabo Nkosi"
          className="h-[50px] w-full rounded-[11px] border border-brand-line px-4 text-[14.5px] text-brand-ink outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-brand-primary/15"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="lead-email"
            className="mb-1.5 block text-[12px] font-semibold text-brand-mute"
          >
            Email
          </label>
          <input
            id="lead-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@email.com"
            className="h-[50px] w-full rounded-[11px] border border-brand-line px-4 text-[14.5px] text-brand-ink outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-brand-primary/15"
          />
        </div>
        <div>
          <label
            htmlFor="lead-phone"
            className="mb-1.5 block text-[12px] font-semibold text-brand-mute"
          >
            Mobile
          </label>
          <input
            id="lead-phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            placeholder="071 234 5678"
            className="h-[50px] w-full rounded-[11px] border border-brand-line px-4 text-[14.5px] text-brand-ink outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-brand-primary/15"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="lead-type"
          className="mb-1.5 block text-[12px] font-semibold text-brand-mute"
        >
          What do you host?
        </label>
        <div className="relative">
          <select
            id="lead-type"
            name="propertyType"
            required
            defaultValue=""
            className="h-[50px] w-full appearance-none rounded-[11px] border border-brand-line bg-white px-4 pr-10 text-[14.5px] text-brand-ink outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-brand-primary/15"
          >
            <option value="" disabled>
              Select property type…
            </option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
        </div>
      </div>

      <div>
        <label
          htmlFor="lead-town"
          className="mb-1.5 block text-[12px] font-semibold text-brand-mute"
        >
          Town / region
        </label>
        <input
          id="lead-town"
          name="town"
          required
          placeholder="e.g. Hazyview, Mpumalanga"
          className="h-[50px] w-full rounded-[11px] border border-brand-line px-4 text-[14.5px] text-brand-ink outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-brand-primary/15"
        />
        <p className="mt-1.5 text-[11.5px] text-brand-mute">
          We&rsquo;ll look this up for you on the next step, so your address
          fills itself in.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-pill bg-brand-primary px-7 text-[15.5px] font-bold text-white transition hover:bg-brand-secondary disabled:opacity-60"
      >
        {pending ? "Taking you through…" : "Create my free listing"}
        <ArrowRight className="h-[18px] w-[18px]" />
      </button>
      <p className="text-center text-[11.5px] leading-relaxed text-brand-mute">
        No fees, no card. Referred by {partnerName}.
      </p>
    </form>
  );
}
