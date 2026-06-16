"use client";

import { Plus, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import {
  computePayoutFee,
  type PayoutFeeConfig,
  type PayoutMethod,
} from "@/lib/affiliate/fees";
import { formatMoney } from "@/lib/format";

import {
  deletePayoutMethodAction,
  requestAffiliatePayoutAction,
  savePayoutMethodAction,
  setPayoutThresholdAction,
} from "../actions";

type MethodRow = {
  id: string;
  method: PayoutMethod;
  isDefault: boolean;
  label: string;
  detail: string;
};
type Payout = {
  id: string;
  method: string;
  status: string;
  gross: number;
  fee: number;
  net: number;
  requestedAt: string;
  processedAt: string | null;
};
type Commission = {
  id: string;
  status: string;
  kind: string;
  entryType: string;
  amount: number;
  createdAt: string;
};

const METHOD_LABEL: Record<PayoutMethod, string> = {
  eft: "EFT (bank transfer)",
  paystack: "Paystack",
  paypal: "PayPal",
};

const STATUS_TONE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700",
  approved: "bg-sky-100 text-sky-700",
  processing: "bg-sky-100 text-sky-700",
  paid: "bg-brand-accent text-brand-secondary",
  failed: "bg-rose-100 text-rose-700",
  rejected: "bg-rose-100 text-rose-700",
  pending: "bg-brand-light text-brand-mute",
  cleared: "bg-emerald-100 text-emerald-700",
  voided: "bg-rose-100 text-rose-700",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PayoutPanel({
  currency,
  balance,
  methods,
  fees,
  threshold,
  minThreshold,
  payouts,
  commissions,
}: {
  currency: string;
  balance: {
    available: number;
    pending: number;
    cleared: number;
    paid: number;
    lifetime: number;
  };
  methods: MethodRow[];
  fees: Record<PayoutMethod, PayoutFeeConfig>;
  threshold: number;
  minThreshold: number;
  payouts: Payout[];
  commissions: Commission[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requestOpen, setRequestOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [thresholdEdit, setThresholdEdit] = useState(false);
  const [thresholdValue, setThresholdValue] = useState(String(threshold));

  const defaultMethod = methods.find((m) => m.isDefault) ?? methods[0];
  const [chosenMethod, setChosenMethod] = useState<PayoutMethod>(
    defaultMethod?.method ?? "eft",
  );

  const canRequest =
    methods.length > 0 &&
    balance.available >= threshold &&
    balance.available > 0;

  const preview = useMemo(() => {
    const cfg = fees[chosenMethod];
    return computePayoutFee(balance.available, cfg);
  }, [chosenMethod, balance.available, fees]);

  function requestPayout() {
    startTransition(async () => {
      const res = await requestAffiliatePayoutAction(chosenMethod);
      if (res.ok) {
        toast.success(
          `Payout requested — ${formatMoney(res.data?.net ?? 0, currency)} on the way once approved.`,
        );
        setRequestOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function saveThreshold() {
    startTransition(async () => {
      const res = await setPayoutThresholdAction(Number(thresholdValue));
      if (res.ok) {
        toast.success("Payout threshold updated.");
        setThresholdEdit(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Balance summary */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
            Payouts
          </h1>
          <Button
            onClick={() => setRequestOpen(true)}
            disabled={!canRequest}
            className="gap-1.5"
          >
            <Wallet className="h-4 w-4" />
            Request payout
          </Button>
        </div>
        {!canRequest ? (
          <p className="mt-1 text-sm text-brand-mute">
            {methods.length === 0
              ? "Add a payout method below to request a payout."
              : `You can request a payout once your available balance reaches ${formatMoney(threshold, currency)}.`}
          </p>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BalanceCard
            label="Available now"
            value={formatMoney(balance.available, currency)}
            strong
          />
          <BalanceCard
            label="Pending (clearing)"
            value={formatMoney(balance.pending, currency)}
          />
          <BalanceCard
            label="Paid out"
            value={formatMoney(balance.paid, currency)}
          />
          <BalanceCard
            label="Lifetime earned"
            value={formatMoney(balance.lifetime, currency)}
          />
        </div>
      </div>

      {/* Payout methods + threshold */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-brand-line bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-brand-line px-5 py-4">
            <div>
              <h2 className="font-display text-base font-semibold text-brand-ink">
                Payout methods
              </h2>
              <p className="mt-0.5 text-xs text-brand-mute">
                Where we send your payouts. The fee is deducted from each
                payout.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMethodOpen(true)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {methods.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-brand-mute">
              No payout method yet.
            </div>
          ) : (
            <ul className="divide-y divide-brand-line">
              {methods.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-semibold text-brand-ink">
                        {METHOD_LABEL[m.method]}
                      </span>
                      {m.isDefault ? (
                        <Badge className="bg-brand-accent text-brand-secondary">
                          Default
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-brand-mute">
                      {m.detail}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        const res = await deletePayoutMethodAction(m.id);
                        if (res.ok) {
                          toast.success("Payout method removed.");
                          router.refresh();
                        } else toast.error(res.error);
                      })
                    }
                    disabled={pending}
                    className="rounded-md p-1.5 text-brand-mute hover:bg-brand-light hover:text-status-cancelled"
                    aria-label="Remove method"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-semibold text-brand-ink">
            Payout threshold
          </h2>
          <p className="mt-0.5 text-xs text-brand-mute">
            We&apos;ll only let you request a payout once your available balance
            reaches this. Minimum {formatMoney(minThreshold, currency)}.
          </p>
          {thresholdEdit ? (
            <div className="mt-4 flex items-center gap-2">
              <input
                type="number"
                min={minThreshold}
                value={thresholdValue}
                onChange={(e) => setThresholdValue(e.target.value)}
                className="w-32 rounded-md border border-brand-line px-3 py-2 text-sm"
              />
              <Button size="sm" onClick={saveThreshold} disabled={pending}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setThresholdValue(String(threshold));
                  setThresholdEdit(false);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3">
              <span className="font-display text-2xl font-bold text-brand-ink">
                {formatMoney(threshold, currency)}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setThresholdEdit(true)}
              >
                Edit
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Payout history */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-brand-ink">
          Payout history
        </h2>
        <SimpleTable
          empty="No payouts yet."
          head={["Requested", "Method", "Gross", "Fee", "Net", "Status"]}
          rows={payouts.map((p) => [
            fmtDate(p.requestedAt),
            METHOD_LABEL[p.method as PayoutMethod] ?? p.method,
            formatMoney(p.gross, currency),
            `−${formatMoney(p.fee, currency)}`,
            formatMoney(p.net, currency),
            <StatusPill key={p.id} status={p.status} />,
          ])}
        />
      </section>

      {/* Commission ledger */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-brand-ink">
          Commission activity
        </h2>
        <SimpleTable
          empty="No commission yet."
          head={["Date", "Type", "Amount", "Status"]}
          rows={commissions.map((c) => [
            fmtDate(c.createdAt),
            c.entryType === "clawback"
              ? "Clawback"
              : c.kind === "setup_fee"
                ? "Setup fee"
                : "Commission",
            formatMoney(c.amount, currency),
            <StatusPill key={c.id} status={c.status} />,
          ])}
        />
      </section>

      {/* Request payout modal */}
      <FormModal
        open={requestOpen}
        onOpenChange={setRequestOpen}
        title="Request a payout"
        description="We deduct the payout processor fee — you receive the net amount."
        size="sm"
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-mute">
              Payout method
            </span>
            <select
              value={chosenMethod}
              onChange={(e) => setChosenMethod(e.target.value as PayoutMethod)}
              className="mt-1 w-full rounded-md border border-brand-line px-3 py-2 text-sm"
            >
              {methods.map((m) => (
                <option key={m.id} value={m.method}>
                  {METHOD_LABEL[m.method]} — {m.detail}
                </option>
              ))}
            </select>
          </label>
          <dl className="space-y-1.5 rounded-card border border-brand-line bg-brand-light/40 p-4 text-sm">
            <Row
              label="Gross commission"
              value={formatMoney(preview.gross, currency)}
            />
            <Row
              label="Processor fee"
              value={`−${formatMoney(preview.fee, currency)}`}
            />
            <div className="border-t border-brand-line pt-1.5">
              <Row
                label="You receive"
                value={formatMoney(preview.net, currency)}
                strong
              />
            </div>
          </dl>
        </div>
        <FormModalFooter>
          <FormModalCancel>Cancel</FormModalCancel>
          <Button onClick={requestPayout} disabled={pending || !canRequest}>
            {pending ? "Requesting…" : "Confirm request"}
          </Button>
        </FormModalFooter>
      </FormModal>

      {/* Add method modal */}
      <AddMethodModal
        open={methodOpen}
        onOpenChange={setMethodOpen}
        pending={pending}
        onSaved={() => {
          setMethodOpen(false);
          router.refresh();
        }}
        startTransition={startTransition}
      />
    </div>
  );
}

function AddMethodModal({
  open,
  onOpenChange,
  pending,
  onSaved,
  startTransition,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pending: boolean;
  onSaved: () => void;
  startTransition: (cb: () => void) => void;
}) {
  const [method, setMethod] = useState<PayoutMethod>("eft");
  const [form, setForm] = useState<Record<string, string>>({});
  const [isDefault, setIsDefault] = useState(true);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function save() {
    startTransition(async () => {
      const res = await savePayoutMethodAction({
        method,
        is_default: isDefault,
        bank_name: form.bank_name,
        account_name: form.account_name,
        account_number: form.account_number,
        branch_code: form.branch_code,
        paystack_recipient_code: form.paystack_recipient_code,
        paypal_email: form.paypal_email,
      });
      if (res.ok) {
        toast.success("Payout method saved.");
        setForm({});
        onSaved();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Add payout method"
      size="sm"
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-mute">
            Method
          </span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PayoutMethod)}
            className="mt-1 w-full rounded-md border border-brand-line px-3 py-2 text-sm"
          >
            <option value="eft">EFT (bank transfer)</option>
            <option value="paystack">Paystack</option>
            <option value="paypal">PayPal</option>
          </select>
        </label>

        {method === "eft" ? (
          <>
            <Field
              label="Bank name"
              onChange={set("bank_name")}
              value={form.bank_name ?? ""}
            />
            <Field
              label="Account holder"
              onChange={set("account_name")}
              value={form.account_name ?? ""}
            />
            <Field
              label="Account number"
              onChange={set("account_number")}
              value={form.account_number ?? ""}
            />
            <Field
              label="Branch code"
              onChange={set("branch_code")}
              value={form.branch_code ?? ""}
            />
          </>
        ) : method === "paypal" ? (
          <Field
            label="PayPal email"
            onChange={set("paypal_email")}
            value={form.paypal_email ?? ""}
          />
        ) : (
          <Field
            label="Paystack recipient code"
            onChange={set("paystack_recipient_code")}
            value={form.paystack_recipient_code ?? ""}
          />
        )}

        <label className="flex items-center gap-2 text-sm text-brand-ink">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-4 w-4 rounded border-brand-line text-brand-primary"
          />
          Use as my default payout method
        </label>
      </div>
      <FormModalFooter>
        <FormModalCancel>Cancel</FormModalCancel>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save method"}
        </Button>
      </FormModalFooter>
    </FormModal>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      <input
        value={value}
        onChange={onChange}
        className="mt-1 w-full rounded-md border border-brand-line px-3 py-2 text-sm"
      />
    </label>
  );
}

function BalanceCard({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div
        className={`mt-2 font-display font-bold text-brand-ink ${strong ? "text-3xl" : "text-2xl"}`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium capitalize ${
        STATUS_TONE[status] ?? "bg-brand-light text-brand-mute"
      }`}
    >
      {status}
    </span>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-brand-mute">{label}</dt>
      <dd
        className={
          strong
            ? "font-display text-base font-bold text-brand-ink"
            : "text-brand-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function SimpleTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-brand-mute">
          {empty}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-brand-line text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]">
              <tr>
                {head.map((h, i) => (
                  <th key={i} className="px-4 py-2.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {rows.map((cells, ri) => (
                <tr key={ri} className="hover:bg-[#F8FCF9]">
                  {cells.map((c, ci) => (
                    <td key={ci} className="px-4 py-3 text-brand-ink">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
