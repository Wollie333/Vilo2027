"use client";

import {
  Bell,
  Eye,
  Mail,
  Pencil,
  RotateCcw,
  Smartphone,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import type { MessageConfig } from "@/lib/notifications/admin-config";

import {
  previewMessageEmailAction,
  resetMessageOverrideAction,
  saveMessageOverrideAction,
  toggleMasterAction,
} from "../actions";

// Shared message-management primitives — the single implementation behind BOTH
// lenses onto the notification_overrides store: the global Communications hub
// (all areas) and a competition's Email tab (the comp kinds only). "One model,
// many lenses" (COMMUNICATIONS_UI_BRIEF §1) — editing a message in either place
// edits the same thing, so the row / drawer / preview live here, once.

export type Channel = "email" | "push" | "in_app";

/** Local optimistic state + the three write handlers, shared by both lenses. */
export function useMessageToggles(
  byKind: Record<string, MessageConfig>,
  setByKind: React.Dispatch<
    React.SetStateAction<Record<string, MessageConfig>>
  >,
) {
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

  return { patchLocal, toggleMaster, toggleChannel };
}

export function MessageRow({
  m,
  onToggleMaster,
  onToggleChannel,
  onEdit,
  onPreview,
}: {
  m: MessageConfig;
  onToggleMaster: () => void;
  onToggleChannel: (ch: Channel) => void;
  onEdit: () => void;
  onPreview: () => void;
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
        {m.email.supported ? (
          <button className="iact" title="Preview email" onClick={onPreview}>
            <Eye className="h-4 w-4" />
          </button>
        ) : null}
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

export function Chip({
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

export function Health({ m }: { m: MessageConfig }) {
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

export function EditDrawer({
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

// Renders the real branded email in a sandboxed iframe (full email HTML with
// its own <style>, so an iframe keeps it isolated from the admin console CSS).
export function EmailPreviewModal({
  m,
  onClose,
}: {
  m: MessageConfig;
  onClose: () => void;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; html: string; subject: string }
    | { status: "error"; error: string }
  >({ status: "loading" });
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameH, setFrameH] = useState(560);

  // Grow the iframe to the rendered email's height so the modal body — not the
  // iframe — owns the scroll. allow-same-origin lets us measure; scripts stay
  // disabled (no allow-scripts), and the HTML is our own trusted template.
  function measureFrame() {
    const doc = frameRef.current?.contentDocument;
    const h = doc?.body?.scrollHeight;
    if (h && h > 0) setFrameH(h);
  }

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    void previewMessageEmailAction({
      kind: m.kind,
      subjectOverride: m.subjectOverride,
      introOverride: m.introOverride,
    }).then((res) => {
      if (!alive) return;
      setState(
        res.ok
          ? { status: "ready", html: res.html, subject: res.subject }
          : { status: "error", error: res.error },
      );
    });
    return () => {
      alive = false;
    };
  }, [m.kind, m.subjectOverride, m.introOverride]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="scrim show" onClick={onClose} />
      <div className="mailmodal" role="dialog" aria-label="Email preview">
        <div className="flex shrink-0 items-start gap-3 border-b border-brand-line px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="smallcaps">Email preview</div>
            <div className="mt-0.5 truncate text-[14px] font-semibold text-brand-ink">
              {state.status === "ready" ? state.subject : m.label}
            </div>
            <div className="mt-0.5 text-[11.5px] text-brand-mute">
              How this email lands in the recipient&apos;s inbox
              {m.customised ? " · with your customised copy" : ""}.
            </div>
          </div>
          <button className="iact shrink-0" onClick={onClose} title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mailmodal-body thin-scroll">
          {state.status === "loading" ? (
            <div className="grid place-items-center py-16 text-[13px] text-brand-mute">
              Rendering email…
            </div>
          ) : state.status === "error" ? (
            <div className="m-5 rounded-[10px] border border-brand-line bg-[#FEF3F2] p-4 text-[12.5px] text-[#B91C1C]">
              {state.error}
            </div>
          ) : (
            <iframe
              ref={frameRef}
              title="Email preview"
              className="mailmodal-frame"
              sandbox="allow-same-origin"
              srcDoc={state.html}
              style={{ height: frameH }}
              onLoad={measureFrame}
            />
          )}
        </div>
      </div>
    </>
  );
}
