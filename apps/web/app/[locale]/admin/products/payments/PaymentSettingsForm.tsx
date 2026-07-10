"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { savePaymentSettings } from "./actions";

export type PaymentSettings = {
  paystackEnabled: boolean;
  paystackMode: "live" | "test";
  hasSecret: boolean;
  paystackPublicKey: string;
  hasTestSecret: boolean;
  paystackTestPublicKey: string;
  paypalEnabled: boolean;
  paypalEnvironment: "live" | "test";
  paypalClientId: string;
  hasPaypalSecret: boolean;
  eftEnabled: boolean;
  eftBankName: string;
  eftAccountName: string;
  eftAccountNumber: string;
  eftBranchCode: string;
  eftSwiftCode: string;
  eftReferenceHint: string;
};

export function PaymentSettingsForm({ initial }: { initial: PaymentSettings }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [secret, setSecret] = useState("");
  const [testSecret, setTestSecret] = useState("");
  const [paypalSecret, setPaypalSecret] = useState("");
  const [pending, start] = useTransition();

  function set<K extends keyof PaymentSettings>(k: K, v: PaymentSettings[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function save() {
    start(async () => {
      const r = await savePaymentSettings({
        paystackEnabled: f.paystackEnabled,
        paystackMode: f.paystackMode,
        paystackSecretKey: secret.trim() || null,
        paystackPublicKey: f.paystackPublicKey.trim() || null,
        paystackTestSecretKey: testSecret.trim() || null,
        paystackTestPublicKey: f.paystackTestPublicKey.trim() || null,
        paypalEnabled: f.paypalEnabled,
        paypalEnvironment: f.paypalEnvironment,
        paypalClientId: f.paypalClientId.trim() || null,
        paypalSecret: paypalSecret.trim() || null,
        eftEnabled: f.eftEnabled,
        eftBankName: f.eftBankName.trim() || null,
        eftAccountName: f.eftAccountName.trim() || null,
        eftAccountNumber: f.eftAccountNumber.trim() || null,
        eftBranchCode: f.eftBranchCode.trim() || null,
        eftSwiftCode: f.eftSwiftCode.trim() || null,
        eftReferenceHint: f.eftReferenceHint.trim() || null,
      });
      if (r.ok) {
        toast.success("Payment settings saved.");
        setSecret("");
        setTestSecret("");
        setPaypalSecret("");
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
          Paystack (cards) for Wielo
        </label>

        {/* Active mode — which key pair checkouts use */}
        <div className="space-y-1.5">
          <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
            Active mode
          </span>
          <div className="inline-flex rounded-pill border border-brand-line bg-brand-light p-0.5">
            {(["live", "test"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set("paystackMode", m)}
                className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-semibold capitalize transition-colors ${
                  f.paystackMode === m
                    ? m === "test"
                      ? "bg-status-pending text-white"
                      : "bg-brand-primary text-white"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <span className="block text-[11px] text-brand-mute">
            {f.paystackMode === "test"
              ? "Checkouts use your TEST keys — safe for testing, no real charges."
              : "Checkouts use your LIVE keys — real charges."}
          </span>
        </div>

        {/* Live keys */}
        <div className="space-y-4 rounded-md border border-brand-line/70 bg-[#FBFDFC] p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-brand-mute">
            Live keys
          </div>
          <Field
            label="Live secret key"
            hint={
              f.hasSecret
                ? "A live secret is set. Leave blank to keep it, or paste a new one."
                : "Paste the live Paystack secret key (sk_live_…)."
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
          <Field label="Live public key">
            <Input
              value={f.paystackPublicKey}
              onChange={(e) => set("paystackPublicKey", e.target.value)}
              placeholder="pk_live_…"
              className="font-mono"
            />
          </Field>
        </div>

        {/* Test keys */}
        <div className="space-y-4 rounded-md border border-status-pending/30 bg-status-pending/5 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-status-pending">
            Test keys
          </div>
          <Field
            label="Test secret key"
            hint={
              f.hasTestSecret
                ? "A test secret is set. Leave blank to keep it, or paste a new one."
                : "Paste the test Paystack secret key (sk_test_…)."
            }
          >
            <Input
              type="password"
              value={testSecret}
              onChange={(e) => setTestSecret(e.target.value)}
              placeholder={f.hasTestSecret ? "•••••••• (set)" : "sk_test_…"}
              className="font-mono"
            />
          </Field>
          <Field label="Test public key">
            <Input
              value={f.paystackTestPublicKey}
              onChange={(e) => set("paystackTestPublicKey", e.target.value)}
              placeholder="pk_test_…"
              className="font-mono"
            />
          </Field>
        </div>
      </section>

      {/* PayPal (Wielo's own account) */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
        <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
          <input
            type="checkbox"
            checked={f.paypalEnabled}
            onChange={(e) => set("paypalEnabled", e.target.checked)}
            className="rounded border-brand-line"
          />
          PayPal for Wielo
        </label>
        <p className="text-[12px] text-brand-mute">
          Wielo&apos;s own PayPal app. PayPal is the international rail —
          products are charged in USD (converted from the ZAR price). The client
          secret is stored encrypted and never shown again.
        </p>

        {/* Environment — sandbox vs live */}
        <div className="space-y-1.5">
          <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
            Environment
          </span>
          <div className="inline-flex rounded-pill border border-brand-line bg-brand-light p-0.5">
            {(["live", "test"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set("paypalEnvironment", m)}
                className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-semibold capitalize transition-colors ${
                  f.paypalEnvironment === m
                    ? m === "test"
                      ? "bg-status-pending text-white"
                      : "bg-brand-primary text-white"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                {m === "test" ? "Sandbox" : "Live"}
              </button>
            ))}
          </div>
        </div>

        <Field label="Client ID">
          <Input
            value={f.paypalClientId}
            onChange={(e) => set("paypalClientId", e.target.value)}
            placeholder="PayPal app client ID"
            className="font-mono"
          />
        </Field>
        <Field
          label="Client secret"
          hint={
            f.hasPaypalSecret
              ? "A secret is set. Leave blank to keep it, or paste a new one."
              : "Paste the PayPal app client secret."
          }
        >
          <Input
            type="password"
            value={paypalSecret}
            onChange={(e) => setPaypalSecret(e.target.value)}
            placeholder={f.hasPaypalSecret ? "•••••••• (set)" : "PayPal secret"}
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
          <Field label="SWIFT / BIC code">
            <Input
              value={f.eftSwiftCode}
              onChange={(e) => set("eftSwiftCode", e.target.value)}
              placeholder="e.g. SBZAZAJJ"
              className="font-mono uppercase"
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
