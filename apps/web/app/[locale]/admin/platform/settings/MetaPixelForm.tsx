"use client";

import { Activity, Loader2, Lock, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveMetaIntegrationAction } from "./actions";

export function MetaPixelForm({
  pixelId: initialId,
  pixelEnabled: initialEnabled,
  testEventCode: initialTest,
  capiTokenSet,
}: {
  pixelId: string;
  pixelEnabled: boolean;
  testEventCode: string;
  capiTokenSet: boolean;
}) {
  const router = useRouter();
  const [pixelId, setPixelId] = useState(initialId);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [testCode, setTestCode] = useState(initialTest);
  const [pending, start] = useTransition();

  const dirty =
    pixelId.trim() !== initialId.trim() ||
    enabled !== initialEnabled ||
    testCode.trim() !== initialTest.trim();

  function save() {
    if (pending || !dirty) return;
    start(async () => {
      try {
        await saveMetaIntegrationAction({
          meta_pixel_id: pixelId.trim(),
          meta_pixel_enabled: enabled,
          meta_test_event_code: testCode.trim(),
        });
        toast.success("Meta Pixel settings saved");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  return (
    <div className="max-w-lg rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-brand-primary" />
        <h2 className="font-display text-base font-bold text-brand-ink">
          Meta Pixel &amp; Conversions API
        </h2>
      </div>
      <p className="mt-1 text-sm text-brand-mute">
        Paste your Meta Pixel ID and enable it — the pixel then loads across the
        whole site and a <span className="font-medium">Purchase</span> event
        fires automatically with the correct amount on every completed purchase.
        No redeploy needed.
      </p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Meta Pixel ID
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={pixelId}
            onChange={(e) => setPixelId(e.target.value)}
            placeholder="1234567890123456"
            className={inputCls}
          />
          <span className="mt-1 block text-[11px] text-brand-mute">
            Found in Meta Events Manager → Data sources.
          </span>
        </label>

        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary/30"
          />
          <span className="text-sm font-medium text-brand-ink">
            Pixel enabled (load site-wide)
          </span>
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Test event code
          </span>
          <input
            type="text"
            value={testCode}
            onChange={(e) => setTestCode(e.target.value)}
            placeholder="TEST12345"
            className={inputCls}
          />
          <span className="mt-1 block text-[11px] text-brand-mute">
            Optional — for verifying events in Meta&apos;s Test Events tool.
          </span>
        </label>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="inline-flex h-[42px] items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* Conversions API — plumbed, wired later. */}
      <div className="mt-5 rounded-[10px] border border-dashed border-brand-line bg-brand-light/40 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
          <Lock className="h-3.5 w-3.5 text-brand-mute" />
          Conversions API (server-side)
          <span className="rounded-pill bg-brand-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-secondary">
            Coming soon
          </span>
        </div>
        <p className="mt-1 text-[12px] text-brand-mute">
          Each Purchase already carries a stable event ID so the server-side
          Conversions API can dedupe against the browser pixel when it ships.
          {capiTokenSet ? " An access token is on file." : ""}
        </p>
      </div>
    </div>
  );
}

const inputCls =
  "mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10";
