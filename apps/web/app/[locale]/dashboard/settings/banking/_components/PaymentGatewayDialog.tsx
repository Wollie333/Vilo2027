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

import {
  savePaymentGatewayAction,
  savePaystackGatewayAction,
} from "../actions";
import {
  PAYMENT_GATEWAY_LABELS,
  paymentGatewaySchema,
  paystackGatewaySchema,
  type PaymentGateway,
  type PaymentGatewayInput,
  type PaystackGatewayInput,
} from "../schemas";

export type GatewayView = {
  business_id: string;
  gateway: PaymentGateway;
  environment: "test" | "live";
  public_identifier: string;
  secret_last4: string;
  statement_descriptor: string | null;
  is_enabled: boolean;
  last_validated_at: string | null;
  // Paystack dual-key fields (never the ciphers).
  mode?: "test" | "live";
  test_public_identifier?: string | null;
  test_secret_last4?: string | null;
  live_public_identifier?: string | null;
  live_secret_last4?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gateway: PaymentGateway;
  businessId: string;
  editing: GatewayView | null;
};

export function PaymentGatewayDialog(props: Props) {
  return props.gateway === "paystack" ? (
    <PaystackDialog {...props} />
  ) : (
    <PayPalDialog {...props} />
  );
}

// ── Paystack: both test + live keys, with an active mode ──────────
function PaystackDialog({ open, onOpenChange, businessId, editing }: Props) {
  const brandName = useBrandName();
  const [pending, start] = useTransition();

  const form = useForm<PaystackGatewayInput>({
    resolver: zodResolver(paystackGatewaySchema),
    defaultValues: {
      business_id: businessId,
      mode: "test",
      test_public_identifier: "",
      test_secret: "",
      live_public_identifier: "",
      live_secret: "",
      statement_descriptor: "",
      is_enabled: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      business_id: editing?.business_id ?? businessId,
      mode: editing?.mode ?? "test",
      test_public_identifier: editing?.test_public_identifier ?? "",
      test_secret: "",
      live_public_identifier: editing?.live_public_identifier ?? "",
      live_secret: "",
      statement_descriptor: editing?.statement_descriptor ?? "",
      is_enabled: editing?.is_enabled ?? true,
    });
  }, [open, editing, businessId, form]);

  function onSubmit(values: PaystackGatewayInput) {
    start(async () => {
      const result = await savePaystackGatewayAction({
        ...values,
        business_id: editing?.business_id ?? businessId,
      });
      if (result.ok) {
        toast.success(editing ? "Paystack updated" : "Paystack connected");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  const keepHint = (last4?: string | null) =>
    editing && last4 ? (
      <span className="font-normal text-brand-mute">
        (leave blank to keep ••••{last4})
      </span>
    ) : null;

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit Paystack" : "Connect Paystack"}
      description={`Add your test and live keys. Keys are validated, encrypted at rest, and settle payments directly into your own Paystack account — ${brandName} never takes a cut.`}
      size="lg"
    >
      <Form {...form}>
        <form
          id="payment-gateway-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-5"
          noValidate
        >
          {/* Active mode */}
          <FormField
            control={form.control}
            name="mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Active mode</FormLabel>
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
                    <SelectItem value="test">Test (no real charges)</SelectItem>
                    <SelectItem value="live">Live (real payments)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
                <p className="text-xs text-brand-mute">
                  Which keys charge guests right now. Add both, then flip to
                  live for launch — no need to re-enter anything.
                </p>
              </FormItem>
            )}
          />

          {/* TEST keys */}
          <fieldset className="space-y-3 rounded-card border border-brand-line p-3">
            <legend className="px-1 text-[11px] font-bold uppercase tracking-wider text-brand-mute">
              Test keys
            </legend>
            <FormField
              control={form.control}
              name="test_public_identifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Test public key</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      placeholder="pk_test_…"
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
              name="test_secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Test secret key {keepHint(editing?.test_secret_last4)}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="off"
                      placeholder="sk_test_…"
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          {/* LIVE keys */}
          <fieldset className="space-y-3 rounded-card border border-brand-line p-3">
            <legend className="px-1 text-[11px] font-bold uppercase tracking-wider text-brand-mute">
              Live keys
            </legend>
            <FormField
              control={form.control}
              name="live_public_identifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Live public key</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      placeholder="pk_live_…"
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
              name="live_secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Live secret key {keepHint(editing?.live_secret_last4)}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="off"
                      placeholder="sk_live_…"
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

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
                  Shown on the guest&rsquo;s bank statement. Banks truncate long
                  ones.
                </p>
              </FormItem>
            )}
          />

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
                    Accept card payments through Paystack
                  </FormLabel>
                  <p className="text-xs text-brand-mute">
                    Turn off to keep the keys saved but hide card payment at
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

// ── PayPal: single environment + client id/secret (unchanged) ─────
function PayPalDialog({ open, onOpenChange, businessId, editing }: Props) {
  const brandName = useBrandName();
  const [pending, start] = useTransition();

  const form = useForm<PaymentGatewayInput>({
    resolver: zodResolver(paymentGatewaySchema),
    defaultValues: {
      business_id: businessId,
      gateway: "paypal",
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
      business_id: editing?.business_id ?? businessId,
      gateway: "paypal",
      environment: editing?.environment ?? "live",
      public_identifier: editing?.public_identifier ?? "",
      secret: "",
      statement_descriptor: editing?.statement_descriptor ?? "",
      is_enabled: editing?.is_enabled ?? true,
    });
  }, [open, editing, businessId, form]);

  function onSubmit(values: PaymentGatewayInput) {
    start(async () => {
      const result = await savePaymentGatewayAction({
        ...values,
        gateway: "paypal",
        business_id: editing?.business_id ?? businessId,
      });
      if (result.ok) {
        toast.success(editing ? "PayPal updated" : "PayPal connected");
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
      title={editing ? "Edit PayPal" : "Connect PayPal"}
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
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="public_identifier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client ID</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    placeholder="Your PayPal REST app client id"
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
                  Client secret{" "}
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
                    Accept payments through {PAYMENT_GATEWAY_LABELS.paypal}
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
