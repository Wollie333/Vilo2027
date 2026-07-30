"use client";

import {
  Activity,
  Bell,
  Mail,
  Megaphone,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import type { MessageConfig } from "@/lib/notifications/admin-config";

import { createBroadcastAction } from "../../broadcasts/actions";
import {
  resetMessageOverrideAction,
  saveMessageOverrideAction,
  toggleMasterAction,
} from "../actions";
import type { DeliveryHealth } from "../health";

type Group = {
  key: string;
  label: string;
  icon: string;
  items: MessageConfig[];
};
type HistoryRow = {
  id: string;
  title: string;
  audience: string;
  severity: string;
  startsAt: string | null;
  endsAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

type Channel = "email" | "push" | "in_app";
type TabKey = "auto" | "send" | "health";

export function CommunicationsHub({
  groups,
  defaults,
  health,
  history,
}: {
  groups: Group[];
  defaults: Record<string, { subject: string }>;
  health: DeliveryHealth;
  history: HistoryRow[];
}) {
  const [tab, setTab] = useState<TabKey>("auto");

  // Flatten to a mutable local map so inline toggles reflect instantly.
  const [byKind, setByKind] = useState<Record<string, MessageConfig>>(() =>
    Object.fromEntries(groups.flatMap((g) => g.items.map((m) => [m.kind, m]))),
  );
  const sentToday = useMemo(
    () => Object.values(byKind).reduce((s, m) => s + m.sent24h, 0),
    [byKind],
  );

  return (
    <div>
      {/* HEADER */}
      <div className="pb-1">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h1 className="font-display text-[24px] font-extrabold leading-none text-brand-ink">
              Communications
            </h1>
            <div className="mt-1.5 text-[12.5px] text-brand-mute">
              Every message Wielo sends — email, push and in-app — in one place.
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 pb-0.5">
            <span className="hidden items-center gap-1.5 rounded-pill bg-[#F4F8F5] px-3.5 py-2 text-[12px] text-brand-mute sm:inline-flex">
              <span className="num font-semibold text-brand-ink">
                {sentToday}
              </span>{" "}
              sent · 24h
            </span>
            <button
              type="button"
              className="btn-pri h-9"
              onClick={() => setTab("send")}
            >
              <Plus className="h-4 w-4" /> New send
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="thin-scroll mt-3 flex items-center gap-7 overflow-x-auto border-b border-brand-line">
          <TabBtn on={tab === "auto"} onClick={() => setTab("auto")}>
            <Zap className="h-[17px] w-[17px]" /> Automated messages
          </TabBtn>
          <TabBtn on={tab === "send"} onClick={() => setTab("send")}>
            <Megaphone className="h-[17px] w-[17px]" /> Send &amp; broadcast
          </TabBtn>
          <TabBtn on={tab === "health"} onClick={() => setTab("health")}>
            <Activity className="h-[17px] w-[17px]" /> Delivery health
            {health.failed24h > 0 ? (
              <span className="pillcnt">{health.failed24h}</span>
            ) : null}
          </TabBtn>
        </div>
      </div>

      <div className="pt-6">
        {tab === "auto" ? (
          <AutomatedTab
            groups={groups}
            byKind={byKind}
            setByKind={setByKind}
            defaults={defaults}
          />
        ) : null}
        {tab === "send" ? <SendTab history={history} /> : null}
        {tab === "health" ? <HealthTab health={health} /> : null}
      </div>
    </div>
  );
}

function TabBtn({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tabbtn ${on ? "on" : ""}`}
    >
      {children}
    </button>
  );
}

// ─── TAB A · Automated messages ────────────────────────────────────────────
function AutomatedTab({
  groups,
  byKind,
  setByKind,
  defaults,
}: {
  groups: Group[];
  byKind: Record<string, MessageConfig>;
  setByKind: React.Dispatch<
    React.SetStateAction<Record<string, MessageConfig>>
  >;
  defaults: Record<string, { subject: string }>;
}) {
  const [q, setQ] = useState("");
  const [fArea, setFArea] = useState("");
  const [fCh, setFCh] = useState("");
  const [fSt, setFSt] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function patchLocal(kind: string, patch: Partial<MessageConfig>) {
    setByKind((prev) => ({ ...prev, [kind]: { ...prev[kind]!, ...patch } }));
  }

  function toggleMaster(kind: string) {
    const next = !byKind[kind]!.masterEnabled;
    patchLocal(kind, { masterEnabled: next });
    startTransition(() => void toggleMasterAction(kind, next));
  }

  function toggleChannel(kind: string, ch: Channel) {
    const m = byKind[kind]!;
    const cur =
      ch === "email"
        ? m.email.enabled
        : ch === "push"
          ? m.push.enabled
          : m.inApp.enabled;
    const email = ch === "email" ? !cur : m.email.enabled;
    const push = ch === "push" ? !cur : m.push.enabled;
    const inApp = ch === "in_app" ? !cur : m.inApp.enabled;
    patchLocal(kind, {
      email: { ...m.email, enabled: email },
      push: { ...m.push, enabled: push },
      inApp: { ...m.inApp, enabled: inApp },
    });
    startTransition(
      () =>
        void saveMessageOverrideAction({
          kind,
          masterEnabled: m.masterEnabled,
          emailEnabled: email,
          pushEnabled: push,
          inAppEnabled: inApp,
          subjectOverride: m.subjectOverride ?? "",
          introOverride: m.introOverride ?? "",
        }),
    );
  }

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items
        .map((m) => byKind[m.kind]!)
        .filter((m) => {
          if (fArea && m.area !== fArea) return false;
          if (
            q &&
            !`${m.label} ${m.description}`
              .toLowerCase()
              .includes(q.toLowerCase())
          )
            return false;
          if (fCh === "email" && !m.email.supported) return false;
          if (fCh === "push" && !m.push.supported) return false;
          if (fCh === "inapp" && !m.inApp.supported) return false;
          const allOn =
            m.masterEnabled &&
            (!m.email.supported || m.email.enabled) &&
            (!m.push.supported || m.push.enabled) &&
            (!m.inApp.supported || m.inApp.enabled);
          if (fSt === "on" && !allOn) return false;
          if (fSt === "off" && m.masterEnabled) return false;
          if (fSt === "partial" && (!m.masterEnabled || allOn)) return false;
          if (fSt === "fail" && m.failed24h === 0) return false;
          if (fSt === "cust" && !m.customised) return false;
          if (fSt === "never" && m.sent24h + m.failed24h > 0) return false;
          return true;
        }),
    }))
    .filter((g) => g.items.length > 0);

  const editingMsg = editing ? byKind[editing]! : null;

  return (
    <>
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            className="fld pl-10"
            placeholder="Search messages…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="fld w-auto min-w-[150px] text-[13px]"
          value={fArea}
          onChange={(e) => setFArea(e.target.value)}
        >
          <option value="">All areas</option>
          {groups.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
        </select>
        <select
          className="fld w-auto text-[13px]"
          value={fCh}
          onChange={(e) => setFCh(e.target.value)}
        >
          <option value="">All channels</option>
          <option value="email">Email</option>
          <option value="push">Push</option>
          <option value="inapp">In-app</option>
        </select>
        <select
          className="fld w-auto text-[13px]"
          value={fSt}
          onChange={(e) => setFSt(e.target.value)}
        >
          <option value="">Any status</option>
          <option value="on">On</option>
          <option value="partial">Partial / off</option>
          <option value="off">Off</option>
          <option value="fail">Has failures</option>
          <option value="cust">Customised</option>
          <option value="never">Never sent</option>
        </select>
      </div>

      {visibleGroups.length === 0 ? (
        <div className="card mt-4 p-10 text-center text-[13px] text-brand-mute">
          No messages match. Try clearing the filters.
        </div>
      ) : (
        visibleGroups.map((g) => {
          const offs = g.items.filter((m) => !m.masterEnabled).length;
          return (
            <div key={g.key}>
              <div className="grouphd">
                <span className="smallcaps">{g.label}</span>
                <span className="num text-[11px] text-[#93A79E]">
                  {g.items.length}
                  {offs ? ` · ${offs} off` : ""}
                </span>
                <div className="h-px flex-1 bg-brand-line" />
              </div>
              <div className="card overflow-hidden">
                {g.items.map((m) => (
                  <MessageRow
                    key={m.kind}
                    m={m}
                    onToggleMaster={() => toggleMaster(m.kind)}
                    onToggleChannel={(ch) => toggleChannel(m.kind, ch)}
                    onEdit={() => setEditing(m.kind)}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

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
    </>
  );
}

function MessageRow({
  m,
  onToggleMaster,
  onToggleChannel,
  onEdit,
}: {
  m: MessageConfig;
  onToggleMaster: () => void;
  onToggleChannel: (ch: Channel) => void;
  onEdit: () => void;
}) {
  return (
    <div className={`mrow ${m.masterEnabled ? "" : "off"}`}>
      <div className="mmain">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mname text-[13.5px] font-semibold text-brand-ink">
            {m.label}
          </span>
          {m.isNew ? <span className="newdot">New</span> : null}
          {m.customised ? <span className="custdot">Customised</span> : null}
        </div>
        <div className="mt-0.5 text-[12px] text-brand-mute">
          {m.description}
        </div>
      </div>
      <div className="mmeta flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5">
          <Chip
            on={m.email.enabled}
            supported={m.email.supported}
            onClick={() => onToggleChannel("email")}
          >
            <Mail className="h-3.5 w-3.5" /> Email
          </Chip>
          <Chip
            on={m.push.enabled}
            supported={m.push.supported}
            onClick={() => onToggleChannel("push")}
          >
            <Smartphone className="h-3.5 w-3.5" /> Push
          </Chip>
          <Chip
            on={m.inApp.enabled}
            supported={m.inApp.supported}
            onClick={() => onToggleChannel("in_app")}
          >
            <Bell className="h-3.5 w-3.5" /> In-app
          </Chip>
        </div>
        <div className="hidden w-[152px] text-right xl:block">
          <Health m={m} />
        </div>
        <button className="iact" title="Edit" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Master on/off"
          className={`tgl ${m.masterEnabled ? "on" : ""}`}
          onClick={onToggleMaster}
        />
      </div>
    </div>
  );
}

function Chip({
  on,
  supported,
  onClick,
  children,
}: {
  on: boolean;
  supported: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  if (!supported) return null;
  return (
    <button type="button" className={`chp ${on ? "on" : ""}`} onClick={onClick}>
      <span className="cd" />
      {children}
    </button>
  );
}

function Health({ m }: { m: MessageConfig }) {
  if (m.sent24h + m.failed24h === 0) {
    return (
      <span className="hstat" style={{ color: "#93A79E" }}>
        never sent
      </span>
    );
  }
  return (
    <span className={`hstat ${m.failed24h ? "bad" : ""}`}>
      sent <b>{m.sent24h}</b> · <b>{m.failed24h}</b> failed{" "}
      <span style={{ color: "#93A79E" }}>(24h)</span>
    </span>
  );
}

function EditDrawer({
  m,
  defaultSubject,
  onClose,
  onSaved,
}: {
  m: MessageConfig;
  defaultSubject: string;
  onClose: () => void;
  onSaved: (patch: Partial<MessageConfig>) => void;
}) {
  const [subject, setSubject] = useState(m.subjectOverride ?? "");
  const [intro, setIntro] = useState(m.introOverride ?? "");
  const [email, setEmail] = useState(m.email.enabled);
  const [push, setPush] = useState(m.push.enabled);
  const [inApp, setInApp] = useState(m.inApp.enabled);
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const previewSubject = subject.trim() || defaultSubject;
  const previewIntro =
    intro.trim() ||
    "The branded default intro for this message shows here until you customise it.";

  function save(reset = false) {
    setError(null);
    startSave(async () => {
      const res = reset
        ? await resetMessageOverrideAction(m.kind)
        : await saveMessageOverrideAction({
            kind: m.kind,
            masterEnabled: m.masterEnabled,
            emailEnabled: email,
            pushEnabled: push,
            inAppEnabled: inApp,
            subjectOverride: subject.trim(),
            introOverride: intro.trim(),
          });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved(
        reset
          ? {
              subjectOverride: null,
              introOverride: null,
              customised: false,
              email: { ...m.email, enabled: m.email.supported },
              push: { ...m.push, enabled: m.push.supported },
              inApp: { ...m.inApp, enabled: m.inApp.supported },
            }
          : {
              subjectOverride: subject.trim() || null,
              introOverride: intro.trim() || null,
              customised: Boolean(subject.trim() || intro.trim()),
              email: { ...m.email, enabled: email },
              push: { ...m.push, enabled: push },
              inApp: { ...m.inApp, enabled: inApp },
            },
      );
      onClose();
    });
  }

  return (
    <>
      <div className="scrim show" onClick={onClose} />
      <aside className="drawer show" aria-label="Edit message">
        <div className="flex shrink-0 items-start gap-3 border-b border-brand-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[16px] font-extrabold text-brand-ink">
                {m.label}
              </h2>
              {m.customised ? (
                <span className="custdot">Customised</span>
              ) : null}
            </div>
            <div className="mt-0.5 text-[12px] text-brand-mute">
              {m.description}
            </div>
          </div>
          <button className="iact shrink-0" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {m.email.supported ? (
              <button
                className={`chp ${email ? "on" : ""}`}
                onClick={() => setEmail((v) => !v)}
              >
                <span className="cd" />
                <Mail className="h-3.5 w-3.5" /> Email
              </button>
            ) : null}
            {m.push.supported ? (
              <button
                className={`chp ${push ? "on" : ""}`}
                onClick={() => setPush((v) => !v)}
              >
                <span className="cd" />
                <Smartphone className="h-3.5 w-3.5" /> Push
              </button>
            ) : null}
            {m.inApp.supported ? (
              <button
                className={`chp ${inApp ? "on" : ""}`}
                onClick={() => setInApp((v) => !v)}
              >
                <span className="cd" />
                <Bell className="h-3.5 w-3.5" /> In-app
              </button>
            ) : null}
            <span className="hstat ml-auto">
              <Health m={m} />
            </span>
          </div>

          {m.email.supported ? (
            <>
              <div className="mt-4">
                <label className="flabel">Subject line</label>
                <input
                  className="fld"
                  value={subject}
                  placeholder={defaultSubject}
                  onChange={(e) => setSubject(e.target.value)}
                />
                <div className="fhelp">
                  Leave blank to use the default. Tokens like{" "}
                  <span className="mono text-[11px]">{"{{firstName}}"}</span>{" "}
                  are filled in per recipient.
                </div>
              </div>
              <div className="mt-4">
                <label className="flabel">Intro paragraph</label>
                <textarea
                  className="fld"
                  rows={3}
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  placeholder="The default branded intro is used when this is blank."
                />
                <div className="fhelp">
                  This is the only body copy you can change — everything below
                  it is the branded frame.
                </div>
              </div>

              <div className="smallcaps mt-5">Preview · Email</div>
              <div className="mailframe mt-2">
                <div className="mailbar">
                  <span className="h-2 w-2 rounded-full bg-[#D6E4DB]" />
                  <span className="h-2 w-2 rounded-full bg-[#D6E4DB]" />
                  <span className="mono ml-1 text-[10.5px] text-brand-mute">
                    {previewSubject}
                  </span>
                </div>
                <div className="grid gap-3 p-4">
                  <div className="lockzone pt-4">
                    <div className="font-display text-[15px] font-extrabold text-brand-ink">
                      Hi there,
                    </div>
                    <div className="text-[10.5px] text-[#93A79E]">
                      A first name is filled in when it&apos;s on file.
                    </div>
                  </div>
                  <div className="editzone pt-4">
                    <div className="text-[12px] leading-relaxed text-[#0B3A2A]">
                      {previewIntro}
                    </div>
                  </div>
                  <div className="lockzone pt-4">
                    <span className="inline-flex h-8 items-center rounded-pill bg-brand-primary px-4 text-[11.5px] font-semibold text-white">
                      View in Wielo
                    </span>
                    <div className="mt-3 border-t border-brand-line pt-2.5 text-[10px] leading-relaxed text-[#93A79E]">
                      Wielo · Cape Town, South Africa ·{" "}
                      <span className="underline">Notification settings</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-[10px] border border-brand-line bg-[#F7FBF8] p-4 text-[12.5px] text-brand-mute">
              This message has no email — it&apos;s push / in-app only. Use the
              channel switches above to control where it goes.
            </div>
          )}

          {error ? (
            <div className="mt-4 text-[12px] font-medium text-[#B91C1C]">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-brand-line px-5 py-3.5">
          <button
            className="btn-ghost h-9"
            onClick={() => save(true)}
            disabled={saving}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset to default
          </button>
          <div className="flex-1" />
          <button className="btn-sec h-9" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn-pri h-9"
            onClick={() => save(false)}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── TAB B · Send & broadcast ──────────────────────────────────────────────
const AUDIENCES = [
  { value: "all", label: "Everyone" },
  { value: "hosts", label: "Hosts" },
  { value: "guests", label: "Guests" },
  { value: "staff", label: "Staff" },
] as const;
const SEVERITIES = ["info", "warning", "critical"] as const;

function SendTab({ history }: { history: HistoryRow[] }) {
  const [audience, setAudience] =
    useState<(typeof AUDIENCES)[number]["value"]>("all");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("info");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [isBanner, setIsBanner] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [sending, startSend] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function send() {
    setMsg(null);
    startSend(async () => {
      const res = await createBroadcastAction({
        severity,
        audience,
        title: title.trim(),
        body: body.trim(),
        link_url: linkUrl.trim() || "",
        link_label: linkLabel.trim() || null,
        starts_at: isBanner && startsAt ? startsAt : null,
        ends_at: isBanner && endsAt ? endsAt : null,
        requires_ack: false,
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Sent." });
        setTitle("");
        setBody("");
        setLinkUrl("");
        setLinkLabel("");
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-5">
        <div className="card p-5">
          <div className="smallcaps">1 · Audience</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {AUDIENCES.map((a) => (
              <button
                key={a.value}
                className={`selrow ${audience === a.value ? "on" : ""}`}
                onClick={() => setAudience(a.value)}
              >
                <span className="rad" />
                <span className="font-semibold">{a.label}</span>
              </button>
            ))}
          </div>
          <div className="fhelp">
            Sends a platform announcement (in-app + push, and email where the
            recipient allows it). For specific people, use the Send-to-users
            tool.
          </div>
        </div>

        <div className="card p-5">
          <div className="smallcaps">2 · Delivery</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              className={`selrow ${!isBanner ? "on" : ""}`}
              onClick={() => setIsBanner(false)}
            >
              <span className="rad" />
              <div className="text-left">
                <div className="font-semibold">One-off message</div>
                <div className="text-[11.5px] text-brand-mute">Sends now</div>
              </div>
            </button>
            <button
              className={`selrow ${isBanner ? "on" : ""}`}
              onClick={() => setIsBanner(true)}
            >
              <span className="rad" />
              <div className="text-left">
                <div className="font-semibold">Standing banner</div>
                <div className="text-[11.5px] text-brand-mute">
                  Shows until it expires
                </div>
              </div>
            </button>
          </div>
          {isBanner ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="flabel">Starts</label>
                <input
                  type="datetime-local"
                  className="fld"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div>
                <label className="flabel">Ends</label>
                <input
                  type="datetime-local"
                  className="fld"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="card p-5">
          <div className="smallcaps">3 · Content</div>
          <div className="mt-3 grid gap-3">
            <div>
              <label className="flabel">Title</label>
              <input
                className="fld"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's happening"
              />
            </div>
            <div>
              <label className="flabel">Body</label>
              <textarea
                className="fld"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="The message…"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="flabel">
                  Link label{" "}
                  <span className="font-normal text-brand-mute">optional</span>
                </label>
                <input
                  className="fld"
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                />
              </div>
              <div>
                <label className="flabel">Link URL</label>
                <input
                  className="fld mono text-[12px]"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            </div>
            <div>
              <label className="flabel">Severity</label>
              <div className="seg mt-0.5">
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    className={severity === s ? "on" : ""}
                    onClick={() => setSeverity(s)}
                  >
                    {s[0]!.toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-brand-line pt-4">
            <button
              className="btn-pri"
              onClick={send}
              disabled={
                sending || title.trim().length < 3 || body.trim().length < 10
              }
            >
              <Megaphone className="h-4 w-4" /> {sending ? "Sending…" : "Send"}
            </button>
            {msg ? (
              <span
                className={`text-[12.5px] font-medium ${msg.ok ? "text-brand-primary" : "text-[#B91C1C]"}`}
              >
                {msg.text}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-brand-line px-5 py-3.5">
          <span className="smallcaps">Recent sends</span>
        </div>
        <div className="thin-scroll overflow-x-auto">
          <table className="ttable" style={{ minWidth: 280 }}>
            <thead>
              <tr>
                <th>Message</th>
                <th>Audience</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-brand-mute">
                    No sends yet.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id}>
                    <td className="font-semibold text-brand-ink">
                      {h.title}
                      {h.cancelledAt ? (
                        <span className="ml-1 text-[11px] text-brand-mute">
                          (cancelled)
                        </span>
                      ) : null}
                    </td>
                    <td className="capitalize text-brand-mute">{h.audience}</td>
                    <td className="num text-brand-mute">
                      {new Date(h.createdAt).toLocaleDateString("en-ZA", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── TAB C · Delivery health ───────────────────────────────────────────────
function HealthTab({ health }: { health: DeliveryHealth }) {
  const total =
    health.byChannel.email + health.byChannel.push + health.byChannel.inApp;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return (
    <div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line sm:grid-cols-4">
        <Stat label="Sent · 24h" value={health.sent24h} />
        <Stat
          label="Failed · 24h"
          value={health.failed24h}
          danger={health.failed24h > 0}
          sub={`${Math.round(health.failureRate * 100)}% failure rate`}
        />
        <Stat label="Queue depth" value={health.queueDepth} />
        <Stat label="Channels · 24h" value={total} />
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card overflow-hidden">
          <div className="border-b border-brand-line px-5 py-3.5">
            <span className="smallcaps">Failure log (24h)</span>
          </div>
          <div className="thin-scroll overflow-x-auto">
            <table className="ttable" style={{ minWidth: 420 }}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Message</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {health.failures.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-8 text-center text-brand-mute"
                    >
                      No failures in the last 24 hours. 🎉
                    </td>
                  </tr>
                ) : (
                  health.failures.map((f, i) => (
                    <tr key={i}>
                      <td className="num text-brand-mute">
                        {new Date(f.when).toLocaleTimeString("en-ZA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="font-semibold text-brand-ink">{f.type}</td>
                      <td className="text-[#B91C1C]">{f.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-4">
          <div className="smallcaps mb-3">Volume by channel · 24h</div>
          <div className="grid gap-3">
            <Bar
              label="Email"
              value={health.byChannel.email}
              pct={pct(health.byChannel.email)}
            />
            <Bar
              label="Push"
              value={health.byChannel.push}
              pct={pct(health.byChannel.push)}
            />
            <Bar
              label="In-app"
              value={health.byChannel.inApp}
              pct={pct(health.byChannel.inApp)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  danger,
}: {
  label: string;
  value: number;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <div className="bg-white p-4">
      <div className="smallcaps">{label}</div>
      <div
        className={`num mt-1.5 font-display text-[22px] font-bold leading-none ${danger ? "text-[#B91C1C]" : "text-brand-ink"}`}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-1 text-[11px] text-brand-mute">{sub}</div>
      ) : null}
    </div>
  );
}

function Bar({
  label,
  value,
  pct,
}: {
  label: string;
  value: number;
  pct: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-semibold text-brand-ink">{label}</span>
        <span className="num text-brand-mute">{value}</span>
      </div>
      <div className="pbar mt-1.5">
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
