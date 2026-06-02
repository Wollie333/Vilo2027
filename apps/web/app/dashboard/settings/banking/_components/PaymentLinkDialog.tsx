"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, ExternalLink, Link2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";

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

import { createPaymentLinkAction } from "../actions";
import { paymentLinkSchema, type PaymentLinkInput } from "../schemas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PaymentLinkDialog({ open, onOpenChange }: Props) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<{ url: string; reference: string } | null>(
    null,
  );

  const form = useForm<PaymentLinkInput>({
    // amount uses z.coerce.number(), so the resolver's input type is `unknown`;
    // cast to the form's output type (standard RHF + zod-coerce pattern).
    resolver: zodResolver(paymentLinkSchema) as Resolver<PaymentLinkInput>,
    defaultValues: { amount: 0, email: "", description: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ amount: 0, email: "", description: "" });
      setLink(null);
    }
  }, [open, form]);

  function onSubmit(values: PaymentLinkInput) {
    start(async () => {
      const result = await createPaymentLinkAction(values);
      if (result.ok) {
        setLink({ url: result.url, reference: result.reference });
        toast.success("Payment link created");
      } else {
        toast.error(result.error);
      }
    });
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link.url);
    toast.success("Link copied");
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Request a payment"
      description="Generate a Paystack link that charges in ZAR and settles straight into your own account."
      size="lg"
    >
      {link ? (
        <div className="space-y-4">
          <div className="rounded-card border border-brand-line bg-brand-light/40 p-4">
            <p className="text-xs font-medium text-brand-mute">Payment link</p>
            <p className="mt-1 break-all font-mono text-sm text-brand-ink">
              {link.url}
            </p>
            <p className="mt-2 text-xs text-brand-mute">
              Reference: <span className="font-mono">{link.reference}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={copyLink} className="gap-1.5">
              <Copy className="h-4 w-4" />
              Copy link
            </Button>
            <Button type="button" variant="outline" asChild className="gap-1.5">
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open
              </a>
            </Button>
          </div>
          <FormModalFooter>
            <FormModalCancel>Done</FormModalCancel>
          </FormModalFooter>
        </div>
      ) : (
        <>
          <Form {...form}>
            <form
              id="payment-link-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (ZAR)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="off"
                          placeholder="guest@email.com"
                          disabled={pending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Description{" "}
                      <span className="font-normal text-brand-mute">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        placeholder="e.g. Deposit for July stay"
                        disabled={pending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>

          <FormModalFooter>
            <FormModalCancel disabled={pending}>Cancel</FormModalCancel>
            <Button
              type="submit"
              form="payment-link-form"
              disabled={pending}
              className="gap-1.5"
            >
              <Link2 className="h-4 w-4" />
              {pending ? "Creating…" : "Create link"}
            </Button>
          </FormModalFooter>
        </>
      )}
    </FormModal>
  );
}
