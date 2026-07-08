"use client";

import {
  Check,
  Copy,
  CreditCard,
  FileMinus,
  Link2,
  MessageSquare,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { formatMoney } from "@/lib/format";

import { adminSendPlatformMessageByEmailAction } from "@/app/[locale]/admin/inbox/actions";

import {
  createWieloPaymentLinkAction,
  recordManualLedgerEntryAction,
} from "./actions";

// The admin Wielo ledger's finance actions, in modals — the platform-side
// sibling of the guest record's GuestFinanceModals. Each is scoped to a USER
// (the host paying Wielo) instead of a booking, and every submit calls the SAME
// canonical, audited server action the manual-entry form used
// (recordManualLedgerEntryAction) or the product pay-link flow
// (createWieloPaymentLinkAction). No forked money logic — actions write ledger
// rows + mint the INV/REF/CN documents; a payment link reuses /pay/product.

export type WieloFinanceAction =
  | "payment"
  | "refund"
  | "credit"
  | "adjustment"
  | "link";

export type WieloFinanceRequest = {
  action: WieloFinanceAction;
  /** Pre-selected user email (from a row), or "" for the admin to type/pick. */
  email: string;
};

const TITLES: Record<
  WieloFinanceAction,
  { title: string; description: string }
> = {
  payment: {
    title: "Record a payment",
    description:
      "Log a payment received from a host into their Wielo account (revenue in). Issues a Wielo invoice.",
  },
  refund: {
    title: "Issue a refund",
    description: "Refund a host for a Wielo charge. Issues a refund document.",
  },
  credit: {
    title: "Give a credit",
    description:
      "Add a goodwill credit to a host's Wielo account. Issues a credit note (no cash leaves your account).",
  },
  adjustment: {
    title: "Post an adjustment",
    description:
      "A signed correction to a host's Wielo account (positive adds, negative reduces).",
  },
  link: {
    title: "Send a payment link",
    description:
      "Create a Wielo pay link for a product the host can pay by card or EFT. It mints the invoice + ledger row automatically once paid.",
  },
};

export function WieloFinanceModals({
  request,
  users,
  products,
  onClose,
}: {
  request: WieloFinanceRequest | null;
  /** Known users (from the ledger) for the email datalist. */
  users: { email: string; name: string | null }[];
  /** Payable subscription products for the pay-link picker. */
  products: { id: string; name: string; price: number; currency: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const action = request?.action ?? null;

  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [productId, setProductId] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sentToInbox, setSentToInbox] = useState(false);

  useEffect(() => {
    if (!request) return;
    setEmail(request.email ?? "");
    setAmount("");
    setReason("");
    setProductId(products[0]?.id ?? "");
    setLink(null);
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Payment link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy the link manually.");
    }
  }

  // Post the created link into the host's Wielo inbox thread (two-way support
  // channel) so they can pay straight from chat.
  function sendToInbox() {
    if (!link || !email.trim()) return;
    start(async () => {
      const r = await adminSendPlatformMessageByEmailAction({
        email: email.trim(),
        body: `💳 Here's your Wielo payment link:\n${link}`,
      });
      if (r.ok) {
        setSentToInbox(true);
        toast.success("Sent to the host's inbox.");
      } else {
        toast.error(r.error);
      }
    });
  }

  function submitLedger(type: "charge" | "refund" | "credit" | "adjustment") {
    const value = Number(amount);
    if (!email.trim()) {
      toast.error("Enter the host's email.");
      return;
    }
    if (!Number.isFinite(value) || value === 0) {
      toast.error("Enter a non-zero amount.");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Add a reason (min 3 characters).");
      return;
    }
    start(async () => {
      try {
        await recordManualLedgerEntryAction({
          hostEmail: email.trim(),
          type,
          amount: value,
          currency: "ZAR",
          reason: reason.trim(),
        });
        toast.success("Posted to the ledger.");
        onClose();
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Couldn't post the entry.",
        );
      }
    });
  }

  function createLink() {
    if (!email.trim()) {
      toast.error("Enter the host's email.");
      return;
    }
    if (!productId) {
      toast.error("Pick a product.");
      return;
    }
    start(async () => {
      try {
        const r = await createWieloPaymentLinkAction({
          email: email.trim(),
          productId,
        });
        setLink(r.url);
        toast.success("Payment link created — copy and send it.");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Couldn't create the link.",
        );
      }
    });
  }

  function submit() {
    if (action === "payment") return submitLedger("charge");
    if (action === "refund") return submitLedger("refund");
    if (action === "credit") return submitLedger("credit");
    if (action === "adjustment") return submitLedger("adjustment");
    if (action === "link") return createLink();
  }

  if (!action) return null;
  const meta = TITLES[action];
  const labelCls =
    "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute";
  const fieldCls =
    "w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none";

  return (
    <FormModal
      open={Boolean(request)}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={meta.title}
      description={meta.description}
    >
      <form
        id="wielo-finance-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        {/* user (host) — always shown */}
        <label className="block">
          <span className={labelCls}>Host email</span>
          <input
            type="email"
            list="wielo-users"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="host@example.com"
            className={fieldCls}
          />
          <datalist id="wielo-users">
            {users.map((u) => (
              <option key={u.email} value={u.email}>
                {u.name ?? u.email}
              </option>
            ))}
          </datalist>
        </label>

        {action === "link" ? (
          <>
            <label className="block">
              <span className={labelCls}>Product</span>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className={fieldCls}
              >
                {products.length === 0 ? (
                  <option value="">No products available</option>
                ) : null}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatMoney(p.price, p.currency)}
                  </option>
                ))}
              </select>
            </label>
            {link ? (
              <div className="rounded-[10px] border border-brand-line bg-brand-light/50 p-3">
                <div className={labelCls}>Payment link — send to the host</div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={link}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 truncate rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 font-mono text-[11.5px] text-brand-ink"
                  />
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-brand-line bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-brand-light"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={sendToInbox}
                  disabled={pending || sentToInbox}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-[8px] bg-brand-primary px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
                >
                  {sentToInbox ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5" />
                  )}
                  {sentToInbox ? "Sent to inbox" : "Send to host's inbox"}
                </button>
                <p className="mt-2 text-[11px] text-brand-mute">
                  The host pays by card or EFT. Once paid, the invoice + ledger
                  row appear here automatically. &ldquo;Send to inbox&rdquo;
                  posts it into their pinned Wielo thread.
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
              <label className="block">
                <span className={labelCls}>
                  Amount (ZAR)
                  {action === "adjustment" ? " · +/−" : ""}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={action === "adjustment" ? "-100" : "500"}
                  className={`${fieldCls} font-mono`}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Reason</span>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    action === "payment"
                      ? "e.g. EFT for Starter subscription"
                      : action === "refund"
                        ? "e.g. Refund of overcharge"
                        : action === "credit"
                          ? "e.g. Goodwill credit for downtime"
                          : "e.g. Billing correction"
                  }
                  className={fieldCls}
                />
              </label>
            </div>
            <p className="text-[11.5px] text-brand-mute">
              {action === "payment"
                ? "Records revenue into this host's Wielo account and issues an invoice (INV-)."
                : action === "refund"
                  ? "Records a refund out and issues a refund document (REF-)."
                  : action === "credit"
                    ? "Records a goodwill credit and issues a credit note (CN-)."
                    : "A signed correction — issues an adjustment document (CN-)."}
            </p>
          </>
        )}
      </form>

      <FormModalFooter>
        <FormModalCancel>Close</FormModalCancel>
        {action === "link" && link ? null : (
          <button
            type="submit"
            form="wielo-finance-form"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
          >
            {action === "payment" ? (
              <CreditCard className="h-3.5 w-3.5" />
            ) : action === "refund" ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : action === "credit" ? (
              <FileMinus className="h-3.5 w-3.5" />
            ) : action === "adjustment" ? (
              <SlidersHorizontal className="h-3.5 w-3.5" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            {action === "payment"
              ? "Record payment"
              : action === "refund"
                ? "Issue refund"
                : action === "credit"
                  ? "Give credit"
                  : action === "adjustment"
                    ? "Post adjustment"
                    : "Create link"}
          </button>
        )}
      </FormModalFooter>
    </FormModal>
  );
}
