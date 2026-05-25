"use client";

import { useState, useTransition } from "react";
import { Eye, Send } from "lucide-react";

import { renderPreviewAction, sendTestEmailAction } from "../actions";

type Props = {
  type: string;
  initialPayload: Record<string, unknown>;
  defaultTestTo: string;
};

export function PreviewTester({ type, initialPayload, defaultTestTo }: Props) {
  const [payloadText, setPayloadText] = useState(() =>
    JSON.stringify(initialPayload, null, 2),
  );
  const [html, setHtml] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [testTo, setTestTo] = useState(defaultTestTo);
  const [reason, setReason] = useState("Test send via admin email tool");
  const [testResult, setTestResult] = useState<
    | { ok: true; providerId: string | null }
    | { ok: false; error: string }
    | null
  >(null);

  const [previewPending, startPreview] = useTransition();
  const [sendPending, startSend] = useTransition();

  function parsePayload(): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(payloadText);
      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        setError("Payload must be a JSON object.");
        return null;
      }
      setError(null);
      return parsed as Record<string, unknown>;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON.");
      return null;
    }
  }

  function handlePreview() {
    const payload = parsePayload();
    if (!payload) return;
    startPreview(async () => {
      const res = await renderPreviewAction({ type, payload });
      if (res.ok) {
        setHtml(res.html);
        setSubject(res.subject);
      } else {
        setError(res.error);
        setHtml(null);
        setSubject(null);
      }
    });
  }

  function handleSend() {
    const payload = parsePayload();
    if (!payload) return;
    setTestResult(null);
    startSend(async () => {
      const res = await sendTestEmailAction({
        type,
        payload,
        to: testTo,
        reason,
      });
      setTestResult(res);
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="space-y-4">
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h2 className="font-display text-sm font-semibold text-brand-ink">
            Sample payload (JSON)
          </h2>
          <p className="mt-1 text-[12px] text-brand-mute">
            Keys map to the template&apos;s props. Edit to test edge cases.
          </p>
          <textarea
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            spellCheck={false}
            rows={16}
            className="mt-3 w-full rounded border border-brand-line bg-brand-light/40 p-3 font-mono text-[12px] text-brand-ink focus:border-brand-primary focus:outline-none"
          />
          {error ? (
            <p className="mt-2 text-[12px] text-status-cancelled">{error}</p>
          ) : null}
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewPending}
            className="mt-3 inline-flex items-center gap-2 rounded-pill bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            <Eye className="h-4 w-4" />
            {previewPending ? "Rendering…" : "Render preview"}
          </button>
        </div>

        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h2 className="font-display text-sm font-semibold text-brand-ink">
            Send a test
          </h2>
          <p className="mt-1 text-[12px] text-brand-mute">
            Goes through Resend now. The subject is prefixed with{" "}
            <code>[TEST]</code>. Action is audited.
          </p>

          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Send to
          </label>
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            className="mt-1 w-full rounded border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none"
          />

          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Reason (audited)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={sendPending}
            className="mt-3 inline-flex items-center gap-2 rounded-pill bg-brand-secondary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {sendPending ? "Sending…" : "Send test"}
          </button>

          {testResult?.ok ? (
            <p className="mt-3 rounded border border-status-confirmed/30 bg-status-confirmed/10 p-3 text-[12.5px] text-status-confirmed">
              Sent.{" "}
              {testResult.providerId ? (
                <span className="font-mono text-[11px]">
                  ({testResult.providerId})
                </span>
              ) : null}
            </p>
          ) : null}
          {testResult && !testResult.ok ? (
            <p className="mt-3 rounded border border-status-cancelled/30 bg-status-cancelled/5 p-3 text-[12.5px] text-status-cancelled">
              {testResult.error}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-sm font-semibold text-brand-ink">
          Preview
        </h2>
        {subject ? (
          <p className="mt-1 text-[12px] text-brand-mute">
            Subject: <strong className="text-brand-ink">{subject}</strong>
          </p>
        ) : null}
        <div className="mt-3 overflow-hidden rounded border border-brand-line bg-brand-light/40">
          {html ? (
            <iframe
              srcDoc={html}
              title="Email preview"
              className="h-[680px] w-full border-0 bg-white"
              sandbox=""
            />
          ) : (
            <div className="flex h-[680px] items-center justify-center px-6 text-center text-[13px] text-brand-mute">
              Click <strong>Render preview</strong> to see the email.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
