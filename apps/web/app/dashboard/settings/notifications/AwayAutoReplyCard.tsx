"use client";

import { Loader2, MoonStar, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useBrandName } from "@/components/brand/BrandProvider";

import { setEnquiryAutoReplyAction } from "./actions";

export function AwayAutoReplyCard({ initial }: { initial: string | null }) {
  const brandName = useBrandName();
  const [value, setValue] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const dirty = value.trim() !== (initial ?? "").trim();

  function save() {
    if (pending || !dirty) return;
    start(async () => {
      const r = await setEnquiryAutoReplyAction(value);
      if (r.ok) toast.success("Away auto-reply saved");
      else toast.error(r.error);
    });
  }

  return (
    <div className="mt-8 rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <MoonStar className="h-4 w-4 text-brand-primary" />
        <h3 className="font-display text-base font-bold text-brand-ink">
          Away auto-reply
        </h3>
      </div>
      <p className="mt-1 text-sm text-brand-mute">
        When a guest requests a quote during your{" "}
        <span className="font-medium text-brand-ink">quiet hours</span> (set
        above), {brandName} posts this message into the thread so they know when
        to expect a reply. Leave blank to turn it off.
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 1000))}
        rows={3}
        placeholder="Thanks for reaching out! I'm away right now but I'll reply with a quote first thing in the morning."
        className="mt-3 w-full resize-y rounded-[10px] border border-brand-line px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10 disabled:opacity-60"
        disabled={pending}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-[10.5px] text-brand-mute">
          {value.length}/1000
        </span>
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
