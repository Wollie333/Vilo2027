import type { Metadata } from "next";
import { ArrowLeft, FileText, Sparkles, Wallet, Zap } from "lucide-react";
import { Link } from "@/i18n/navigation";

import { getBrandName } from "@/lib/brand";

import { QuotesSignupForm } from "./QuotesSignupForm";

export async function generateMetadata(): Promise<Metadata> {
  const brandName = await getBrandName();
  return {
    title: "Send quotes on Wielo",
    description: `Respond to what travellers are looking for and send them quotes — without listing a property. A standalone ${brandName} Quotes account.`,
  };
}

export default async function QuotesSignupPage() {
  const brandName = await getBrandName();
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.05fr_1fr]">
      <aside className="relative flex min-h-[220px] flex-col overflow-hidden bg-brand-gradient-dark p-8 text-white lg:min-h-0 lg:p-14 xl:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-dot-grid opacity-25"
        />
        <div className="relative flex items-center justify-between">
          <Link
            href="/signup"
            className="group flex items-center gap-2 text-emerald-200/80 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> All signup options
          </Link>
        </div>
        <div className="relative flex max-w-md flex-1 flex-col justify-center py-8 lg:py-12">
          <div className="inline-flex items-center gap-1.5 self-start rounded-pill bg-white/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200/95 ring-1 ring-white/15">
            <Sparkles className="h-3 w-3" /> {brandName} Quotes
          </div>
          <h2 className="mt-5 font-display text-3xl font-bold leading-[1.1] tracking-tight lg:text-4xl">
            Quote travellers directly.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-emerald-100/75">
            Browse what travellers are looking for and send them a personalised
            quote — no property listing required. Perfect for tour operators,
            venues, planners and anyone who quotes off-platform today.
          </p>
          <ul className="mt-6 space-y-3 text-[14px] text-emerald-100/85">
            <li className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 shrink-0 text-emerald-300" /> Respond
              to Looking-For requests
            </li>
            <li className="flex items-center gap-2.5">
              <Zap className="h-4 w-4 shrink-0 text-emerald-300" /> Build a
              quote or upload a PDF
            </li>
            <li className="flex items-center gap-2.5">
              <Wallet className="h-4 w-4 shrink-0 text-emerald-300" /> Pay per
              quote with Wielo Credits
            </li>
          </ul>
        </div>
      </aside>

      <main className="relative flex min-w-0 items-stretch justify-center bg-brand-light/50 p-6 lg:items-center lg:p-10 xl:p-12">
        <div className="w-full max-w-[440px] py-10 lg:py-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-primary">
            Get started
          </div>
          <h1 className="mt-2 font-display text-[30px] font-bold leading-[1.1] tracking-tight text-brand-ink">
            Create your Quotes account
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-brand-mute">
            Free to join — you only need credits when you send a quote. Grab a
            credit pack or subscribe to {brandName} Quotes once you&apos;re in.
          </p>
          <div className="mt-7">
            <QuotesSignupForm />
          </div>
        </div>
      </main>
    </div>
  );
}
