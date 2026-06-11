"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { modal } from "@/components/ui/modal-host";

import {
  broadcastPreviewAction,
  broadcastStatusAction,
  sendBroadcastAction,
  type BroadcastPreview,
  type BroadcastStatus,
} from "./actions";

const AUDIENCES = [
  { key: "all", label: "All subscribed guests" },
  { key: "vip", label: "VIP" },
  { key: "returning", label: "Returning" },
  { key: "new", label: "New" },
  { key: "ota", label: "Via OTA" },
  { key: "lapsed", label: "Lapsed (win-back)" },
];

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(
    `${d.length <= 10 ? `${d}T12:00:00Z` : d}`,
  ).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BroadcastModal({
  open,
  onOpenChange,
  defaultAudience = "all",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAudience?: string;
}) {
  const router = useRouter();
  const [audience, setAudience] = useState(defaultAudience);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<BroadcastPreview | null>(null);
  const [status, setStatus] = useState<BroadcastStatus | null>(null);
  const [sending, setSending] = useState(false);

  // Load cap + recent history when opened.
  useEffect(() => {
    if (!open) return;
    setSubject("");
    setBody("");
    setAudience(defaultAudience);
    void broadcastStatusAction().then((r) => {
      if (r.ok) setStatus(r.data!);
    });
  }, [open, defaultAudience]);

  // Refresh the recipient preview whenever the audience changes.
  useEffect(() => {
    if (!open) return;
    setPreview(null);
    let cancelled = false;
    void broadcastPreviewAction(audience).then((r) => {
      if (!cancelled && r.ok) setPreview(r.data!);
    });
    return () => {
      cancelled = true;
    };
  }, [open, audience]);

  const canSend = status?.canSend ?? true;
  const eligible = preview?.eligible ?? 0;
  const sendable = canSend && eligible > 0 && subject.trim() && body.trim();

  async function send() {
    setSending(true);
    const res = await sendBroadcastAction({ audience, subject, body });
    setSending(false);
    if (!res.ok) {
      void modal.error({
        title: "Couldn't send",
        description: res.nextAllowedOn
          ? `${res.error} Next one available on ${fmtDate(res.nextAllowedOn)}.`
          : res.error,
      });
      return;
    }
    onOpenChange(false);
    void modal.success({
      title: "Broadcast sent",
      description: `Sent to ${res.sent} guest${res.sent === 1 ? "" : "s"}.`,
    });
    router.refresh();
  }

  const input =
    "h-10 w-full rounded-lg border border-brand-line bg-white px-3 text-sm text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Email your guests"
      description="One broadcast per calendar month. Every email carries a one-click unsubscribe."
    >
      <div className="space-y-4">
        {!canSend ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
            You&rsquo;ve already sent this month&rsquo;s broadcast. The next one
            is available on{" "}
            <span className="font-semibold">
              {fmtDate(status?.nextAllowedOn ?? null)}
            </span>
            .
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-brand-ink">
            Audience
          </label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className={input}
          >
            {AUDIENCES.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[12px] text-brand-mute">
            {preview ? (
              <>
                Will send to{" "}
                <span className="font-semibold text-brand-ink">{eligible}</span>{" "}
                · {preview.no_email} no email · {preview.unsubscribed}{" "}
                unsubscribed
                {preview.no_consent > 0
                  ? ` · ${preview.no_consent} no consent`
                  : ""}
              </>
            ) : (
              "Counting recipients…"
            )}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-brand-ink">
            Subject
          </label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={150}
            placeholder="A note from your host"
            className={input}
          />
        </div>

        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-brand-ink">
            Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            maxLength={8000}
            placeholder="Hi {{first_name}}, …"
            className="w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
          <p className="mt-1 text-[11.5px] text-brand-mute">
            Use {"{{first_name}}"} to greet each guest by name. Sent from your
            brand, replies go to your email.
          </p>
        </div>

        {status && status.recent.length > 0 ? (
          <div className="rounded-lg border border-brand-line bg-brand-light/40 p-3">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-mute">
              Recent broadcasts
            </div>
            <ul className="space-y-1">
              {status.recent.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 text-[12px] text-brand-mute"
                >
                  <span className="truncate text-brand-ink">{b.subject}</span>
                  <span className="shrink-0 tabular-nums">
                    {b.recipient_count} · {fmtDate(b.sent_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <FormModalFooter>
        <FormModalCancel disabled={sending}>Cancel</FormModalCancel>
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !sendable}
          className="rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-secondary disabled:opacity-50"
        >
          {sending ? "Sending…" : `Send to ${eligible}`}
        </button>
      </FormModalFooter>
    </FormModal>
  );
}
