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
import { Inbox, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import type { BoardStage } from "@/lib/pipeline/queries";

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
}: {
  stages: BoardStage[];
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
            <Column key={s.id} stage={s} total={total} onDeleted={removeLead} />
          ))}
        </div>
      </div>
    </DndContext>
  );
}

function Column({
  stage,
  total,
  onDeleted,
}: {
  stage: BoardStage;
  total: number;
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
          ) : null}
          <h3
            className={`font-display text-[13px] font-bold ${
              stage.isWon
                ? "text-brand-secondary"
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
            className={`h-full rounded-full ${stage.isWon ? "bg-brand-primary" : "bg-[#A7E8CB]"}`}
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
              locked={stage.isCustomer}
              onDeleted={onDeleted}
            />
          ))
        )}
      </div>
    </section>
  );
}

function LeadCard({
  lead,
  stageId,
  locked,
  onDeleted,
}: {
  lead: BoardStage["leads"][number];
  stageId: string;
  locked: boolean;
  onDeleted: (leadId: string) => void;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { stageId },
  });
  const [bl, bc] = band(lead.score);
  const av = lead.name.trim().slice(0, 2).toUpperCase();
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => router.push(`/admin/pipeline/${lead.id}`)}
      className={`group relative cursor-grab rounded-2xl border border-brand-line bg-white p-3 shadow-card transition hover:border-[#CDE6D8] hover:shadow-lift ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      {/* Delete — kept out of the drag/navigate path via stopPropagation.
          Hidden on customer cards (Trial/Won): they're locked (server enforces). */}
      {locked ? null : (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
          className="absolute right-2 top-2 z-10 rounded-lg p-1.5 text-brand-mute opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
          title="Delete lead"
          aria-label="Delete lead"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

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

      <div className="flex items-start gap-2.5 pr-6">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-secondary font-display text-[11px] font-bold text-white">
          {av}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-display text-[13.5px] font-bold leading-tight">
            {lead.name}
          </h4>
          <div className="truncate text-[11.5px] text-brand-mute">
            {lead.email ?? "—"}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {lead.valueKind ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums ${
              lead.valueKind === "paid"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
            title={
              lead.valueKind === "paid"
                ? "Wielo revenue from this customer"
                : "Expected value of their live trial"
            }
          >
            R{lead.value.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}
            {lead.valueKind === "trial" ? (
              <span className="font-medium opacity-70">trial</span>
            ) : null}
          </span>
        ) : null}
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${bc}`}
        >
          {bl} · <b className="tabular-nums">{lead.score}</b>
        </span>
        {lead.sourceKind === "affiliate_referral" && lead.affiliateRef ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#D7DBFB] bg-[#EEF0FF] px-2 py-0.5 text-[11px] font-medium text-[#4F46E5]">
            <Users className="h-3 w-3" />
            via {lead.affiliateRef}
          </span>
        ) : null}
        {lead.suppressed ? (
          <span className="rounded-full border border-brand-line bg-brand-light px-2 py-0.5 text-[11px] font-medium text-brand-mute">
            auto off
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center gap-2 border-t border-brand-line pt-2.5">
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
