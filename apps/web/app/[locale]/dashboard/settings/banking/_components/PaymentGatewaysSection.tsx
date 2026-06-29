"use client";

import {
  CheckCircle2,
  CreditCard,
  Globe,
  Link2,
  Loader2,
  MoreVertical,
  Plug,
  PlugZap,
  XCircle,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useBrandName } from "@/components/brand/BrandProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  deletePaymentGatewayAction,
  setDefaultCurrencyAction,
  testPaymentGatewayAction,
  togglePaymentGatewayAction,
} from "../actions";
import {
  PAYMENT_GATEWAYS,
  PAYMENT_GATEWAY_LABELS,
  type Currency,
  type PaymentGateway,
} from "../schemas";

import { PaymentGatewayDialog, type GatewayView } from "./PaymentGatewayDialog";
import { PaymentLinkDialog } from "./PaymentLinkDialog";

const GATEWAY_BLURB: Record<PaymentGateway, string> = {
  paystack: "Cards & EFT in ZAR. The default for South African guests.",
  paypal: "International cards in USD — converted from your ZAR prices.",
};

const GATEWAY_ICON: Record<PaymentGateway, typeof CreditCard> = {
  paystack: CreditCard,
  paypal: Globe,
};

export function PaymentGatewaysSection({
  gateways,
  businesses,
  defaultCurrency,
}: {
  gateways: GatewayView[];
  businesses: { id: string; name: string }[];
  defaultCurrency: Currency;
}) {
  const brandName = useBrandName();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogGateway, setDialogGateway] =
    useState<PaymentGateway>("paystack");
  const [editing, setEditing] = useState<GatewayView | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [pending, start] = useTransition();
  // Gateways are per-business; the selector scopes the rows + every action.
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  // Per-gateway live connection-test result.
  const [testState, setTestState] = useState<
    Record<string, "loading" | "ok" | "fail" | undefined>
  >({});

  function handleTest(g: PaymentGateway) {
    setTestState((s) => ({ ...s, [g]: "loading" }));
    start(async () => {
      const r = await testPaymentGatewayAction(businessId, g);
      if (r.ok) {
        setTestState((s) => ({ ...s, [g]: "ok" }));
        toast.success(
          `Connection OK — ${r.mode === "live" ? "Live" : "Test"} mode.`,
        );
      } else {
        setTestState((s) => ({ ...s, [g]: "fail" }));
        toast.error(r.error);
      }
    });
  }

  const byKind = (g: PaymentGateway) =>
    gateways.find(
      (row) => row.gateway === g && row.business_id === businessId,
    ) ?? null;

  function openConnect(g: PaymentGateway) {
    setDialogGateway(g);
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(view: GatewayView) {
    setDialogGateway(view.gateway);
    setEditing(view);
    setDialogOpen(true);
  }

  function handleToggle(g: PaymentGateway, enabled: boolean) {
    start(async () => {
      const result = await togglePaymentGatewayAction(businessId, g, enabled);
      if (result.ok)
        toast.success(enabled ? "Gateway enabled" : "Gateway disabled");
      else toast.error(result.error);
    });
  }

  function handleRemove(g: PaymentGateway) {
    start(async () => {
      const result = await deletePaymentGatewayAction(businessId, g);
      if (result.ok) toast.success("Gateway removed");
      else toast.error(result.error);
    });
  }

  function handleCurrency(value: string) {
    start(async () => {
      const result = await setDefaultCurrencyAction({
        default_currency: value as Currency,
      });
      if (result.ok) toast.success("Default currency updated");
      else toast.error(result.error);
    });
  }

  return (
    <>
      <div className="rounded-card border border-brand-line bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-brand-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">
              Payment gateways
            </h3>
            <p className="mt-0.5 text-xs text-brand-mute">
              Connect your own Paystack and PayPal accounts — payments settle
              directly to you, with <strong>0% taken by {brandName}</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-brand-mute">
              Default currency
            </label>
            <Select
              value={defaultCurrency}
              onValueChange={handleCurrency}
              disabled={pending}
            >
              <SelectTrigger className="h-9 w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ZAR">ZAR · Paystack</SelectItem>
                <SelectItem value="USD">USD · PayPal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {businesses.length > 1 ? (
          <div className="flex items-center gap-2 border-b border-brand-line bg-brand-light/30 px-5 py-3">
            <span className="text-xs font-semibold text-brand-mute">
              Business
            </span>
            <Select value={businessId} onValueChange={setBusinessId}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[11px] text-brand-mute">
              Each business has its own gateways.
            </span>
          </div>
        ) : null}

        <ul className="divide-y divide-brand-line">
          {PAYMENT_GATEWAYS.map((g) => {
            const view = byKind(g);
            const Icon = GATEWAY_ICON[g];
            return (
              <li
                key={g}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-light text-brand-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-semibold text-brand-ink">
                        {PAYMENT_GATEWAY_LABELS[g]}
                      </span>
                      {view ? (
                        view.is_enabled ? (
                          <Badge className="gap-1 bg-brand-accent text-brand-secondary hover:bg-brand-accent">
                            <CheckCircle2 className="h-3 w-3" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline">Disabled</Badge>
                        )
                      ) : (
                        <Badge variant="outline">Not connected</Badge>
                      )}
                      {view
                        ? (() => {
                            const live =
                              g === "paystack"
                                ? view.mode === "live"
                                : view.environment === "live";
                            return (
                              <Badge
                                variant="outline"
                                className={`uppercase ${
                                  live
                                    ? "border-emerald-300 text-emerald-700"
                                    : "border-amber-300 text-amber-700"
                                }`}
                              >
                                {live ? "Live" : "Test"}
                              </Badge>
                            );
                          })()
                        : null}
                    </div>
                    {view ? (
                      <p className="mt-0.5 text-sm text-brand-ink">
                        Secret{" "}
                        <span className="font-mono">
                          ••••
                          {g === "paystack"
                            ? ((view.mode === "live"
                                ? view.live_secret_last4
                                : view.test_secret_last4) ?? "----")
                            : view.secret_last4}
                        </span>
                        {g === "paystack" ? (
                          <>
                            {" "}
                            ·{" "}
                            <span className="text-brand-mute">
                              test {view.test_secret_last4 ? "✓" : "—"} · live{" "}
                              {view.live_secret_last4 ? "✓" : "—"}
                            </span>
                          </>
                        ) : null}
                        {view.statement_descriptor ? (
                          <>
                            {" "}
                            · statement &ldquo;{view.statement_descriptor}
                            &rdquo;
                          </>
                        ) : null}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-brand-mute">
                        {GATEWAY_BLURB[g]}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {g === "paystack" && view && view.is_enabled ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => setLinkOpen(true)}
                      disabled={pending}
                    >
                      <Link2 className="h-4 w-4" />
                      Request payment
                    </Button>
                  ) : null}

                  {view ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleTest(g)}
                        disabled={pending}
                        className={`gap-1.5 ${
                          testState[g] === "ok"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:text-emerald-700"
                            : testState[g] === "fail"
                              ? "border-red-300 bg-red-50 text-red-600 hover:text-red-600"
                              : ""
                        }`}
                      >
                        {testState[g] === "loading" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : testState[g] === "ok" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : testState[g] === "fail" ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <PlugZap className="h-4 w-4" />
                        )}
                        {testState[g] === "ok"
                          ? "Connected"
                          : testState[g] === "fail"
                            ? "Failed"
                            : "Test"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(view)}
                        disabled={pending}
                      >
                        Edit
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={pending}
                            aria-label="More actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={pending}
                            onClick={() => handleToggle(g, !view.is_enabled)}
                          >
                            {view.is_enabled ? "Disable" : "Enable"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={pending}
                            onClick={() => handleRemove(g)}
                            className="text-status-cancelled focus:text-status-cancelled"
                          >
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => openConnect(g)}
                      disabled={pending}
                    >
                      <Plug className="h-4 w-4" />
                      Connect
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <PaymentGatewayDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        gateway={dialogGateway}
        businessId={businessId}
        editing={editing}
      />
      <PaymentLinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        businessId={businessId}
      />
    </>
  );
}
