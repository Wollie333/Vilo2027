"use client";

import { Landmark } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { savePayoutMethodAction } from "../actions";

// "Payout account" card — pixel-match of the design, with an inline editor that
// reuses savePayoutMethodAction (so the new layout keeps full add/edit ability).
type Method = "eft" | "paypal" | "paystack";

export function PayoutAccountCard({
  label,
  detail,
  hasAccount,
}: {
  label: string | null;
  detail: string | null;
  hasAccount: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<Method>("eft");
  const [form, setForm] = useState<Record<string, string>>({});

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function save() {
    start(async () => {
      const res = await savePayoutMethodAction({
        method,
        is_default: true,
        bank_name: form.bank_name,
        account_name: form.account_name,
        account_number: form.account_number,
        branch_code: form.branch_code,
        paypal_email: form.paypal_email,
        paystack_recipient_code: form.paystack_recipient_code,
      });
      if (res.ok) {
        toast.success("Payout account saved.");
        setEditing(false);
        setForm({});
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="am-card fade overflow-hidden">
      <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
        <span className="smallcaps">Payout account</span>
        <button
          type="button"
          className="btn-ghost h-8"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Cancel" : hasAccount ? "Edit" : "Add"}
        </button>
      </div>
      {!editing ? (
        hasAccount ? (
          <div className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-brand-line bg-brand-light">
              <Landmark className="h-[18px] w-[18px] text-brand-secondary" />
            </div>
            <div>
              <div className="text-[13.5px] font-semibold text-brand-ink">
                {label}
              </div>
              <div className="mono text-[12px] text-brand-mute">{detail}</div>
            </div>
          </div>
        ) : (
          <div className="p-5 text-[12.5px] text-brand-mute">
            No payout account yet — add one so you can withdraw your cleared
            balance.
          </div>
        )
      ) : (
        <div className="space-y-3 p-5">
          <div>
            <label className="flabel">Method</label>
            <select
              className="fld"
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
            >
              <option value="eft">EFT (bank transfer)</option>
              <option value="paypal">PayPal</option>
              <option value="paystack">Paystack</option>
            </select>
          </div>
          {method === "eft" ? (
            <>
              <Fld
                label="Bank name"
                onChange={set("bank_name")}
                value={form.bank_name ?? ""}
              />
              <Fld
                label="Account holder"
                onChange={set("account_name")}
                value={form.account_name ?? ""}
              />
              <Fld
                label="Account number"
                onChange={set("account_number")}
                value={form.account_number ?? ""}
              />
              <Fld
                label="Branch code"
                onChange={set("branch_code")}
                value={form.branch_code ?? ""}
              />
            </>
          ) : method === "paypal" ? (
            <Fld
              label="PayPal email"
              onChange={set("paypal_email")}
              value={form.paypal_email ?? ""}
            />
          ) : (
            <Fld
              label="Paystack recipient code"
              onChange={set("paystack_recipient_code")}
              value={form.paystack_recipient_code ?? ""}
            />
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="btn-pri h-9 w-full justify-center"
          >
            {pending ? "Saving…" : "Save account"}
          </button>
        </div>
      )}
    </section>
  );
}

function Fld({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="flabel">{label}</label>
      <input className="fld" value={value} onChange={onChange} />
    </div>
  );
}
