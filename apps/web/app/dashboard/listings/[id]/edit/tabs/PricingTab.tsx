"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { saveListingPatchAction } from "../actions";
import type { EditorListing } from "../Editor";
import { pricingSchema, type PricingInput } from "../schemas";

function toMoney(v: string): number | null {
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function numToStr(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

export function PricingTab({ listing }: { listing: EditorListing }) {
  const [pending, start] = useTransition();
  const isExperience = listing.listing_type === "experience";
  const form = useForm<PricingInput>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      base_price: numToStr(listing.base_price),
      weekend_price: numToStr(listing.weekend_price),
      cleaning_fee: numToStr(listing.cleaning_fee),
      private_group_price: numToStr(listing.private_group_price),
      currency: listing.currency || "ZAR",
    },
  });

  function onSubmit(values: PricingInput) {
    start(async () => {
      const result = await saveListingPatchAction(listing.id, {
        base_price: toMoney(values.base_price),
        // Weekend rate + cleaning fee don't apply to experiences — clear them
        // server-side so the saved row matches what the host sees.
        weekend_price: isExperience ? null : toMoney(values.weekend_price),
        cleaning_fee: isExperience ? null : toMoney(values.cleaning_fee),
        private_group_price: isExperience
          ? toMoney(values.private_group_price)
          : null,
        currency: values.currency || "ZAR",
      });
      if (result.ok) toast.success("Pricing saved");
      else toast.error(result.error);
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Pricing
        </CardTitle>
        <CardDescription className="text-brand-mute">
          {isExperience
            ? "Per-person rate and optional private-group buy-out price. All values in your listing currency (defaults to ZAR)."
            : "Per-night rate and add-ons. All values in your listing currency (defaults to ZAR)."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            {isExperience ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="base_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price per person</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          placeholder="450"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="private_group_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Private group rate{" "}
                        <span className="font-normal text-brand-mute">
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          placeholder="2500"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-brand-mute">
                        Flat price for a guest who books the whole session up to
                        max participants.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="base_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base price / night</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          placeholder="1200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="weekend_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Weekend price{" "}
                        <span className="font-normal text-brand-mute">
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cleaning_fee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Cleaning fee{" "}
                        <span className="font-normal text-brand-mute">
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem className="max-w-[180px]">
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input maxLength={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={pending} className="gap-1.5">
                <Save className="h-4 w-4" />
                {pending ? "Saving…" : "Save pricing"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
