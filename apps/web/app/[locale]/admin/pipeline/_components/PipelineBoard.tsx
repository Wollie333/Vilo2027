"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  BedDouble,
  CalendarClock,
  Clock,
  CreditCard,
  Eye,
  Inbox,
  Mail,
  MapPin,
  Phone,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import type { Audience, BoardStage } from "@/lib/pipeline/queries";

import { moveLeadStageAction } from "../actions";
import { DeleteLeadDialog } from "./DeleteLeadDialog";

function band(score: number): [string, string] {
  if (score >= 70) return ["Hot", "bg-red-50 text-red-700 border-red-200"];
  if (score >= 45)
    return ["Warm", "bg-amber-50 text-amber-700 border-amber-200"];
  return ["Cold", "bg-brand-light text-brand-mute border-brand-line"];
}

export function PipelineBoard({
  stages: initialStages,
  audience,
  canDelete,
}: {
  stages: BoardStage[];
  audience: Audience;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [stages, setStages] = useState(initialStages);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Keep local state in sync when the server sends fresh data (after refresh).
  useEffect(() => setStages(initialStages), [initialStages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const total = stages.reduce((n, s) => n + s.leads.length, 0) || 1;

  // Drop a deleted lead out of every column immediately, then refresh for truth.
  function removeLead(leadId: string) {
    setStages((prev) =>
      prev.map((s) => ({
        ...s,
        leads: s.leads.filter((l) => l.id !== leadId),
      })),
    );
    router.refresh();
  }

  function onDragEnd(e: DragEndEvent) {
    const leadId = String(e.active.id);
    const fromStageId = e.active.data.current?.stageId as string | undefined;
    const toStageId = e.over ? String(e.over.id) : null;
    if (!toStageId || !fromStageId || fromStageId === toStageId) return;

    const snapshot = stages;
    // Optimistic move.
    setStages((prev) => {
      const lead = prev
        .find((s) => s.id === fromStageId)
        ?.leads.find((l) => l.id === leadId);
      if (!lead) return prev;
      return prev.map((s) => {
        if (s.id === fromStageId)
          return { ...s, leads: s.leads.filter((l) => l.id !== leadId) };
        if (s.id === toStageId)
          return { ...s, leads: [{ ...lead, stageId: toStageId }, ...s.leads] };
        return s;
      });
    });

    startTransition(async () => {
      try {
        await moveLeadStageAction({ leadId, stageId: toStageId });
        router.refresh();
      } catch {
        setStages(snapshot);
        setError("Couldn't move that lead. Please try again.");
      }
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      {error ? (
        <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 lg:mx-6">
          {error}
        </div>
      ) : null}
      <div className="thin-scroll min-h-0 flex-1 overflow-x-auto bg-[#FBFDFC] px-4 py-4 lg:px-6">
        <div className="flex h-full items-stretch gap-4">
          {stages.map((s) => (
            <Column
              key={s.id}
              stage={s}
              total={total}
              audience={audience}
              canDelete={canDelete}
              onDeleted={removeLead}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
}

function Column({
  stage,
  total,
  audience,
  canDelete,
  onDeleted,
}: {
  stage: BoardStage;
  total: number;
  audience: Audience;
  canDelete: boolean;
  onDeleted: (leadId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const pct = Math.round((stage.leads.length / total) * 100);

  return (
    <section className="flex max-h-full w-[300px] flex-none flex-col">
      <div className="rounded-xl border border-brand-line bg-white p-2.5 shadow-card">
        <div className="flex items-center gap-2">
          {stage.isWon ? (
            <span className="h-[7px] w-[7px] rounded-full bg-brand-primary" />
          ) : stage.isChurned ? (
            <span className="h-[7px] w-[7px] rounded-full bg-rose-400" />
          ) : null}
          <h3
            className={`font-display text-[13px] font-bold ${
              stage.isWon
                ? "text-brand-secondary"
                : stage.isChurned
                  ? "text-rose-600"
                  : stage.isLost
                    ? "text-brand-mute"
                    : ""
            }`}
          >
            {stage.label}
          </h3>
          <span className="rounded-full border border-brand-line bg-[#F4F8F5] px-2 py-px text-[11.5px] font-semibold tabular-nums text-brand-mute">
            {stage.leads.length}
          </span>
          <span className="ml-auto text-[11.5px] tabular-nums text-brand-mute">
            {pct}%
          </span>
        </div>
        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[#EEF4F0]">
          <div
            className={`h-full rounded-full ${
              stage.isWon
                ? "bg-brand-primary"
                : stage.isChurned
                  ? "bg-rose-300"
                  : "bg-[#A7E8CB]"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`mt-2 flex min-h-[180px] flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border p-2 transition ${
          isOver
            ? "border-dashed border-[#A7E8CB] bg-[#ECFDF5]"
            : "border-transparent bg-[#F6FAF7]"
        }`}
      >
        {stage.leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-9 text-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-line bg-white text-brand-mute">
              <Inbox className="h-4 w-4" />
            </span>
            <p className="mt-2.5 text-[12.5px] font-semibold">Nothing here</p>
            <p className="mt-0.5 text-[11.5px] text-brand-mute">
              Drag a lead in, or wait for new signups.
            </p>
          </div>
        ) : (
          stage.leads.map((l) => (
            <LeadCard
              key={l.id}
              lead={l}
              stageId={stage.id}
              audience={audience}
              locked={stage.isCustomer}
              canDelete={canDelete}
              onDeleted={onDeleted}
            />
          ))
        )}
      </div>
    </section>
  );
}

function fmtZar(n: number): string {
  return `R${n.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;
}

const PILL_TONES: Record<string, string> = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "emerald-soft": "border-emerald-100 bg-[#F0FBF5] text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50 text-red-700",
  indigo: "border-[#D7DBFB] bg-[#EEF0FF] text-[#4F46E5]",
  slate: "border-brand-line bg-[#F4F8F5] text-brand-secondary",
  mute: "border-brand-line bg-brand-light text-brand-mute",
};

function Pill({
  children,
  tone = "mute",
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  tone?: string;
  icon?: typeof Users;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${PILL_TONES[tone] ?? PILL_TONES.mute}`}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}

/** "Trial · 14d left" / "Trial ends today" / "Trial ended". */
function trialText(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days > 1) return `Trial · ${days}d left`;
  if (days === 1) return "Trial · 1d left";
  if (days === 0) return "Trial ends today";
  return "Trial ended";
}

function LeadCard({
  lead,
  stageId,
  audience,
  locked,
  canDelete,
  onDeleted,
}: {
  lead: BoardStage["leads"][number];
  stageId: string;
  audience: Audience;
  locked: boolean;
  canDelete: boolean;
  onDeleted: (leadId: string) => void;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { stageId },
    // Customer cards (Trial/Won) are system-managed — not draggable.
    disabled: locked,
  });
  const [bl, bc] = band(lead.score);
  const av = lead.name.trim().slice(0, 2).toUpperCase();
  const [confirming, setConfirming] = useState(false);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      {...(locked ? {} : listeners)}
      {...(locked ? {} : attributes)}
      className={`group relative rounded-2xl border border-brand-line bg-white p-4 shadow-card transition hover:border-[#CDE6D8] hover:shadow-lift ${
        locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      {/* Top-right actions. The card itself only drags — opening the record is an
          explicit click on the eye, so inner links stay clickable and a drag is
          never mistaken for a navigate. */}
      <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-0.5">
        <button
          onPointerDown={stop}
          onClick={(e) => {
            stop(e);
            router.push(`/admin/pipeline/${lead.id}`);
          }}
          className="rounded-lg p-1.5 text-brand-mute transition hover:bg-brand-light hover:text-brand-primary"
          title="Open record"
          aria-label="Open record"
        >
          <Eye className="h-4 w-4" />
        </button>
        {canDelete && !locked ? (
          <button
            onPointerDown={stop}
            onClick={(e) => {
              stop(e);
              setConfirming(true);
            }}
            className="rounded-lg p-1.5 text-brand-mute opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
            title="Delete lead"
            aria-label="Delete lead"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {confirming ? (
        <DeleteLeadDialog
          leadId={lead.id}
          leadName={lead.name}
          leadEmail={lead.email}
          isLead={lead.isLead}
          onClose={() => setConfirming(false)}
          onDeleted={() => {
            setConfirming(false);
            onDeleted(lead.id);
          }}
        />
      ) : null}

      {/* Identity */}
      <div className="flex items-start gap-3 pr-14">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-secondary font-display text-[13px] font-bold text-white">
          {lead.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lead.avatarUrl}
              alt={lead.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            av
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="truncate font-display text-[14px] font-bold leading-tight">
              {lead.name}
            </h4>
            {lead.isLead ? (
              <span
                className="shrink-0 rounded-full border border-brand-line bg-brand-light px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-brand-mute"
                title="Passwordless lead — hasn't claimed an account yet"
              >
                lead
              </span>
            ) : null}
          </div>
          {lead.email ? (
            <a
              href={`mailto:${lead.email}`}
              onPointerDown={stop}
              onClick={stop}
              className="mt-0.5 flex items-center gap-1 text-[11.5px] text-brand-mute transition hover:text-brand-primary hover:underline"
              title={`Email ${lead.email}`}
            >
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{lead.email}</span>
            </a>
          ) : (
            <div className="text-[11.5px] text-brand-mute">—</div>
          )}
          {lead.phone ? (
            <a
              href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
              onPointerDown={stop}
              onClick={stop}
              className="mt-0.5 flex items-center gap-1 text-[11px] text-brand-mute transition hover:text-brand-primary hover:underline"
              title={`Call ${lead.phone}`}
            >
              <Phone className="h-3 w-3 shrink-0" />
              <span className="truncate">{lead.phone}</span>
            </a>
          ) : null}
        </div>
      </div>

      {/* Who they are: property (host) or partner identity (affiliate). */}
      {audience === "host" && (lead.host?.establishment || lead.host?.rooms) ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
          {lead.host?.establishment ? (
            <span className="inline-flex min-w-0 items-center gap-1 font-medium text-brand-secondary">
              <MapPin className="h-3 w-3 shrink-0 text-brand-mute" />
              <span className="truncate">{lead.host.establishment}</span>
            </span>
          ) : null}
          {lead.host?.rooms ? (
            <span className="inline-flex items-center gap-1 text-brand-mute">
              <BedDouble className="h-3 w-3" />
              {lead.host.rooms} rooms
            </span>
          ) : null}
        </div>
      ) : null}

      {audience === "affiliate" && lead.affiliate ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-brand-mute">
          {lead.affiliate.partnerNumber ? (
            <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-brand-secondary">
              #{lead.affiliate.partnerNumber}
            </span>
          ) : null}
          {lead.affiliate.region ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {lead.affiliate.region}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Money & tenure pills */}
      {lead.subscriptionAmount ||
      lead.ltv > 0 ||
      (lead.subscriptionStatus === "trialing" && lead.trialEndsAt) ||
      lead.monthsActive > 0 ||
      lead.paymentsMissed > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {lead.subscriptionAmount ? (
            <Pill
              tone="emerald-soft"
              icon={CreditCard}
              title={`Recurring subscription (${lead.subscriptionInterval === "annual" ? "annual" : "monthly"})`}
            >
              {fmtZar(lead.subscriptionAmount)}/
              {lead.subscriptionInterval === "annual" ? "yr" : "mo"}
            </Pill>
          ) : null}
          {lead.ltv > 0 ? (
            <Pill
              tone="emerald"
              icon={TrendingUp}
              title="Lifetime value — total paid to Wielo"
            >
              LTV {fmtZar(lead.ltv)}
            </Pill>
          ) : null}
          {lead.subscriptionStatus === "trialing" && lead.trialEndsAt ? (
            <Pill tone="amber" icon={Clock} title="Free-trial period">
              {trialText(lead.trialEndsAt)}
            </Pill>
          ) : null}
          {lead.monthsActive > 0 ? (
            <Pill
              tone="slate"
              icon={CalendarClock}
              title="Months as a paying customer"
            >
              {lead.monthsActive} mo active
            </Pill>
          ) : null}
          {lead.paymentsMissed > 0 ? (
            <Pill
              tone="red"
              icon={AlertTriangle}
              title="Failed payments (dunning)"
            >
              {lead.paymentsMissed} missed
            </Pill>
          ) : null}
        </div>
      ) : null}

      {/* Signals: score, risk, relationships */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${bc}`}
        >
          {bl} · <b className="tabular-nums">{lead.score}</b>
        </span>
        {lead.atRisk ? (
          <Pill
            tone="red"
            title="Payment is faltering — reach out before churn"
          >
            ⚠ At risk
          </Pill>
        ) : null}
        {audience === "affiliate" && lead.affiliate ? (
          <Pill
            tone="indigo"
            icon={Users}
            title={`${lead.affiliate.referrals} referred, ${lead.affiliate.convertedHosts} became hosts`}
          >
            {lead.affiliate.referrals} ref
            {lead.affiliate.convertedHosts > 0
              ? ` · ${lead.affiliate.convertedHosts} host${lead.affiliate.convertedHosts === 1 ? "" : "s"}`
              : ""}
          </Pill>
        ) : null}
        {audience === "affiliate" && (lead.affiliate?.earnings ?? 0) > 0 ? (
          <Pill
            tone="emerald"
            icon={TrendingUp}
            title="Commission earned to date"
          >
            {fmtZar(lead.affiliate!.earnings)} earned
          </Pill>
        ) : null}
        {audience === "host" && lead.referredQty > 0 ? (
          <Pill
            tone="indigo"
            icon={Users}
            title="People this host has referred"
          >
            referred {lead.referredQty}
          </Pill>
        ) : null}
        {lead.sourceKind === "competition" ? (
          <Pill tone="amber" title={`Competition: ${lead.sourceLabel ?? "—"}`}>
            🏆 {lead.sourceLabel ?? "Competition"}
          </Pill>
        ) : null}
        {lead.affiliateRef ? (
          <Pill
            tone="indigo"
            icon={Users}
            title="Referred to Wielo by this partner"
          >
            via {lead.affiliateRef}
          </Pill>
        ) : null}
        {lead.suppressed ? (
          <Pill
            tone="mute"
            title="Automated nurture emails are off for this lead"
          >
            auto off
          </Pill>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-brand-line pt-3">
        {lead.ownerInitials ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-mute text-[8px] font-bold text-white">
            {lead.ownerInitials}
          </span>
        ) : (
          <span className="rounded-full border border-brand-line bg-brand-light px-1.5 py-px text-[10px] font-medium text-brand-mute">
            Unassigned
          </span>
        )}
        <span className="flex-1 truncate text-[11.5px] text-brand-mute">
          {sourceLabel(lead.sourceKind)}
        </span>
        <span className="shrink-0 text-[11.5px] tabular-nums text-brand-mute">
          {lead.ageDays}d
        </span>
      </div>
    </div>
  );
}

function sourceLabel(kind: string): string {
  switch (kind) {
    case "host_funnel":
      return "Host funnel";
    case "affiliate_funnel":
      return "Affiliate funnel";
    case "affiliate_referral":
      return "Affiliate referral";
    case "competition":
      return "Competition";
    default:
      return "Direct";
  }
}
