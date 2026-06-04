"use client";

import {
  CheckCircle2,
  CreditCard,
  Globe,
  Link2,
  MoreVertical,
  Plug,
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
  defaultCurrency,
}: {
  gateways: GatewayView[];
  defaultCurrency: Currency;
}) {
  const brandName = useBrandName();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogGateway, setDialogGateway] =
    useState<PaymentGateway>("paystack");
  const [editing, setEditing] = useState<GatewayView | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [pending, start] = useTransition();

  const byKind = (g: PaymentGateway) =>
    gateways.find((row) => row.gateway === g) ?? null;

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
      const result = await togglePaymentGatewayAction(g, enabled);
      if (result.ok)
        toast.success(enabled ? "Gateway enabled" : "Gateway disabled");
      else toast.error(result.error);
    });
  }

  function handleRemove(g: PaymentGateway) {
    start(async () => {
      const result = await deletePaymentGatewayAction(g);
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
                      {view?.environment === "test" ? (
                        <Badge variant="outline" className="uppercase">
                          Test
                        </Badge>
                      ) : null}
                    </div>
                    {view ? (
                      <p className="mt-0.5 text-sm text-brand-ink">
                        Secret{" "}
                        <span className="font-mono">
                          ••••{view.secret_last4}
                        </span>
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
        editing={editing}
      />
      <PaymentLinkDialog open={linkOpen} onOpenChange={setLinkOpen} />
    </>
  );
}
