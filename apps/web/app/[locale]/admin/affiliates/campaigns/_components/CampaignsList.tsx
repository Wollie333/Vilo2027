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
  capacity: number | null;
  ladder: string;
  competition: string;
};

const STATUS_TAG: Record<string, { cls: string; label: string }> = {
  active: { cls: "green", label: "Active" },
  draft: { cls: "gray", label: "Draft" },
  ended: { cls: "amber", label: "Ended" },
  archived: { cls: "red", label: "Archived" },
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[17px] font-bold text-brand-ink">
            Campaigns
          </h2>
          <p className="mt-0.5 text-[12.5px] text-brand-mute">
            Competitions pay their own commission ladder to enrolled partners —
            nothing goes active until you launch it.
          </p>
        </div>
        {creating ? null : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn-pri h-9"
          >
            <Plus className="h-4 w-4" />
            New campaign
          </button>
        )}
      </div>

      {creating ? (
        <div className="am-card fade p-5">
          <div className="smallcaps">New campaign</div>
          <p className="mt-1 text-[12.5px] text-brand-mute">
            It starts as a draft that pays nothing. You set the ladder, prizes
            and dates next, then launch it.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="flabel">Name</span>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="Founding Race"
                className="fld"
              />
            </label>
            <label className="block">
              <span className="flabel">Public link</span>
              <div className="flex items-center gap-1.5">
                <span className="mono text-[12px] text-brand-mute">
                  /competitions/
                </span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  placeholder="founding-race"
                  className="fld mono text-[13px]"
                />
              </div>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={create}
              disabled={pending || name.trim().length < 2}
              className="btn-pri h-9"
            >
              {pending ? "Creating…" : "Create draft"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="btn-sec h-9"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {campaigns.length === 0 ? (
        <div className="am-card px-5 py-8 text-center text-[13px] text-brand-mute">
          No campaigns yet.
        </div>
      ) : (
        <div className="space-y-3">
          {/* The card is a plain container, not a wrapping link: the public-link
              anchor has to be independently clickable (and open a new tab), and
              an <a> inside an <a> is invalid HTML. */}
          {campaigns.map((c) => {
            const tag = STATUS_TAG[c.status] ?? STATUS_TAG.draft;
            return (
              <div
                key={c.id}
                className="am-card fade p-5 transition hover:border-[#cde6d8]"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/admin/affiliates/campaigns/${c.id}`}
                    className="font-display text-[16px] font-bold text-brand-ink hover:text-brand-primary hover:underline"
                  >
                    {c.name}
                  </Link>
                  <span className={`tag ${tag.cls}`}>
                    <span className="d" />
                    {tag.label}
                  </span>
                  {/* Public page on top, the partner signup link for the same
                    competition directly beneath it — the two URLs that exist
                    per campaign, always in the same order. */}
                  <span className="flex flex-col gap-0.5">
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
                    <a
                      href={`/signup/partner/${c.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      title={
                        c.status === "active"
                          ? "Open this competition's partner signup page in a new tab"
                          : "Works, but won't enter anyone in the race until you launch"
                      }
                      className="inline-flex items-center gap-1 font-mono text-[12px] text-brand-mute hover:text-brand-primary hover:underline"
                    >
                      /signup/partner/{c.slug}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-brand-mute">
                    <Users className="h-3.5 w-3.5" />
                    {c.capacity != null ? (
                      <>
                        {c.enrolled} of {c.capacity} places
                        {c.enrolled >= c.capacity ? (
                          <span className="font-semibold text-status-pending">
                            · full
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>{c.enrolled} enrolled</>
                    )}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
