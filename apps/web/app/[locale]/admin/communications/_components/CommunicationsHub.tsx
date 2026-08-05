"use client";

import { Activity, Megaphone, Plus, Search, Zap } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Link } from "@/i18n/navigation";

import type { MessageConfig } from "@/lib/notifications/admin-config";

import { createBroadcastAction } from "../../broadcasts/actions";
import type { DeliveryHealth } from "../health";
import {
  SegRow,
  SelectField,
  TextArea,
  TextField,
  ToggleField,
} from "./fields";
import {
  EditDrawer,
  EmailPreviewModal,
  MessageCard,
  useMessageToggles,
} from "./messageManagement";

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
            {tab !== "send" ? (
              <button
                type="button"
                className="btn-pri h-9"
                onClick={() => setTab("send")}
              >
                <Plus className="h-4 w-4" /> New send
              </button>
            ) : null}
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
  const [previewing, setPreviewing] = useState<string | null>(null);
  const { patchLocal, toggleMaster, toggleChannel } = useMessageToggles(
    byKind,
    setByKind,
  );

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
  const previewMsg = previewing ? byKind[previewing]! : null;

  const shownCount = visibleGroups.reduce((n, g) => n + g.items.length, 0);
  const totalCount = groups.reduce((n, g) => n + g.items.length, 0);
  const filtersActive = Boolean(q || fArea || fCh || fSt);
  function clearFilters() {
    setQ("");
    setFArea("");
    setFCh("");
    setFSt("");
  }

  return (
    <>
      <div className="card flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
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

        {/* Area quick-filter chips — one click to jump to a category. */}
        <div className="thin-scroll flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={`fchip ${fArea === "" ? "active" : ""}`}
            onClick={() => setFArea("")}
          >
            All
            <span className="fcnt">{totalCount}</span>
          </button>
          {groups.map((g) => (
            <button
              key={g.key}
              type="button"
              className={`fchip ${fArea === g.key ? "active" : ""}`}
              onClick={() => setFArea(g.key)}
            >
              {g.label}
              <span className="fcnt">{g.items.length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 px-1 text-[12px] text-brand-mute">
        <span className="num">
          Showing {shownCount} of {totalCount}
        </span>
        {filtersActive ? (
          <button
            type="button"
            onClick={clearFilters}
            className="font-semibold text-brand-primary hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {visibleGroups.length === 0 ? (
        <div className="card mt-3 p-10 text-center text-[13px] text-brand-mute">
          No messages match. Try clearing the filters.
        </div>
      ) : (
        visibleGroups.map((g) => {
          const offs = g.items.filter((m) => !m.masterEnabled).length;
          return (
            <div key={g.key} className="mb-2">
              <div className="grouphd">
                <span className="smallcaps">{g.label}</span>
                <span className="num text-[11px] text-[#93A79E]">
                  {g.items.length}
                  {offs ? ` · ${offs} off` : ""}
                </span>
                <div className="h-px flex-1 bg-brand-line" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((m) => (
                  <MessageCard
                    key={m.kind}
                    m={m}
                    onToggleMaster={() => toggleMaster(m.kind)}
                    onToggleChannel={(ch) => toggleChannel(m.kind, ch)}
                    onEdit={() => setEditing(m.kind)}
                    onPreview={() => setPreviewing(m.kind)}
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

      {previewMsg ? (
        <EmailPreviewModal m={previewMsg} onClose={() => setPreviewing(null)} />
      ) : null}
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
  const [surfaces, setSurfaces] = useState<("dashboard" | "public")[]>([
    "dashboard",
  ]);
  const [dismissMode, setDismissMode] = useState<
    "dismissible" | "acknowledge" | "persistent"
  >("dismissible");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [sending, startSend] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function toggleSurface(surface: "dashboard" | "public") {
    setSurfaces((prev) =>
      prev.includes(surface)
        ? prev.filter((s) => s !== surface)
        : [...prev, surface],
    );
  }

  function send() {
    setMsg(null);
    if (isBanner && surfaces.length === 0) {
      setMsg({ ok: false, text: "Pick at least one surface for the banner." });
      return;
    }
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
        show_banner: isBanner,
        banner_surfaces: isBanner ? surfaces : [],
        banner_dismiss_mode: dismissMode,
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
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        {/* Compose */}
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="space-y-4">
            <SelectField
              label="Audience"
              value={audience}
              options={AUDIENCES.map((a) => ({
                value: a.value,
                label: a.label,
              }))}
              onChange={(v) => setAudience(v)}
              hint="Delivered in-app + push, and email where the recipient allows it. For specific people, use Send-to-users."
            />
            <TextField
              label="Title"
              value={title}
              onChange={setTitle}
              placeholder="What's happening"
              maxLength={120}
            />
            <TextArea
              label="Message"
              value={body}
              onChange={setBody}
              placeholder="The message…"
              rows={4}
              maxLength={2000}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Link label"
                value={linkLabel}
                onChange={setLinkLabel}
                placeholder="Read more"
                hint="Optional"
              />
              <TextField
                label="Link URL"
                type="url"
                value={linkUrl}
                onChange={setLinkUrl}
                placeholder="https://…"
                hint="Optional"
              />
            </div>
            <SegRow
              label="Severity"
              value={severity}
              options={SEVERITIES.map((s) => ({
                value: s,
                label: s[0]!.toUpperCase() + s.slice(1),
              }))}
              onChange={(v) => setSeverity(v)}
              hint="Sets the colour, the bell notification, and (critical only) an email."
            />
          </div>
        </div>

        {/* Banner display */}
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="space-y-4">
            <ToggleField
              label="Show as a banner"
              hint="Off = bell notification only. On = also pin a banner until it expires."
              checked={isBanner}
              onChange={setIsBanner}
            />
            {isBanner ? (
              <div className="space-y-4 border-t border-brand-line pt-4">
                <div>
                  <span className="block text-[13px] font-semibold text-brand-ink">
                    Show banner on
                  </span>
                  <div className="mt-2 space-y-2.5">
                    <ToggleField
                      label="Dashboard"
                      hint="Host & guest app"
                      checked={surfaces.includes("dashboard")}
                      onChange={() => toggleSurface("dashboard")}
                    />
                    <ToggleField
                      label="Public site"
                      hint="Wielo public pages"
                      checked={surfaces.includes("public")}
                      onChange={() => toggleSurface("public")}
                    />
                  </div>
                </div>
                <SegRow
                  label="How viewers close it"
                  value={dismissMode}
                  options={[
                    { value: "dismissible", label: "Dismissible" },
                    { value: "acknowledge", label: "Require ack" },
                    { value: "persistent", label: "Always show" },
                  ]}
                  onChange={(v) => setDismissMode(v)}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="Starts"
                    type="datetime-local"
                    value={startsAt}
                    onChange={setStartsAt}
                    hint="Optional — defaults to now"
                  />
                  <TextField
                    label="Ends"
                    type="datetime-local"
                    value={endsAt}
                    onChange={setEndsAt}
                    hint="Optional — open-ended"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Action */}
        <div className="flex flex-wrap items-center gap-3">
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
                  <tr key={h.id} className="group">
                    <td className="font-semibold text-brand-ink">
                      <Link
                        href={`/admin/broadcasts/${h.id}`}
                        className="hover:text-brand-primary hover:underline"
                        title="View stats & edit"
                      >
                        {h.title}
                      </Link>
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
