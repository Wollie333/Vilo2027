"use client";

import { Flag, Plus, Sun, Trophy } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { enrollInCampaignAction } from "../actions";

// "Open to join" campaign card — pixel-match of the design. Handles the join
// flow (with CPA rules acceptance when the campaign has a rules doc) via the
// existing enrollInCampaignAction. Ended campaigns render read-only.
export type OpenCampaign = {
  id: string;
  name: string;
  description: string;
  commission: string;
  runs: string;
  hasCompetition: boolean;
  status: "open" | "ended";
  rulesHref: string | null;
  rulesVersion: number | null;
  endedResult?: string | null;
  stillEarning?: string | null;
};

const ICONS = { open: Sun, ended: Trophy, comp: Flag };

export function CampaignJoinCard({ c }: { c: OpenCampaign }) {
  const [pending, start] = useTransition();
  const [accepted, setAccepted] = useState(false);
  const rulesRequired = Boolean(c.rulesHref && c.rulesVersion);
  const Icon = c.status === "ended" ? ICONS.ended : ICONS.open;

  function join() {
    if (rulesRequired && !accepted) {
      toast.error("Please accept the campaign rules first.");
      return;
    }
    start(async () => {
      const res = await enrollInCampaignAction(c.id, accepted);
      if (res.ok) toast.success(`Joined ${c.name}`);
      else toast.error(res.error ?? "Couldn't join right now.");
    });
  }

  if (c.status === "ended") {
    return (
      <div className="am-card p-5 opacity-80">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-brand-line bg-[#F4F7F5] text-brand-mute">
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <span className="tag gray">
            <span className="d" />
            Ended
          </span>
        </div>
        <div className="mt-3 font-display text-[16px] font-bold text-brand-ink">
          {c.name}
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-brand-mute">
          {c.description}
        </p>
        <dl className="mt-3 space-y-1.5 text-[12px]">
          {c.endedResult ? (
            <div className="flex justify-between">
              <dt className="text-brand-mute">Your result</dt>
              <dd className="font-semibold text-brand-ink">{c.endedResult}</dd>
            </div>
          ) : null}
          {c.stillEarning ? (
            <div className="flex justify-between">
              <dt className="text-brand-mute">Still earning</dt>
              <dd className="num font-semibold text-brand-ink">
                {c.stillEarning}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    );
  }

  return (
    <div className="am-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-brand-line bg-brand-light text-brand-secondary">
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <span className="tag green">
          <span className="d" />
          Open
        </span>
      </div>
      <div className="mt-3 font-display text-[16px] font-bold text-brand-ink">
        {c.name}
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-brand-mute">
        {c.description}
      </p>
      <dl className="mt-3 space-y-1.5 text-[12px]">
        <div className="flex justify-between">
          <dt className="text-brand-mute">Commission</dt>
          <dd className="font-semibold text-brand-ink">{c.commission}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-brand-mute">Runs</dt>
          <dd className="num font-semibold text-brand-ink">{c.runs}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-brand-mute">Competition</dt>
          <dd className="font-semibold text-brand-ink">
            {c.hasCompetition ? "Yes · leaderboard" : "None"}
          </dd>
        </div>
      </dl>
      {rulesRequired ? (
        <label className="mt-3 flex items-start gap-2 text-[11.5px] leading-relaxed text-brand-mute">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 accent-[#10B981]"
          />
          <span>
            I accept the{" "}
            <a
              href={c.rulesHref!}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-primary"
            >
              campaign rules
            </a>{" "}
            (v{c.rulesVersion}).
          </span>
        </label>
      ) : null}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={join}
          disabled={pending}
          className="btn-pri h-9 px-4 text-[12.5px]"
        >
          <Plus className="h-4 w-4" /> {pending ? "Joining…" : "Join campaign"}
        </button>
        {c.rulesHref ? (
          <a
            href={c.rulesHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            View rules
          </a>
        ) : null}
      </div>
    </div>
  );
}
