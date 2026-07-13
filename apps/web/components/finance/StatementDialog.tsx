"use client";

import { Download, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";

export type StatementRange = { from: string | null; to: string | null };
type BuildResult = { ok: true; path: string } | { ok: false; error: string };
type SendResult = { ok: boolean; error?: string };

type Preset = "all" | "month" | "90d" | "year" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "all", label: "All activity" },
  { key: "month", label: "This month" },
  { key: "90d", label: "Last 3 months" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom range" },
];

function startOfMonth(): string {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), 1)).toISOString();
}
function startOfYear(): string {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), 0, 1)).toISOString();
}
function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}
function dayStart(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}
function dayEnd(date: string): string {
  return new Date(`${date}T23:59:59.999Z`).toISOString();
}

export function StatementDialog({
  open,
  onOpenChange,
  recipient,
  build,
  send,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Who receives it, for copy — e.g. "guest" or "host". */
  recipient: string;
  build: (r: StatementRange) => Promise<BuildResult>;
  send?: ((r: StatementRange) => Promise<SendResult>) | null;
}) {
  const [preset, setPreset] = useState<Preset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [pending, start] = useTransition();

  function range(): StatementRange | null {
    switch (preset) {
      case "all":
        return { from: null, to: null };
      case "month":
        return { from: startOfMonth(), to: null };
      case "90d":
        return { from: daysAgo(90), to: null };
      case "year":
        return { from: startOfYear(), to: null };
      case "custom":
        if (!customFrom) {
          toast.error("Pick a start date for the custom range.");
          return null;
        }
        return {
          from: dayStart(customFrom),
          to: customTo ? dayEnd(customTo) : null,
        };
    }
  }

  function onView() {
    const r = range();
    if (!r) return;
    start(async () => {
      const res = await build(r);
      if (res.ok) {
        window.open(`${window.location.origin}${res.path}`, "_blank");
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  function onSend() {
    if (!send) return;
    const r = range();
    if (!r) return;
    start(async () => {
      const res = await send(r);
      if (res.ok) {
        toast.success(`Statement sent to the ${recipient}.`);
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "Couldn't send the statement.");
      }
    });
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Statement of account"
      description={`A running summary of account activity. Open it to download, or send the ${recipient} a link.`}
    >
      <div className="space-y-4">
        <div>
          <div className="mb-2 text-[12px] font-semibold text-brand-mute">
            Period
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p.key)}
                className={`rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                  preset === p.key
                    ? "border-brand-primary bg-brand-accent text-brand-primary"
                    : "border-brand-line bg-white text-brand-ink hover:bg-brand-light"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {preset === "custom" ? (
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-brand-mute">
              From
              <DatePicker
                value={customFrom}
                onChange={setCustomFrom}
                align="left"
                className="w-44"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-brand-mute">
              To (optional)
              <DatePicker
                value={customTo}
                min={customFrom || undefined}
                onChange={setCustomTo}
                clearable
                align="left"
                className="w-44"
              />
            </label>
          </div>
        ) : null}
      </div>

      <FormModalFooter>
        <FormModalCancel onClick={() => onOpenChange(false)} />
        {send ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onSend}
          >
            <Send className="mr-1.5 h-4 w-4" /> Send to {recipient}
          </Button>
        ) : null}
        <Button type="button" disabled={pending} onClick={onView}>
          <Download className="mr-1.5 h-4 w-4" /> Open &amp; download
        </Button>
      </FormModalFooter>
    </FormModal>
  );
}
