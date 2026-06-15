"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { savePaymentSettings } from "./actions";

export type PaymentSettings = {
  paystackEnabled: boolean;
  hasSecret: boolean;
  paystackPublicKey: string;
  eftEnabled: boolean;
  eftBankName: string;
  eftAccountName: string;
  eftAccountNumber: string;
  eftBranchCode: string;
  eftReferenceHint: string;
};

export function PaymentSettingsForm({ initial }: { initial: PaymentSettings }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [secret, setSecret] = useState("");
  const [pending, start] = useTransition();

  function set<K extends keyof PaymentSettings>(k: K, v: PaymentSettings[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function save() {
    start(async () => {
      const r = await savePaymentSettings({
        paystackEnabled: f.paystackEnabled,
        paystackSecretKey: secret.trim() || null,
        paystackPublicKey: f.paystackPublicKey.trim() || null,
        eftEnabled: f.eftEnabled,
        eftBankName: f.eftBankName.trim() || null,
        eftAccountName: f.eftAccountName.trim() || null,
        eftAccountNumber: f.eftAccountNumber.trim() || null,
        eftBranchCode: f.eftBranchCode.trim() || null,
        eftReferenceHint: f.eftReferenceHint.trim() || null,
      });
      if (r.ok) {
        toast.success("Payment settings saved.");
        setSecret("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Paystack */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
        <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
          <input
            type="checkbox"
            checked={f.paystackEnabled}
            onChange={(e) => set("paystackEnabled", e.target.checked)}
            className="rounded border-brand-line"
          />
          Paystack (cards) for Vilo
        </label>
        <Field
          label="Secret key"
          hint={
            f.hasSecret
              ? "A secret key is set. Leave blank to keep it, or paste a new one to replace."
              : "Paste the platform Paystack secret key (sk_…)."
          }
        >
          <Input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={f.hasSecret ? "•••••••• (set)" : "sk_live_…"}
            className="font-mono"
          />
        </Field>
        <Field label="Public key">
          <Input
            value={f.paystackPublicKey}
            onChange={(e) => set("paystackPublicKey", e.target.value)}
            placeholder="pk_live_…"
            className="font-mono"
          />
        </Field>
      </section>

      {/* EFT */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
        <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
          <input
            type="checkbox"
            checked={f.eftEnabled}
            onChange={(e) => set("eftEnabled", e.target.checked)}
            className="rounded border-brand-line"
          />
          Manual EFT (for larger once-off purchases)
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank name">
            <Input
              value={f.eftBankName}
              onChange={(e) => set("eftBankName", e.target.value)}
            />
          </Field>
          <Field label="Account name">
            <Input
              value={f.eftAccountName}
              onChange={(e) => set("eftAccountName", e.target.value)}
            />
          </Field>
          <Field label="Account number">
            <Input
              value={f.eftAccountNumber}
              onChange={(e) => set("eftAccountNumber", e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Branch code">
            <Input
              value={f.eftBranchCode}
              onChange={(e) => set("eftBranchCode", e.target.value)}
              className="font-mono"
            />
          </Field>
        </div>
        <Field label="Reference hint (shown to payer)">
          <Input
            value={f.eftReferenceHint}
            onChange={(e) => set("eftReferenceHint", e.target.value)}
            placeholder="Use your business name as the reference"
          />
        </Field>
      </section>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save payment settings"}
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
