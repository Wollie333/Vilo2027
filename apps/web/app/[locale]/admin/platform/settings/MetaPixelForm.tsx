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
  capiEnabled: initialCapiEnabled,
}: {
  pixelId: string;
  pixelEnabled: boolean;
  testEventCode: string;
  capiTokenSet: boolean;
  capiEnabled: boolean;
}) {
  const router = useRouter();
  const [pixelId, setPixelId] = useState(initialId);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [testCode, setTestCode] = useState(initialTest);
  const [capiEnabled, setCapiEnabled] = useState(initialCapiEnabled);
  const [capiToken, setCapiToken] = useState(""); // write-only; blank = keep
  const [pending, start] = useTransition();

  const dirty =
    pixelId.trim() !== initialId.trim() ||
    enabled !== initialEnabled ||
    testCode.trim() !== initialTest.trim() ||
    capiEnabled !== initialCapiEnabled ||
    capiToken.trim().length > 0;

  function save() {
    if (pending || !dirty) return;
    start(async () => {
      try {
        await saveMetaIntegrationAction({
          meta_pixel_id: pixelId.trim(),
          meta_pixel_enabled: enabled,
          meta_test_event_code: testCode.trim(),
          meta_capi_enabled: capiEnabled,
          meta_capi_access_token: capiToken.trim(),
        });
        toast.success("Meta Pixel settings saved");
        setCapiToken("");
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

      {/* Conversions API (server-side) — deduped against the browser pixel. */}
      <div className="mt-5 rounded-[10px] border border-brand-line bg-brand-light/40 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
          <Lock className="h-3.5 w-3.5 text-brand-mute" />
          Conversions API (server-side)
        </div>
        <p className="mt-1 text-[12px] text-brand-mute">
          Sends a server-side <span className="font-medium">Purchase</span> to
          Meta for every confirmed directory booking, deduped against the
          browser pixel via a shared event ID — better match rates + survives
          ad-blockers.
        </p>

        <label className="mt-3 block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Access token
          </span>
          <input
            type="password"
            value={capiToken}
            onChange={(e) => setCapiToken(e.target.value)}
            autoComplete="off"
            placeholder={
              capiTokenSet
                ? "•••••••••• (a token is on file — leave blank to keep it)"
                : "Paste the Conversions API token"
            }
            className={inputCls}
          />
          <span className="mt-1 block text-[11px] text-brand-mute">
            Meta Events Manager → Settings → Conversions API → Generate access
            token. Stored encrypted server-side, never shown again.
          </span>
        </label>

        <label className="mt-3 flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={capiEnabled}
            onChange={(e) => setCapiEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary/30"
          />
          <span className="text-sm font-medium text-brand-ink">
            Conversions API enabled
          </span>
        </label>
        <p className="mt-1.5 text-[11px] text-brand-mute">
          Uses the same test event code above for Meta&apos;s Test Events tool.
        </p>
      </div>
    </div>
  );
}

const inputCls =
  "mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10";
