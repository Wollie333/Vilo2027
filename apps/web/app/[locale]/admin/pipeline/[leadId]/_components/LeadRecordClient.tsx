"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  FileText,
  GitBranch,
  Mail,
  MessageSquare,
  PhoneCall,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import type { LeadFile, LeadRecord, LeadTask } from "@/lib/pipeline/queries";

import { DeleteLeadDialog } from "../../_components/DeleteLeadDialog";
import {
  addLeadNoteAction,
  addLeadTaskAction,
  assignLeadOwnerAction,
  confirmLeadFileAction,
  createLeadFileUploadAction,
  deleteLeadFileAction,
  deleteLeadTaskAction,
  moveLeadStageAction,
  sendLeadEmailAction,
  setLeadOutcomeAction,
  toggleLeadTaskAction,
} from "../../actions";

const TABS = ["Activity", "Details", "Emails", "Tasks", "Files"] as const;
type Tab = (typeof TABS)[number];

const UTM_FIELDS = [
  { key: "utm_source", label: "Source" },
  { key: "utm_medium", label: "Medium" },
  { key: "utm_campaign", label: "Campaign" },
  { key: "utm_content", label: "Content" },
  { key: "utm_term", label: "Term" },
] as const;

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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtBytes(n: number | null): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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
  tasks,
  files,
  currentStaff,
}: {
  lead: LeadRecord;
  tasks: LeadTask[];
  files: LeadFile[];
  currentStaff: { id: string; name: string };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Activity");
  const [note, setNote] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const emailHistory = lead.activities.filter((a) => a.kind === "email_sent");
  const openTasks = tasks.filter((t) => t.status === "open");
  const doneTasks = tasks.filter((t) => t.status === "done");

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

  function sendEmail() {
    const subject = emailSubject.trim();
    const body = emailBody.trim();
    if (!subject || !body) return;
    run(async () => {
      await sendLeadEmailAction({ leadId: lead.id, subject, body });
      setEmailSubject("");
      setEmailBody("");
    });
  }

  function addTask() {
    const title = taskTitle.trim();
    if (!title) return;
    run(async () => {
      await addLeadTaskAction({
        leadId: lead.id,
        title,
        dueAt: taskDue ? new Date(taskDue).toISOString() : null,
      });
      setTaskTitle("");
      setTaskDue("");
    });
  }

  // Direct-to-storage upload: mint a signed URL, PUT the bytes, then record the
  // row. Keeps the file off the server-action body (Vercel's small body cap).
  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const signed = await createLeadFileUploadAction({
        leadId: lead.id,
        name: file.name,
        size: file.size,
      });
      if (!signed.ok) throw new Error(signed.error);
      const put = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error("Upload failed. Please try again.");
      await confirmLeadFileAction({
        leadId: lead.id,
        path: signed.path,
        name: file.name,
        size: file.size,
        mime: file.type || null,
      });
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
                {lead.sourceKind === "competition" ? (
                  <Tag className="border-amber-200 bg-amber-50 text-amber-700">
                    🏆 {lead.sourceLabel ?? "Competition"}
                  </Tag>
                ) : null}
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
                        : lead.status === "churned"
                          ? "border-rose-200 bg-rose-50 text-rose-600"
                          : "border-brand-line bg-[#F7F8F8] text-brand-mute"
                    }
                  >
                    {lead.status === "won"
                      ? "Won"
                      : lead.status === "churned"
                        ? "Churned"
                        : "Lost"}
                  </Tag>
                ) : null}
                {lead.atRisk ? (
                  <Tag
                    className="border-red-200 bg-red-50 text-red-700"
                    title="Payment is faltering — reach out before they churn"
                  >
                    ⚠ At risk
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
              {/* No manual "Mark won": a card wins only when the host pays or
                  the affiliate registers (DB triggers). Keeps Won — and the
                  board's value/conversion KPIs — honest. */}
              <button
                disabled={
                  pending || lead.status === "lost" || lead.status === "won"
                }
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
              <button
                disabled={pending}
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-red-200 bg-white px-3 text-[13px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                title="Delete lead"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>

          {confirmingDelete ? (
            <DeleteLeadDialog
              leadId={lead.id}
              leadName={lead.name}
              leadEmail={lead.email}
              isLead={lead.isLead}
              onClose={() => setConfirmingDelete(false)}
              onDeleted={() => {
                setConfirmingDelete(false);
                // The lead no longer exists — leave the record and go to the board.
                router.push(`/admin/pipeline?audience=${lead.audience}`);
              }}
            />
          ) : null}

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

      {/* Lifecycle callout: at-risk (about to churn) or churned (has left).
          Churned wins — an at-risk card that tips over becomes churned. */}
      {lead.status === "churned" || lead.atRisk ? (
        <div className="mx-auto max-w-[1440px] px-4 pt-5 lg:px-8">
          {lead.status === "churned" ? (
            <div className="flex items-start gap-3 rounded-card border border-rose-200 bg-rose-50 px-4 py-3">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
              <div className="text-[13px] text-rose-700">
                <span className="font-semibold">Churned.</span> This customer
                cancelled or lapsed after paying. They can still be re-engaged —
                move the card back into the pipeline to start a win-back.
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-card border border-red-200 bg-red-50 px-4 py-3">
              <PhoneCall className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div className="text-[13px] text-red-700">
                <span className="font-semibold">At risk.</span> Payment is
                faltering (past due or paused). Reach out now — a quick call
                often saves the subscription before it churns.
              </div>
            </div>
          )}
        </div>
      ) : null}

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
            <div className="grid gap-4 pt-5 lg:grid-cols-2">
              <DetailCard title="Contact">
                <Row
                  k="Email"
                  v={lead.email ?? "—"}
                  href={lead.email ? `mailto:${lead.email}` : undefined}
                />
                <Row
                  k="Phone"
                  v={lead.phone ?? "—"}
                  href={
                    lead.phone
                      ? `tel:${lead.phone.replace(/[^\d+]/g, "")}`
                      : undefined
                  }
                />
                {lead.audience === "host" ? (
                  <Row k="Rooms" v={lead.rooms ?? "—"} />
                ) : null}
              </DetailCard>

              <DetailCard title="Lead & account">
                <Row k="Lead ID" v={lead.ref} mono />
                <Row
                  k="Account"
                  v={
                    lead.isLead
                      ? "Guest lead (passwordless)"
                      : "Claimed account"
                  }
                />
                <Row
                  k="Board"
                  v={lead.audience === "host" ? "Hosts" : "Affiliates"}
                />
                <Row k="Funnel" v={lead.funnelName ?? "—"} />
                <Row k="Stage" v={lead.stageLabel ?? "—"} />
                <Row
                  k="Status"
                  v={
                    lead.status === "won"
                      ? "Won"
                      : lead.status === "lost"
                        ? "Lost"
                        : lead.status === "churned"
                          ? "Churned"
                          : lead.atRisk
                            ? "Open · at risk"
                            : "Open"
                  }
                />
              </DetailCard>

              <DetailCard title="Attribution & consent">
                <Row k="Source" v={sourceLabel(lead.sourceKind)} />
                <Row k="Referred by" v={lead.affiliateRef ?? "—"} />
                <Row k="Ad source" v={lead.adSource ?? "—"} />
                <Row
                  k="Marketing consent"
                  v={
                    lead.marketingConsent ? "Given · POPIA logged" : "Not given"
                  }
                />
              </DetailCard>

              <DetailCard title="Campaign / UTM">
                {UTM_FIELDS.map((f) => (
                  <Row
                    key={f.key}
                    k={f.label}
                    v={String(lead.utm[f.key] ?? "—") || "—"}
                    mono
                  />
                ))}
              </DetailCard>

              <DetailCard title="Timeline">
                <Row k="Created" v={fmt(lead.createdAt)} />
                <Row
                  k="Last activity"
                  v={lead.lastActivityAt ? fmt(lead.lastActivityAt) : "—"}
                />
                <Row k="In pipeline" v={`${daysSince(lead.createdAt)} days`} />
              </DetailCard>
            </div>
          ) : null}

          {tab === "Emails" ? (
            <div className="pt-5">
              {/* Composer */}
              <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
                <div className="mb-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-brand-secondary">
                  <Mail className="h-4 w-4 text-brand-primary" />
                  Send an email {lead.email ? `to ${lead.email}` : ""}
                </div>
                {lead.email ? (
                  <>
                    <input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Subject"
                      className="mb-2.5 w-full rounded-xl border border-brand-line px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10"
                    />
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={5}
                      placeholder="Write your message…"
                      className="w-full resize-y rounded-xl border border-brand-line px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10"
                    />
                    <div className="mt-2.5">
                      <button
                        disabled={
                          pending || !emailSubject.trim() || !emailBody.trim()
                        }
                        onClick={sendEmail}
                        className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-brand-primary px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
                      >
                        <Mail className="h-4 w-4" />
                        Send email
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-[13px] text-brand-mute">
                    This lead has no email address on file.
                  </p>
                )}
              </div>

              {/* History */}
              <div className="mt-5">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-brand-mute">
                  Sent to this lead
                </div>
                {emailHistory.length === 0 ? (
                  <p className="rounded-card border border-dashed border-brand-line bg-white px-4 py-8 text-center text-[13px] text-brand-mute">
                    No emails yet — nurture emails and anything you send appear
                    here.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {emailHistory.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-start gap-3 rounded-card border border-brand-line bg-white p-3.5 shadow-card"
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-secondary">
                          <Mail className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-semibold">
                            {(a.meta.subject as string) ||
                              a.body ||
                              "Email sent"}
                          </div>
                          <div className="mt-0.5 text-[11.5px] text-brand-mute">
                            {(a.meta.manual as boolean)
                              ? (a.staffName ?? "Team")
                              : "Automated nurture"}{" "}
                            · {fmt(a.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {tab === "Tasks" ? (
            <div className="pt-5">
              {/* Add task */}
              <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addTask();
                    }}
                    placeholder="Add a follow-up task…"
                    className="min-w-0 flex-1 rounded-xl border border-brand-line px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10"
                  />
                  <input
                    type="date"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    className="rounded-xl border border-brand-line px-3 py-2.5 text-[13.5px] text-brand-mute outline-none focus:border-brand-primary"
                  />
                  <button
                    disabled={pending || !taskTitle.trim()}
                    onClick={addTask}
                    className="inline-flex h-[42px] items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </div>

              {tasks.length === 0 ? (
                <p className="mt-5 rounded-card border border-dashed border-brand-line bg-white px-4 py-10 text-center text-[13px] text-brand-mute">
                  No tasks yet. Add a follow-up so this lead doesn&apos;t go
                  cold.
                </p>
              ) : (
                <div className="mt-5 grid gap-2">
                  {[...openTasks, ...doneTasks].map((t) => {
                    const overdue =
                      t.status === "open" &&
                      t.dueAt != null &&
                      new Date(t.dueAt).getTime() < Date.now();
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 rounded-card border border-brand-line bg-white p-3 shadow-card"
                      >
                        <button
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              toggleLeadTaskAction({
                                leadId: lead.id,
                                taskId: t.id,
                                done: t.status !== "done",
                              }),
                            )
                          }
                          className="shrink-0"
                          title={
                            t.status === "done" ? "Mark not done" : "Mark done"
                          }
                        >
                          {t.status === "done" ? (
                            <CheckCircle2 className="h-5 w-5 text-brand-primary" />
                          ) : (
                            <Circle className="h-5 w-5 text-brand-mute" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-[13.5px] font-semibold ${
                              t.status === "done"
                                ? "text-brand-mute line-through"
                                : ""
                            }`}
                          >
                            {t.title}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-brand-mute">
                            {t.dueAt ? (
                              <span
                                className={
                                  overdue ? "font-semibold text-red-600" : ""
                                }
                              >
                                Due {fmtDate(t.dueAt)}
                                {overdue ? " · overdue" : ""}
                              </span>
                            ) : (
                              <span>No due date</span>
                            )}
                            {t.assigneeName ? (
                              <>
                                <span className="opacity-40">·</span>
                                <span>{t.assigneeName}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <button
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              deleteLeadTaskAction({
                                leadId: lead.id,
                                taskId: t.id,
                              }),
                            )
                          }
                          className="shrink-0 rounded-lg p-1.5 text-brand-mute transition hover:bg-red-50 hover:text-red-600"
                          title="Delete task"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {tab === "Files" ? (
            <div className="pt-5">
              <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={onFilePicked}
                  className="hidden"
                />
                <button
                  disabled={uploading || pending}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-brand-primary px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Uploading…" : "Upload a file"}
                </button>
                <span className="ml-3 text-[11.5px] text-brand-mute">
                  Proposals, contracts, IDs — up to 25 MB. Private to the team.
                </span>
              </div>

              {files.length === 0 ? (
                <p className="mt-5 rounded-card border border-dashed border-brand-line bg-white px-4 py-10 text-center text-[13px] text-brand-mute">
                  No files attached yet.
                </p>
              ) : (
                <div className="mt-5 grid gap-2">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 rounded-card border border-brand-line bg-white p-3 shadow-card"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-secondary">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold">
                          {f.name}
                        </div>
                        <div className="mt-0.5 text-[11.5px] text-brand-mute">
                          {fmtBytes(f.sizeBytes)} · {f.uploaderName ?? "Team"} ·{" "}
                          {fmt(f.createdAt)}
                        </div>
                      </div>
                      {f.downloadUrl ? (
                        <a
                          href={f.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 rounded-lg border border-brand-line px-2.5 py-1.5 text-[12px] font-semibold text-brand-secondary transition hover:bg-brand-light"
                        >
                          Download
                        </a>
                      ) : null}
                      <button
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            deleteLeadFileAction({
                              leadId: lead.id,
                              fileId: f.id,
                            }),
                          )
                        }
                        className="shrink-0 rounded-lg p-1.5 text-brand-mute transition hover:bg-red-50 hover:text-red-600"
                        title="Delete file"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
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

function Row({
  k,
  v,
  mono = false,
  href,
}: {
  k: string;
  v: string;
  mono?: boolean;
  href?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="w-32 shrink-0 text-[11.5px] text-brand-mute">{k}</span>
      {href ? (
        <a
          href={href}
          className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-brand-primary hover:underline"
        >
          {v}
        </a>
      ) : (
        <span
          className={`min-w-0 flex-1 truncate text-[13.5px] ${mono ? "font-mono text-[12px] text-brand-mute" : ""}`}
        >
          {v}
        </span>
      )}
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
