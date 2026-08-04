"use client";

import { Info } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type { HelpEntry } from "./campaignHelp";

// A superscript ⓘ next to a field label. Clicking it explains, in plain
// language, what the field does and what it changes for partners — campaign
// config is money config, so nothing here should have to be guessed at.
//
// The copy itself lives in the plain (non-client) ./campaignHelp module so that
// server components can read CAMPAIGN_HELP as ordinary data — see the note there.
// NB: never re-export the CAMPAIGN_HELP *value* from here — re-exporting it
// through this "use client" module turns it back into a client reference and any
// server consumer hits the RSC manifest error again. Import it from ./campaignHelp.

export function FieldHelp({ help }: { help: HelpEntry }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What is "${help.title}"?`}
          className="ml-1 inline-flex -translate-y-1 items-center justify-center rounded-full align-super text-brand-mute transition-colors hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <Info className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="font-display text-[13.5px] font-bold text-brand-ink">
          {help.title}
        </div>
        <div className="mt-1.5 space-y-2 text-[12.5px] leading-relaxed text-brand-mute">
          {help.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {help.example ? (
          <p className="mt-2.5 rounded-[8px] bg-brand-light/70 p-2.5 text-[12px] leading-relaxed text-brand-ink">
            {help.example}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
