"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/ui/modal";

import {
  awardCampaignFloorAction,
  removeCampaignFloorAction,
} from "../actions";

// Award / remove a commission FLOOR — a competition prize that permanently locks
// a partner's minimum rate for this campaign. Mirrors EnrollmentPauseButton's
// client-action pattern (useTransition + toast + router.refresh). The heavy
// lifting (validation, ladder-only guard, recompute, audit) is in the server
// action; this only collects the input.

export type FloorRow = {
  affiliateId: string;
  name: string;
  slug: string;
  ratePct: number;
  wonVia: string;
  awarded: string;
};

export type FloorPartner = { id: string; name: string; slug: string };

export function FloorAwardManager({
  campaignId,
  isLadder,
  partners,
  floors,
}: {
  campaignId: string;
  isLadder: boolean;
  partners: FloorPartner[];
  floors: FloorRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [affiliateId, setAffiliateId] = useState("");
  const [ratePct, setRatePct] = useState("");
  const [wonVia, setWonVia] = useState("");

  const rateNum = Number(ratePct);
  const rateValid = Number.isFinite(rateNum) && rateNum > 0 && rateNum <= 100;
  const canSubmit =
    Boolean(affiliateId) && rateValid && wonVia.trim().length >= 3 && !pending;

  const holderIds = useMemo(
    () => new Set(floors.map((f) => f.affiliateId)),
    [floors],
  );

  function reset() {
    setAffiliateId("");
    setRatePct("");
    setWonVia("");
  }

  function award() {
    startTransition(async () => {
      const res = await awardCampaignFloorAction({
        campaignId,
        affiliateId,
        floorPct: rateNum,
        wonVia: wonVia.trim(),
      });
      if (res.ok) {
        const who =
          partners.find((p) => p.id === affiliateId)?.name ?? "Partner";
        toast.success(`${who}'s floor locked at ${rateNum}%.`);
        setOpen(false);
        reset();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove(f: FloorRow) {
    startTransition(async () => {
      const res = await removeCampaignFloorAction({
        campaignId,
        affiliateId: f.affiliateId,
      });
      if (res.ok) {
        toast.success(`${f.name}'s floor removed.`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="am-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-brand-line px-5 py-3.5">
        <div className="min-w-0">
          <div className="smallcaps">Commission floors awarded</div>
          <p className="mt-0.5 text-[11.5px] text-brand-mute">
            Prizes that permanently lock a partner&apos;s minimum rate. These
            survive the campaign ending and take effect from now.
          </p>
        </div>
        <button
          type="button"
          disabled={!isLadder || partners.length === 0}
          onClick={() => setOpen(true)}
          title={
            !isLadder
              ? "Floors only apply to ladder campaigns"
              : partners.length === 0
                ? "No partners in this campaign yet"
                : undefined
          }
          className="btn-pri ml-auto h-8 shrink-0 px-3 text-[12.5px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Award floor
        </button>
      </div>

      {!isLadder ? (
        <div className="px-5 py-3 text-[11.5px] text-brand-mute">
          This campaign pays a flat / inherited rate, so floors have no effect
          here — they only raise a partner&apos;s rate on a ladder campaign.
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="ttable">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Locked rate</th>
              <th>Why</th>
              <th>Awarded</th>
              <th className="r" />
            </tr>
          </thead>
          <tbody>
            {floors.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-brand-mute">
                  No floors awarded yet.
                </td>
              </tr>
            ) : (
              floors.map((f) => (
                <tr key={f.affiliateId}>
                  <td>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                        {f.name}
                      </div>
                      <div className="mono truncate text-[11px] text-brand-mute">
                        /r/{f.slug}
                      </div>
                    </div>
                  </td>
                  <td className="num font-semibold text-brand-primary">
                    {f.ratePct}%
                  </td>
                  <td className="max-w-[20rem] text-brand-mute">{f.wonVia}</td>
                  <td className="num text-brand-mute">{f.awarded}</td>
                  <td className="r">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => remove(f)}
                      className="inline-flex h-8 items-center rounded-md border border-brand-line px-3 text-[12px] font-semibold text-brand-ink hover:bg-brand-light disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onOpenChange={(o) => {
          if (!o) reset();
          setOpen(o);
        }}
        title="Award a commission floor"
        description="Locks this partner's MINIMUM rate for the campaign. If their ladder rate is already higher, they keep the higher one. It takes effect on this month's unpaid commissions immediately."
        input={
          <div className="space-y-3 text-left">
            <div>
              <label
                htmlFor="floor-partner"
                className="mb-1 block text-[12px] font-medium text-brand-ink"
              >
                Partner
              </label>
              <select
                id="floor-partner"
                value={affiliateId}
                onChange={(e) => setAffiliateId(e.target.value)}
                className="input w-full"
              >
                <option value="">Select a partner…</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {holderIds.has(p.id) ? " (has a floor — will update)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="floor-rate"
                className="mb-1 block text-[12px] font-medium text-brand-ink"
              >
                Locked rate (%)
              </label>
              <input
                id="floor-rate"
                type="number"
                min={1}
                max={100}
                step="0.5"
                value={ratePct}
                onChange={(e) => setRatePct(e.target.value)}
                placeholder="e.g. 20"
                className="input w-full"
              />
              {ratePct && !rateValid ? (
                <p className="mt-1 text-[11px] text-red-600">
                  Enter a rate between 0 and 100%.
                </p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="floor-why"
                className="mb-1 block text-[12px] font-medium text-brand-ink"
              >
                Why — shown to the partner
              </label>
              <input
                id="floor-why"
                value={wonVia}
                onChange={(e) => setWonVia(e.target.value)}
                placeholder="e.g. 1st place — Founding Race Season 1"
                className="input w-full"
              />
            </div>
          </div>
        }
        actions={[
          { label: "Cancel", kind: "ghost", onClick: () => setOpen(false) },
          {
            label: "Award floor",
            kind: "primary",
            disabled: !canSubmit,
            onClick: () => {
              award();
              return false; // keep open until the action settles
            },
          },
        ]}
      />
    </section>
  );
}
