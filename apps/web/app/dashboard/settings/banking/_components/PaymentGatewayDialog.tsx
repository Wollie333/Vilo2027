"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { useBrandName } from "@/components/brand/BrandProvider";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { savePaymentGatewayAction } from "../actions";
import {
  PAYMENT_GATEWAY_LABELS,
  paymentGatewaySchema,
  type PaymentGateway,
  type PaymentGatewayInput,
} from "../schemas";

export type GatewayView = {
  gateway: PaymentGateway;
  environment: "test" | "live";
  public_identifier: string;
  secret_last4: string;
  statement_descriptor: string | null;
  is_enabled: boolean;
  last_validated_at: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gateway: PaymentGateway;
  editing: GatewayView | null;
};

const COPY: Record<
  PaymentGateway,
  { publicLabel: string; publicHint: string; secretLabel: string }
> = {
  paystack: {
    publicLabel: "Public key",
    publicHint: "pk_live_… or pk_test_…",
    secretLabel: "Secret key",
  },
  paypal: {
    publicLabel: "Client ID",
    publicHint: "Your PayPal REST app client id",
    secretLabel: "Client secret",
  },
};

export function PaymentGatewayDialog({
  open,
  onOpenChange,
  gateway,
  editing,
}: Props) {
  const brandName = useBrandName();
  const [pending, start] = useTransition();
  const copy = COPY[gateway];

  const form = useForm<PaymentGatewayInput>({
    resolver: zodResolver(paymentGatewaySchema),
    defaultValues: {
      gateway,
      environment: "live",
      public_identifier: "",
      secret: "",
      statement_descriptor: "",
      is_enabled: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      gateway,
      environment: editing?.environment ?? "live",
      public_identifier: editing?.public_identifier ?? "",
      secret: "",
      statement_descriptor: editing?.statement_descriptor ?? "",
      is_enabled: editing?.is_enabled ?? true,
    });
  }, [open, editing, gateway, form]);

  function onSubmit(values: PaymentGatewayInput) {
    start(async () => {
      const result = await savePaymentGatewayAction({ ...values, gateway });
      if (result.ok) {
        toast.success(
          editing
            ? `${PAYMENT_GATEWAY_LABELS[gateway]} updated`
            : `${PAYMENT_GATEWAY_LABELS[gateway]} connected`,
        );
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        editing
          ? `Edit ${PAYMENT_GATEWAY_LABELS[gateway]}`
          : `Connect ${PAYMENT_GATEWAY_LABELS[gateway]}`
      }
      description={`Your keys are validated, encrypted at rest, and used to settle payments directly into your own account. ${brandName} never takes a cut.`}
      size="lg"
    >
      <Form {...form}>
        <form
          id="payment-gateway-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="environment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Environment</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={pending}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="live">Live (real payments)</SelectItem>
                    <SelectItem value="test">Test / sandbox</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
                {gateway === "paystack" ? (
                  <p className="text-xs text-brand-mute">
                    Detected automatically from your secret key prefix.
                  </p>
                ) : null}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="public_identifier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy.publicLabel}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    placeholder={copy.publicHint}
                    disabled={pending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="secret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {copy.secretLabel}{" "}
                  {editing ? (
                    <span className="font-normal text-brand-mute">
                      (leave blank to keep ••••{editing.secret_last4})
                    </span>
                  ) : null}
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder={
                      editing ? "••••••••••••" : "Pasted once, then encrypted"
                    }
                    disabled={pending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {gateway === "paystack" ? (
            <FormField
              control={form.control}
              name="statement_descriptor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Statement descriptor{" "}
                    <span className="font-normal text-brand-mute">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      placeholder="e.g. SEASIDE VILLA"
                      maxLength={22}
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-brand-mute">
                    The word shown on the guest&rsquo;s bank statement for
                    payments to you. Keep it short — banks truncate long ones.
                  </p>
                </FormItem>
              )}
            />
          ) : null}

          <FormField
            control={form.control}
            name="is_enabled"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3 rounded-card border border-brand-line bg-brand-light/40 p-3">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    disabled={pending}
                    className="h-4 w-4 rounded border-brand-line accent-brand-primary"
                  />
                </FormControl>
                <div className="flex-1">
                  <FormLabel className="!m-0 cursor-pointer">
                    Accept payments through {PAYMENT_GATEWAY_LABELS[gateway]}
                  </FormLabel>
                  <p className="text-xs text-brand-mute">
                    Turn off to keep the keys saved but hide this option at
                    checkout.
                  </p>
                </div>
              </FormItem>
            )}
          />
        </form>
      </Form>

      <FormModalFooter>
        <FormModalCancel disabled={pending}>Cancel</FormModalCancel>
        <Button
          type="submit"
          form="payment-gateway-form"
          disabled={pending}
          className="gap-1.5"
        >
          <Save className="h-4 w-4" />
          {pending
            ? "Validating…"
            : editing
              ? "Save changes"
              : "Connect & validate"}
        </Button>
      </FormModalFooter>
    </FormModal>
  );
}
