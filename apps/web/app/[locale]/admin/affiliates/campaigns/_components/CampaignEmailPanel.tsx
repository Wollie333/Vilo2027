"use client";

import { CalendarClock, Check, Flag, Rocket, TrendingUp } from "lucide-react";
import { useState, useTransition } from "react";

import type { CampaignEmailSchedule } from "@/lib/affiliate/emailSchedule";
import { WEEKDAY_LABELS } from "@/lib/affiliate/emailSchedule";
import type { MessageConfig } from "@/lib/notifications/admin-config";

import { saveCampaignEmailScheduleAction } from "../actions";
import {
  EditDrawer,
  EmailPreviewModal,
  MessageCard,
  useMessageToggles,
} from "../../../communications/_components/messageManagement";

// P5 — a competition's Email tab: the same notification_overrides store as the
// global Communications hub, scoped to this competition's messages. Event emails
// fire on something happening; the scheduled sequence fires on a clock (its
// cadence is per-campaign, saved on affiliate_campaigns.email_schedule).

const EVENT_ORDER = [
  "campaign_partner_enrolled",
  "campaign_referral_activated",
  "campaign_milestone_hit",
  "affiliate_commission_earned",
  "affiliate_payout_paid",
  "campaign_pause_changed",
  "affiliate_campaign_won",
];
const SCHEDULED_ORDER = [
  "campaign_kickoff",
  "campaign_standings_digest",
  "campaign_ending_soon",
];

export function CampaignEmailPanel({
  campaignId,
  configs,
  defaults,
  schedule,
}: {
  campaignId: string;
  configs: MessageConfig[];
  defaults: Record<string, { subject: string }>;
  schedule: CampaignEmailSchedule;
}) {
  const [byKind, setByKind] = useState<Record<string, MessageConfig>>(() =>
    Object.fromEntries(configs.map((m) => [m.kind, m])),
  );
  const { patchLocal, toggleMaster, toggleChannel } = useMessageToggles(
    byKind,
    setByKind,
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);

  const editingMsg = editing ? byKind[editing] : null;
  const previewMsg = previewing ? byKind[previewing] : null;

  function renderCard(kind: string) {
    const m = byKind[kind];
    if (!m) return null;
    return (
      <MessageCard
        key={m.kind}
        m={m}
        onToggleMaster={() => toggleMaster(m.kind)}
        onToggleChannel={(ch) => toggleChannel(m.kind, ch)}
        onEdit={() => setEditing(m.kind)}
        onPreview={() => setPreviewing(m.kind)}
      />
    );
  }

  const events = EVENT_ORDER.filter((k) => byKind[k]);
  const scheduled = SCHEDULED_ORDER.filter((k) => byKind[k]);

  return (
    <div className="space-y-6">
      <div>
        <div className="smallcaps">Competition emails</div>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-brand-mute">
          The same message controls as the global Communications hub, scoped to
          this competition. Toggling a channel or editing the copy here changes
          the one message everywhere — there is no second version.
        </p>
      </div>

      <SequenceTimeline schedule={schedule} />

      {/* EVENT EMAILS */}
      <section>
        <div className="grouphd">
          <span className="smallcaps">Event emails</span>
          <span className="num text-[11px] text-[#93A79E]">
            fire on something happening
          </span>
          <div className="h-px flex-1 bg-brand-line" />
        </div>
        {events.length === 0 ? (
          <EmptyRow />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {events.map(renderCard)}
          </div>
        )}
      </section>

      {/* SCHEDULED SEQUENCE */}
      <section>
        <div className="grouphd">
          <span className="smallcaps">Scheduled sequence</span>
          <span className="num text-[11px] text-[#93A79E]">
            fire on a clock
          </span>
          <div className="h-px flex-1 bg-brand-line" />
        </div>
        {scheduled.length === 0 ? (
          <EmptyRow />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {scheduled.map(renderCard)}
          </div>
        )}
        <ScheduleControls campaignId={campaignId} initial={schedule} />
      </section>

      {editingMsg ? (
        <EditDrawer
          m={editingMsg}
          defaultSubject={
            defaults[editingMsg.kind]?.subject ?? editingMsg.label
          }
          onClose={() => setEditing(null)}
          onSaved={(patch) => patchLocal(editingMsg.kind, patch)}
        />
      ) : null}
      {previewMsg ? (
        <EmailPreviewModal m={previewMsg} onClose={() => setPreviewing(null)} />
      ) : null}
    </div>
  );
}

function EmptyRow() {
  return (
    <div className="card p-8 text-center text-[12.5px] text-brand-mute">
      No messages in this group.
    </div>
  );
}

// ─── Sequence timeline ─────────────────────────────────────────────────────
function SequenceTimeline({ schedule }: { schedule: CampaignEmailSchedule }) {
  const cad = schedule.standingsDigest;
  const digestWhen =
    cad.cadence === "monthly"
      ? "Monthly"
      : `${cad.cadence === "biweekly" ? "Every 2 wks" : "Weekly"} · ${(
          WEEKDAY_LABELS[cad.weekday] ?? "Monday"
        ).slice(0, 3)}`;
  const steps = [
    { icon: Rocket, label: "Kickoff", when: "At go-live" },
    { icon: TrendingUp, label: "Standings digest", when: digestWhen },
    {
      icon: CalendarClock,
      label: "Ending soon",
      when: `${schedule.endingSoon.leadDays}d before`,
    },
    { icon: Flag, label: "Results", when: "At close" },
  ];
  return (
    <div className="card p-4">
      <div className="smallcaps mb-3">The sequence at a glance</div>
      <ol className="flex items-stretch gap-2 overflow-x-auto">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <li
              key={s.label}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <div className="min-w-[120px] flex-1 rounded-[12px] border border-brand-line bg-[#FAFCFB] p-3">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-brand-primary" />
                  <span className="truncate text-[12.5px] font-semibold text-brand-ink">
                    {s.label}
                  </span>
                </div>
                <div className="num mt-1 text-[11px] text-brand-mute">
                  {s.when}
                </div>
              </div>
              {i < steps.length - 1 ? (
                <span className="hidden shrink-0 text-brand-line sm:block">
                  →
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Cadence controls ──────────────────────────────────────────────────────
function ScheduleControls({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: CampaignEmailSchedule;
}) {
  const [cadence, setCadence] = useState(initial.standingsDigest.cadence);
  const [weekday, setWeekday] = useState(initial.standingsDigest.weekday);
  const [leadDays, setLeadDays] = useState(initial.endingSoon.leadDays);
  const [baseline, setBaseline] = useState(initial);
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty =
    cadence !== baseline.standingsDigest.cadence ||
    weekday !== baseline.standingsDigest.weekday ||
    leadDays !== baseline.endingSoon.leadDays;

  function save() {
    setMsg(null);
    const schedule: CampaignEmailSchedule = {
      standingsDigest: { cadence, weekday },
      endingSoon: { leadDays },
    };
    startSave(async () => {
      const res = await saveCampaignEmailScheduleAction({
        campaignId,
        schedule,
        reason: "Campaign email cadence",
      });
      if (res.ok) {
        setBaseline(schedule);
        setMsg({ ok: true, text: "Saved." });
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="card mt-3 p-4">
      <div className="flex items-center gap-1.5">
        <CalendarClock className="h-3.5 w-3.5 text-brand-mute" />
        <span className="smallcaps">Timing</span>
      </div>
      <p className="mt-1 text-[11.5px] text-brand-mute">
        When the two clock-driven emails go out while the competition runs.
        Kickoff sends once, at go-live.
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="flabel">Standings digest — how often</label>
          <div className="flex flex-wrap gap-2">
            <select
              className="fld w-auto min-w-[130px] text-[13px]"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as typeof cadence)}
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>
            {cadence !== "monthly" ? (
              <select
                className="fld w-auto min-w-[120px] text-[13px]"
                value={weekday}
                onChange={(e) => setWeekday(Number(e.target.value))}
              >
                {WEEKDAY_LABELS.map((label, idx) => (
                  <option key={label} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="self-center text-[12px] text-brand-mute">
                on the 1st
              </span>
            )}
          </div>
        </div>
        <div>
          <label className="flabel">Ending soon — lead time</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={90}
              className="fld w-[90px] text-[13px]"
              value={leadDays}
              onChange={(e) =>
                setLeadDays(
                  Math.max(1, Math.min(90, Number(e.target.value) || 1)),
                )
              }
            />
            <span className="text-[12px] text-brand-mute">
              days before the close date
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-brand-line pt-3">
        <button
          className="btn-pri h-9"
          onClick={save}
          disabled={saving || !dirty}
        >
          <Check className="h-4 w-4" /> {saving ? "Saving…" : "Save timing"}
        </button>
        {msg ? (
          <span
            className={`text-[12.5px] font-medium ${
              msg.ok ? "text-brand-primary" : "text-[#B91C1C]"
            }`}
          >
            {msg.text}
          </span>
        ) : dirty ? (
          <span className="text-[12px] text-brand-mute">Unsaved changes</span>
        ) : null}
      </div>
    </div>
  );
}
