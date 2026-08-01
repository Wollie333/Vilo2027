"use client";

import {
  ArrowLeft,
  CheckCircle2,
  GitBranch,
  Mail,
  MessageSquare,
  PhoneCall,
  Sparkles,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { LeadRecord } from "@/lib/pipeline/queries";

import {
  addLeadNoteAction,
  assignLeadOwnerAction,
  moveLeadStageAction,
  setLeadOutcomeAction,
} from "../../actions";

const TABS = ["Activity", "Details", "Emails", "Tasks", "Files"] as const;
type Tab = (typeof TABS)[number];

function band(score: number): [string, string] {
  if (score >= 70) return ["Hot", "bg-red-50 text-red-700 border-red-200"];
  if (score >= 45)
    return ["Warm", "bg-amber-50 text-amber-700 border-amber-200"];
  return ["Cold", "bg-brand-light text-brand-mute border-brand-line"];
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysSince(iso: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000),
  );
}

const KIND_META: Record<
  string,
  { Icon: typeof Mail; color: string; label: string }
> = {
  created: { Icon: UserPlus, color: "text-brand-mute", label: "Lead created" },
  stage_moved: {
    Icon: GitBranch,
    color: "text-brand-mute",
    label: "Stage moved",
  },
  note: { Icon: MessageSquare, color: "text-[#6366F1]", label: "Note" },
  call_logged: {
    Icon: PhoneCall,
    color: "text-[#0EA5E9]",
    label: "Call logged",
  },
  email_sent: { Icon: Mail, color: "text-brand-primary", label: "Email sent" },
  converted: {
    Icon: Sparkles,
    color: "text-brand-primary",
    label: "Converted",
  },
  consent_changed: {
    Icon: Sparkles,
    color: "text-amber-600",
    label: "Consent",
  },
};

export function LeadRecordClient({
  lead,
  currentStaff,
}: {
  lead: LeadRecord;
  currentStaff: { id: string; name: string };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Activity");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [bl, bc] = band(lead.score);
  const isMine = lead.ownerStaffId === currentStaff.id;
  const currentIdx = lead.stages.findIndex((s) => s.id === lead.stageId);

  function run(fn: () => Promise<unknown>) {
    setErr(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function saveNote(kind: "note" | "call_logged") {
    const body = note.trim();
    if (!body) return;
    run(async () => {
      await addLeadNoteAction({ leadId: lead.id, body, kind });
      setNote("");
    });
  }

  return (
    <div className="min-h-full bg-[#FBFDFC]">
      {/* Header */}
      <div className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-[1440px] px-4 pb-5 pt-4 lg:px-8">
          <a
            href={`/admin/pipeline?audience=${lead.audience}`}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-mute hover:text-brand-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Pipeline
          </a>

          <div className="mt-4 flex flex-wrap items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-accent font-display text-[17px] font-bold text-brand-secondary">
              {lead.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.01em]">
                  {lead.name}
                </h1>
                <Tag className={bc}>
                  {bl} · {lead.score}
                </Tag>
                {lead.sourceKind === "affiliate_referral" ? (
                  <Tag className="border-[#D7DBFB] bg-[#EEF0FF] text-[#4F46E5]">
                    Affiliate referral
                  </Tag>
                ) : null}
                {lead.status !== "open" ? (
                  <Tag
                    className={
                      lead.status === "won"
                        ? "border-brand-line bg-brand-light text-brand-secondary"
                        : "border-brand-line bg-[#F7F8F8] text-brand-mute"
                    }
                  >
                    {lead.status === "won" ? "Won" : "Lost"}
                  </Tag>
                ) : null}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-brand-mute">
                <span className="font-mono">{lead.ref}</span>
                {lead.establishment ? (
                  <>
                    <span className="opacity-40">·</span>
                    <span>{lead.establishment}</span>
                  </>
                ) : null}
                <span className="opacity-40">·</span>
                <span>created {fmt(lead.createdAt)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <select
                value={lead.stageId}
                disabled={pending}
                onChange={(e) =>
                  run(() =>
                    moveLeadStageAction({
                      leadId: lead.id,
                      stageId: e.target.value,
                    }),
                  )
                }
                className="h-10 rounded-[10px] border border-brand-line bg-white px-3 text-[13px] font-medium outline-none focus:border-brand-primary"
              >
                {lead.stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                disabled={pending}
                onClick={() =>
                  run(() =>
                    assignLeadOwnerAction({
                      leadId: lead.id,
                      ownerStaffId: isMine ? null : currentStaff.id,
                    }),
                  )
                }
                className="h-10 rounded-[10px] border border-brand-line bg-white px-3 text-[13px] font-medium text-brand-secondary transition hover:bg-brand-light"
              >
                {isMine ? "Unassign" : "Assign to me"}
              </button>
              <button
                disabled={pending || lead.status === "won"}
                onClick={() =>
                  run(() =>
                    setLeadOutcomeAction({ leadId: lead.id, outcome: "won" }),
                  )
                }
                className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-brand-primary px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark won
              </button>
              <button
                disabled={pending || lead.status === "lost"}
                onClick={() =>
                  run(() =>
                    setLeadOutcomeAction({ leadId: lead.id, outcome: "lost" }),
                  )
                }
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 text-[13px] font-medium text-red-600 transition hover:bg-red-50"
              >
                <XCircle className="h-4 w-4" />
                Lost
              </button>
            </div>
          </div>

          {/* Stage track */}
          <div className="mt-5 flex items-stretch gap-1">
            {lead.stages.map((s, i) => {
              const done = i < currentIdx;
              const on = i === currentIdx;
              return (
                <div key={s.id} className="min-w-0 flex-1">
                  <div
                    className={`h-[5px] rounded-full ${
                      on
                        ? "bg-brand-primary"
                        : done
                          ? "bg-[#A7E8CB]"
                          : s.isLost
                            ? "bg-[#F3D9D9]"
                            : "bg-[#E9F1EC]"
                    }`}
                  />
                  <div
                    className={`mt-1.5 truncate text-[11.5px] font-semibold ${
                      on ? "text-brand-secondary" : "text-brand-mute"
                    }`}
                  >
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Facts */}
          <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-[14px] border border-brand-line bg-white sm:grid-cols-3 lg:grid-cols-6">
            <Fact k="Lead score" v={`${lead.score}`} />
            <Fact k="Source" v={sourceLabel(lead.sourceKind)} />
            <Fact k="Referred by" v={lead.affiliateRef ?? "—"} />
            <Fact k="In pipeline" v={`${daysSince(lead.createdAt)} days`} />
            <Fact k="Rooms" v={lead.rooms ?? "—"} />
            <Fact
              k="Consent"
              v={lead.marketingConsent ? "Subscribed" : "Not given"}
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto grid max-w-[1440px] items-start gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_312px] lg:px-8">
        <div className="min-w-0">
          {/* Tabs */}
          <div className="flex gap-5 overflow-x-auto border-b border-brand-line">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`whitespace-nowrap border-b-2 pb-3 pt-2.5 text-[13.5px] font-semibold transition ${
                  tab === t
                    ? "border-brand-primary text-brand-secondary"
                    : "border-transparent text-brand-mute hover:text-brand-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {err ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {err}
            </div>
          ) : null}

          {tab === "Activity" ? (
            <div className="pt-5">
              {/* Composer */}
              <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Add a note… (visible to the team)"
                  className="w-full resize-y rounded-xl border border-brand-line px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10"
                />
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button
                    disabled={pending || !note.trim()}
                    onClick={() => saveNote("note")}
                    className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-brand-primary px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Save note
                  </button>
                  <button
                    disabled={pending || !note.trim()}
                    onClick={() => saveNote("call_logged")}
                    className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 text-[13px] font-medium text-brand-secondary transition hover:bg-brand-light disabled:opacity-50"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Log a call
                  </button>
                </div>
              </div>

              {/* Timeline */}
              <div className="relative mt-5 pl-8">
                <div className="absolute bottom-2 left-[11px] top-1.5 w-px bg-brand-line" />
                {lead.activities.map((a) => {
                  const m = KIND_META[a.kind] ?? KIND_META.note;
                  return (
                    <div key={a.id} className="relative pb-[18px]">
                      <span className="absolute -left-8 flex h-6 w-6 items-center justify-center rounded-full border border-brand-line bg-white">
                        <m.Icon className={`h-3.5 w-3.5 ${m.color}`} />
                      </span>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-[13.5px] font-semibold">
                          {a.body || m.label}
                        </span>
                        <span className="text-[11.5px] text-brand-mute">
                          {a.staffName ?? "System"} · {fmt(a.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {tab === "Details" ? (
            <div className="grid gap-4 pt-5">
              <DetailCard title="Contact">
                <Row k="Email" v={lead.email ?? "—"} />
                <Row k="Phone" v={lead.phone ?? "—"} />
                <Row k="Establishment" v={lead.establishment ?? "—"} />
                <Row k="Rooms" v={lead.rooms ?? "—"} />
              </DetailCard>
              <DetailCard title="Attribution & consent">
                <Row k="Source" v={sourceLabel(lead.sourceKind)} />
                <Row k="Ad source" v={lead.adSource ?? "—"} />
                <Row
                  k="UTM"
                  v={
                    Object.keys(lead.utm).length
                      ? Object.entries(lead.utm)
                          .map(([k, v]) => `${k}=${String(v)}`)
                          .join(" · ")
                      : "—"
                  }
                  mono
                />
                <Row k="Referred by" v={lead.affiliateRef ?? "—"} />
                <Row
                  k="Marketing consent"
                  v={
                    lead.marketingConsent ? "Given · POPIA logged" : "Not given"
                  }
                />
              </DetailCard>
            </div>
          ) : null}

          {tab === "Emails" || tab === "Tasks" || tab === "Files" ? (
            <ComingSoon what={tab} />
          ) : null}
        </div>

        {/* Rail */}
        <aside className="grid gap-3">
          <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
            <div className="text-[10px] font-bold uppercase tracking-wide text-brand-mute">
              Lead score
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-[30px] font-extrabold tabular-nums">
                {lead.score}
              </span>
              <Tag className={bc}>{bl}</Tag>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-line">
              <div
                className="h-full bg-brand-primary"
                style={{ width: `${Math.min(100, lead.score)}%` }}
              />
            </div>
          </div>
          <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
            <div className="text-[10px] font-bold uppercase tracking-wide text-brand-mute">
              Timing
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <div className="font-display text-[19px] font-extrabold tabular-nums">
                  {daysSince(lead.createdAt)}d
                </div>
                <div className="text-[11.5px] text-brand-mute">in pipeline</div>
              </div>
              <div>
                <div className="font-display text-[19px] font-extrabold tabular-nums">
                  {lead.lastActivityAt ? daysSince(lead.lastActivityAt) : 0}d
                </div>
                <div className="text-[11.5px] text-brand-mute">
                  since last touch
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
            <div className="text-[10px] font-bold uppercase tracking-wide text-brand-mute">
              Owner
            </div>
            <div className="mt-1.5 text-[13.5px] font-semibold">
              {lead.ownerName ?? "Unassigned"}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Tag({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-l border-brand-line px-3.5 py-2.5 first:border-l-0">
      <div className="text-[10px] font-bold uppercase tracking-wide text-brand-mute">
        {k}
      </div>
      <div className="mt-0.5 truncate text-[13.5px] font-semibold">{v}</div>
    </div>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white shadow-card">
      <div className="border-b border-brand-line px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-brand-mute">
        {title}
      </div>
      <div className="divide-y divide-brand-line">{children}</div>
    </div>
  );
}

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="w-32 shrink-0 text-[11.5px] text-brand-mute">{k}</span>
      <span
        className={`min-w-0 flex-1 truncate text-[13.5px] ${mono ? "font-mono text-[12px] text-brand-mute" : ""}`}
      >
        {v}
      </span>
    </div>
  );
}

function ComingSoon({ what }: { what: string }) {
  return (
    <div className="mt-5 rounded-card border border-dashed border-brand-line bg-white px-6 py-14 text-center">
      <p className="font-display text-[15px] font-bold">{what} — coming soon</p>
      <p className="mt-1 text-[13px] text-brand-mute">
        This tab is on the roadmap; the schema for it isn&apos;t built yet.
      </p>
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
