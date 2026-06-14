"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { recordManualLedgerEntryAction } from "./actions";

type EntryType = "charge" | "refund" | "credit" | "adjustment";

export function ManualEntryForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [type, setType] = useState<EntryType>("credit");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ZAR");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const amt = Number(amount);
    if (!email.trim() || !amt || reason.trim().length < 3) {
      toast.error("Email, a non-zero amount and a reason are required.");
      return;
    }
    start(async () => {
      try {
        await recordManualLedgerEntryAction({
          hostEmail: email.trim(),
          type,
          amount: amt,
          currency: currency.trim().toUpperCase() || "ZAR",
          reason: reason.trim(),
        });
        toast.success("Ledger entry posted.");
        setEmail("");
        setAmount("");
        setReason("");
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Couldn't post the entry.",
        );
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
      <Field label="Type">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as EntryType)}
          className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        >
          <option value="charge">Charge (revenue in)</option>
          <option value="refund">Refund (out)</option>
          <option value="credit">Credit (goodwill, out)</option>
          <option value="adjustment">Adjustment (signed)</option>
        </select>
      </Field>
      <Field label="Amount" hint="Adjustment may be negative.">
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="500"
          className="font-mono"
        />
      </Field>
      <Field label="Currency">
        <Input
          value={currency}
          maxLength={3}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          className="font-mono uppercase"
        />
      </Field>
      <Field label="Reason (required)">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Goodwill credit for downtime"
        />
      </Field>
      <div className="flex items-end">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Posting…" : "Post entry"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="block text-[11px] text-brand-mute">{hint}</span>
      ) : null}
    </label>
  );
}
