"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";

import { createHostOverrideAction } from "./actions";

type Props = {
  featureKeys: string[];
};

// Grant or revoke a single feature for ONE host, outside their plan. Checked
// first by check_feature_permission, so it wins over the plan default.
export function HostOverrideForm({ featureKeys }: Props) {
  const [email, setEmail] = useState("");
  const [featureKey, setFeatureKey] = useState(featureKeys[0] ?? "");
  const [enabled, setEnabled] = useState(true);
  const [limit, setLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    if (!email.trim() || !featureKey || reason.trim().length < 5) {
      toast.error("Email, feature and a reason (5+ chars) are required.");
      return;
    }
    start(async () => {
      try {
        await createHostOverrideAction({
          hostEmail: email.trim(),
          featureKey,
          isEnabled: enabled,
          limitValue: limit.trim() === "" ? null : Number(limit),
          expiresAt: expiresAt.trim() === "" ? null : expiresAt,
          reason: reason.trim(),
        });
        toast.success("Override saved.");
        setEmail("");
        setLimit("");
        setExpiresAt("");
        setReason("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save override.");
      }
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Host email">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="host@example.com"
        />
      </Field>
      <Field label="Feature">
        <select
          value={featureKey}
          onChange={(e) => setFeatureKey(e.target.value)}
          className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none"
        >
          {featureKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Enabled">
        <label className="flex h-10 items-center gap-2 rounded-md border border-brand-line bg-white px-3 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-brand-line"
          />
          {enabled ? "Granted" : "Revoked"}
        </label>
      </Field>
      <Field label="Limit (blank = unlimited / N/A)">
        <Input
          type="number"
          min={0}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder="∞"
        />
      </Field>
      <Field label="Expires (blank = permanent)">
        <DatePicker
          value={expiresAt}
          onChange={setExpiresAt}
          clearable
          placeholder="Permanent"
        />
      </Field>
      <Field label="Reason (required)">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why this override?"
        />
      </Field>
      <div className="sm:col-span-2 lg:col-span-3">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save override"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      {children}
    </label>
  );
}
