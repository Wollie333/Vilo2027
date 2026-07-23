"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/ui/modal";
import type { CampaignWinner, PrizeAward } from "@/lib/affiliate/finalize";

import {
  closeCampaignNowAction,
  publishCampaignResultsAction,
  recomputeCampaignResultsAction,
  settleCampaignPrizeAction,
} from "../actions";

// The campaign "Results" tab. Drives the finalization flow:
//   active            → auto-closes at the end date; "Close now" to end early.
//   ended, unpublished→ review the computed winners, then "Accept & publish".
//   published         → the final result, live on the public leaderboard.
// The winners are computed server-side (compute_campaign_results); this only
// reviews + publishes them. Publishing awards the placing FLOOR prizes.

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function fmtR(n: number): string {
  return `R ${Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CampaignResultsPanel({
  campaignId,
  campaignSlug,
  status,
  endsAt,
  computedAt,
  publishedAt,
  winners,
  prizes,
}: {
  campaignId: string;
  campaignSlug: string;
  status: string;
  endsAt: string | null;
  computedAt: string | null;
  publishedAt: string | null;
  winners: CampaignWinner[];
  prizes: PrizeAward[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const active = status === "active";
  const draft = status === "draft";
  const endedUnpublished = status === "ended" && !publishedAt;
  const published = status === "ended" && !!publishedAt;

  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string,
    onOk?: () => void,
  ) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(okMsg);
        onOk?.();
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  const totalCash = winners.reduce((s, w) => s + w.cash, 0);

  const winnersTable =
    winners.length === 0 ? (
      <div className="px-5 py-8 text-center text-[13px] text-brand-mute">
        No placing winners computed — either no one scored, or this campaign has
        no placing prizes configured.
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="ttable">
          <thead>
            <tr>
              <th>Prize</th>
              <th>Partner</th>
              <th className="r">Score</th>
              <th className="r">Cash prize</th>
              <th className="r">Rate floor</th>
            </tr>
          </thead>
          <tbody>
            {winners.map((w, i) => (
              <tr key={`${w.affiliateId}-${w.label}-${i}`}>
                <td className="whitespace-nowrap">
                  <span className="mr-1.5 text-[15px]">
                    {w.placing ? (MEDAL[w.placing] ?? `#${w.placing}`) : "🏅"}
                  </span>
                  <span className="text-[12.5px] font-medium text-brand-ink">
                    {w.label}
                  </span>
                </td>
                <td>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                      {w.name}
                    </div>
                    <div className="mono truncate text-[11px] text-brand-mute">
                      /r/{w.slug}
                    </div>
                  </div>
                </td>
                <td className="num r font-semibold text-brand-ink">
                  {w.score ?? "—"}
                </td>
                <td className="num r text-brand-ink">
                  {w.cash > 0 ? fmtR(w.cash) : "—"}
                </td>
                <td className="num r font-semibold text-brand-primary">
                  {w.floorPct > 0 ? `${w.floorPct}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* State banner + primary action */}
      <section className="am-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-brand-line px-5 py-3.5">
          <div className="min-w-0">
            <div className="smallcaps">Final results</div>
            <p className="mt-0.5 text-[11.5px] text-brand-mute">
              {draft
                ? "This campaign hasn't launched yet — results appear once it runs and ends."
                : active
                  ? `Running. It auto-closes at its end date${endsAt ? ` (${fmtDate(endsAt)})` : ""} and the winners are computed for your review — nothing goes public until you accept.`
                  : endedUnpublished
                    ? "Closed. The winners below are computed from the final standings and are visible to admins only. Review, then accept to publish."
                    : `Published ${fmtDate(publishedAt)} — this is the official final leaderboard.`}
            </p>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {active ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmClose(true)}
                className="inline-flex h-8 items-center rounded-md border border-brand-line px-3 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-light disabled:opacity-50"
              >
                Close now
              </button>
            ) : null}
            {endedUnpublished ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => recomputeCampaignResultsAction({ campaignId }),
                      "Winners recomputed from the latest standings.",
                    )
                  }
                  className="inline-flex h-8 items-center rounded-md border border-brand-line px-3 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-light disabled:opacity-50"
                >
                  Recompute
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmPublish(true)}
                  className="btn-pri h-8 px-3 text-[12.5px] disabled:opacity-50"
                >
                  Accept &amp; publish
                </button>
              </>
            ) : null}
            {published ? (
              <a
                href={`/competitions/${campaignSlug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-brand-line px-3 text-[12.5px] font-semibold text-brand-primary hover:bg-brand-light"
              >
                View public final
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>

        {endedUnpublished ? (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-[12px] font-medium text-amber-800">
            Not public yet — awaiting your review.
          </div>
        ) : null}

        {!draft ? winnersTable : null}

        {winners.length > 0 ? (
          <div className="border-t border-brand-line px-5 py-3 text-[11.5px] text-brand-mute">
            {computedAt ? <>Computed {fmtDate(computedAt)}. </> : null}
            {totalCash > 0 ? (
              <>
                Cash prizes total{" "}
                <span className="num font-semibold text-brand-ink">
                  {fmtR(totalCash)}
                </span>
                . On publish they become payables to settle below, and rate
                floors are applied automatically.
              </>
            ) : (
              "Rate floors are applied automatically on publish."
            )}
          </div>
        ) : null}
      </section>

      {/* Cash prizes to settle — only exist once published. */}
      {prizes.length > 0 ? (
        <section className="am-card overflow-hidden">
          <div className="border-b border-brand-line px-5 py-3.5">
            <div className="smallcaps">Cash prizes</div>
            <p className="mt-0.5 text-[11.5px] text-brand-mute">
              Recorded automatically on publish. Pay the partner, then mark it
              settled here — the money transfer itself stays your call.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="ttable">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Prize</th>
                  <th className="r">Amount</th>
                  <th>Status</th>
                  <th className="r" />
                </tr>
              </thead>
              <tbody>
                {prizes.map((p) => (
                  <tr key={p.id}>
                    <td className="font-semibold text-brand-ink">{p.name}</td>
                    <td className="text-brand-mute">{p.label}</td>
                    <td className="num r font-semibold text-brand-ink">
                      {fmtR(p.amount)}
                    </td>
                    <td>
                      <span
                        className={`tag ${p.status === "paid" ? "green" : p.status === "void" ? "gray" : "amber"}`}
                      >
                        <span className="d" />
                        <span className="capitalize">{p.status}</span>
                      </span>
                    </td>
                    <td className="r">
                      {p.status === "owed" ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () =>
                                  settleCampaignPrizeAction({
                                    campaignId,
                                    prizeId: p.id,
                                    action: "paid",
                                  }),
                                `${p.name}'s prize marked paid.`,
                              )
                            }
                            className="btn-pri h-8 px-3 text-[12px] disabled:opacity-50"
                          >
                            Mark paid
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () =>
                                  settleCampaignPrizeAction({
                                    campaignId,
                                    prizeId: p.id,
                                    action: "void",
                                  }),
                                "Prize voided.",
                              )
                            }
                            className="inline-flex h-8 items-center rounded-md border border-brand-line px-3 text-[12px] font-semibold text-brand-ink hover:bg-brand-light disabled:opacity-50"
                          >
                            Void
                          </button>
                        </div>
                      ) : p.reference ? (
                        <span className="mono text-[11px] text-brand-mute">
                          {p.reference}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Close-early confirm */}
      <Modal
        open={confirmClose}
        onOpenChange={setConfirmClose}
        intent="warning"
        title="Close this campaign now?"
        description="It ends immediately (ahead of its end date), scoring stops, and the winners are computed for your review. You'll still need to accept before anything goes public. This can't be undone."
        actions={[
          {
            label: "Cancel",
            kind: "ghost",
            onClick: () => setConfirmClose(false),
          },
          {
            label: "Close campaign",
            kind: "danger",
            disabled: pending,
            onClick: () => {
              run(
                () => closeCampaignNowAction({ campaignId }),
                "Campaign closed — review the winners below.",
                () => setConfirmClose(false),
              );
              return false;
            },
          },
        ]}
      />

      {/* Publish confirm */}
      <Modal
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="Publish the final results?"
        description="The winners go live on the public leaderboard and the placing rate-floor prizes are permanently awarded. A published final is a public record — this can't be undone."
        actions={[
          {
            label: "Cancel",
            kind: "ghost",
            onClick: () => setConfirmPublish(false),
          },
          {
            label: "Publish results",
            kind: "primary",
            disabled: pending,
            onClick: () => {
              run(
                () => publishCampaignResultsAction({ campaignId }),
                "Results published — winners are live and floors awarded.",
                () => setConfirmPublish(false),
              );
              return false;
            },
          },
        ]}
      />
    </div>
  );
}
