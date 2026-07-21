"use client";

import { ExternalLink, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";

import { createCampaignAction } from "../actions";

// WS-1i — campaign list + create. Creating only ever mints a DRAFT; configuring
// and launching happen in the builder, so a half-set-up campaign can never be
// paying commission.

type Row = {
  id: string;
  slug: string;
  name: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  enrolled: number;
  ladder: string;
  competition: string;
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-brand-light text-brand-mute border-brand-line",
  ended: "bg-amber-50 text-amber-700 border-amber-200",
  archived: "bg-rose-50 text-rose-600 border-rose-200",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function CampaignsList({ campaigns }: { campaigns: Row[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const res = await createCampaignAction({
        name,
        slug: slug || slugify(name),
      });
      if (res.ok && res.data) {
        toast.success("Draft campaign created — set it up below.");
        router.push(`/admin/affiliates/campaigns/${res.data.id}`);
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {creating ? null : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-secondary"
          >
            <Plus className="h-4 w-4" />
            New campaign
          </button>
        )}
      </div>

      {creating ? (
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h2 className="font-display text-[15px] font-bold text-brand-ink">
            New campaign
          </h2>
          <p className="mt-1 text-[12.5px] text-brand-mute">
            It starts as a draft that pays nothing. You set the ladder, prizes
            and dates next, then launch it.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                Name
              </span>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="Founding Race"
                className="mt-1 w-full rounded-[10px] border border-brand-line px-3 py-2 text-sm outline-none focus:border-brand-primary"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                Public link
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="font-mono text-[12px] text-brand-mute">
                  /competitions/
                </span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  placeholder="founding-race"
                  className="w-full rounded-[10px] border border-brand-line px-3 py-2 font-mono text-[13px] outline-none focus:border-brand-primary"
                />
              </div>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={create}
              disabled={pending || name.trim().length < 2}
              className="rounded-pill bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create draft"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-pill border border-brand-line px-4 py-2 text-[13px] font-medium text-brand-ink hover:bg-brand-light"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {campaigns.length === 0 ? (
        <div className="rounded-card border border-brand-line bg-white p-8 text-center text-[13px] text-brand-mute shadow-card">
          No campaigns yet.
        </div>
      ) : (
        <div className="space-y-3">
          {/* The card is a plain container, not a wrapping link: the public-link
              anchor has to be independently clickable (and open a new tab), and
              an <a> inside an <a> is invalid HTML. */}
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="rounded-card border border-brand-line bg-white p-5 shadow-card transition hover:border-brand-primary/40"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/admin/affiliates/campaigns/${c.id}`}
                  className="font-display text-[16px] font-bold text-brand-ink hover:text-brand-primary hover:underline"
                >
                  {c.name}
                </Link>
                <span
                  className={`inline-flex items-center rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                    STATUS_STYLES[c.status] ?? STATUS_STYLES.draft
                  }`}
                >
                  {c.status}
                </span>
                <a
                  href={`/competitions/${c.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  title={
                    c.status === "active"
                      ? "Open the public leaderboard in a new tab"
                      : "Not live yet — visitors get a 404 until you launch"
                  }
                  className="inline-flex items-center gap-1 font-mono text-[12px] text-brand-mute hover:text-brand-primary hover:underline"
                >
                  /competitions/{c.slug}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <span className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-brand-mute">
                  <Users className="h-3.5 w-3.5" />
                  {c.enrolled} enrolled
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-brand-mute">
                <span>{c.ladder}</span>
                <span>{c.competition}</span>
                <span>
                  {fmtDate(c.starts_at)} → {fmtDate(c.ends_at)}
                </span>
                <Link
                  href={`/admin/affiliates/campaigns/${c.id}`}
                  className="ml-auto font-medium text-brand-primary hover:underline"
                >
                  Edit campaign →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
