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
  const form = useForm<PricingInput>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      base_price: numToStr(listing.base_price),
      weekend_price: numToStr(listing.weekend_price),
      cleaning_fee: numToStr(listing.cleaning_fee),
      whole_listing_discount_pct: numToStr(listing.whole_listing_discount_pct),
      weekly_discount_pct: numToStr(listing.weekly_discount_pct),
      monthly_discount_pct: numToStr(listing.monthly_discount_pct),
      currency: listing.currency || "ZAR",
    },
  });

  function onSubmit(values: PricingInput) {
    start(async () => {
      const result = await saveListingPatchAction(listing.id, {
        base_price: toMoney(values.base_price),
        weekend_price: toMoney(values.weekend_price),
        cleaning_fee: toMoney(values.cleaning_fee),
        whole_listing_discount_pct: toMoney(values.whole_listing_discount_pct),
        weekly_discount_pct: toMoney(values.weekly_discount_pct),
        monthly_discount_pct: toMoney(values.monthly_discount_pct),
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
          Per-night rate and add-ons. All values in your listing currency
          (defaults to ZAR).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
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

            <div className="rounded-card border border-brand-line bg-brand-light/40 p-4">
              <div className="font-display text-sm font-semibold text-brand-dark">
                Discounts{" "}
                <span className="font-normal text-brand-mute">(optional)</span>
              </div>
              <p className="mt-0.5 text-xs text-brand-mute">
                Applied automatically at checkout. Whole-place needs every
                active room booked together; length-of-stay kicks in at 7+ / 28+
                nights.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="whole_listing_discount_pct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Whole-place %</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={90}
                          step="1"
                          placeholder="10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="weekly_discount_pct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weekly % (7+ nights)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={90}
                          step="1"
                          placeholder="5"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="monthly_discount_pct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly % (28+ nights)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={90}
                          step="1"
                          placeholder="10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

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
