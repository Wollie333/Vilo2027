"use client";

import { Check, Copy, Link2, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateAffiliateSlugAction } from "../actions";

export function ReferralLinkCard({
  baseUrl,
  slug,
}: {
  baseUrl: string;
  slug: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(slug);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const link = `${baseUrl}/r/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  }

  function save() {
    startTransition(async () => {
      const res = await updateAffiliateSlugAction(value);
      if (res.ok) {
        toast.success("Your referral link is updated.");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="rounded-card border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
        <Link2 className="h-3.5 w-3.5" />
        Your referral link
      </div>

      {editing ? (
        <div className="mt-2.5">
          <div className="flex items-center overflow-hidden rounded-md border border-white/15 bg-black/30">
            <span className="px-2.5 py-2 font-mono text-xs text-white/50">
              {baseUrl}/r/
            </span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value.toLowerCase())}
              autoFocus
              spellCheck={false}
              className="flex-1 bg-transparent py-2 pr-3 font-mono text-sm text-white outline-none"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setValue(slug);
                setEditing(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white">
            {link}
          </code>
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-xs font-semibold text-brand-ink hover:bg-white/90"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
          >
            <Pencil className="h-3.5 w-3.5" />
            Customise
          </button>
        </div>
      )}
    </div>
  );
}
