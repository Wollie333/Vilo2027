"use client";

import {
  Check,
  Copy,
  Globe,
  Link2,
  Mail,
  MessageCircle,
  Pencil,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateAffiliateSlugAction } from "../actions";

// The affiliate link hero card (light) — copy field + share shortcuts, matching
// the Affiliate Portal design. Copy + Customise hit the real slug action; the
// WhatsApp / Email shortcuts open a pre-filled share with the link baked in.
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
  const [codeCopied, setCodeCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const link = `${baseUrl}/r/${slug}`;
  const display = link.replace(/^https?:\/\//, "");
  const shareText = `Run your place on Wielo — direct bookings, zero booking fees. Sign up: ${link}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent(
    "A better way to run your guesthouse",
  )}&body=${encodeURIComponent(shareText)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(slug);
      setCodeCopied(true);
      toast.success("Partner code copied");
      setTimeout(() => setCodeCopied(false), 1500);
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
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            <Link2 className="h-3.5 w-3.5 text-brand-primary" />
            Your affiliate link
          </div>
          <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-brand-mute">
            Share this anywhere. Every host who signs up and subscribes through
            it earns you recurring commission.
          </p>
        </div>

        <div className="w-full shrink-0 sm:w-[420px]">
          {editing ? (
            <div>
              <div className="flex items-center overflow-hidden rounded-[11px] border border-brand-line bg-brand-light">
                <span className="px-3 py-2.5 font-mono text-xs text-brand-mute">
                  {baseUrl.replace(/^https?:\/\//, "")}/r/
                </span>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value.toLowerCase())}
                  autoFocus
                  spellCheck={false}
                  className="flex-1 bg-transparent py-2.5 pr-3 font-mono text-sm text-brand-ink outline-none"
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={save}
                  disabled={pending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-xs font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" />
                  {pending ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => {
                    setValue(slug);
                    setEditing(false);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-brand-line px-4 text-xs font-medium text-brand-mute transition hover:bg-brand-light"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex h-12 items-center gap-2.5 rounded-[11px] border border-brand-accent bg-brand-light pl-4 pr-1.5">
                <Globe className="h-4 w-4 shrink-0 text-brand-mute" />
                <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-brand-ink">
                  {display}
                </span>
                <button
                  onClick={copy}
                  className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white transition hover:bg-brand-secondary"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
                >
                  <Pencil className="h-3.5 w-3.5" /> Customise
                </button>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
                <a
                  href={mailHref}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </a>
              </div>

              {/* The bare partner code — new hosts type this into the signup
                  "Referred by" field, which resolves it to your name. */}
              <div className="mt-3 flex items-center gap-2 rounded-[9px] border border-dashed border-brand-accent bg-brand-light/50 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                  Partner code
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[14px] font-semibold text-brand-ink">
                  {slug}
                </span>
                <button
                  onClick={copyCode}
                  className="inline-flex h-7 items-center gap-1 rounded-pill border border-brand-line bg-white px-2.5 text-[11px] font-semibold text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
                >
                  {codeCopied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {codeCopied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-brand-mute">
                Prefer to share just the code? New hosts enter it under
                &ldquo;Referred by&rdquo; when they sign up.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
