"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Zap } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { saveListingPatchAction } from "../actions";
import type { EditorListing } from "../Editor";
import { settingsSchema, type SettingsInput } from "../schemas";

export function SettingsTab({ listing }: { listing: EditorListing }) {
  const [pending, start] = useTransition();
  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      instant_booking: listing.instant_booking,
    },
  });

  function onSubmit(values: SettingsInput) {
    start(async () => {
      const result = await saveListingPatchAction(listing.id, {
        instant_booking: values.instant_booking,
      });
      if (result.ok) toast.success("Booking settings saved");
      else toast.error(result.error);
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Booking settings
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Toggle instant booking on once you&rsquo;re comfortable accepting
          unknown guests on the spot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            <FormField
              control={form.control}
              name="instant_booking"
              render={({ field }) => (
                <FormItem>
                  <label className="flex cursor-pointer items-start gap-3 rounded-card border border-brand-line bg-white p-4 hover:bg-brand-light/60">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                        className="mt-0.5"
                      />
                    </FormControl>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-brand-secondary" />
                        <FormLabel className="text-sm font-semibold text-brand-dark">
                          Allow instant booking
                        </FormLabel>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-brand-mute">
                        Approved guests can book without waiting for your
                        confirmation. You can switch this off any time.
                      </p>
                    </div>
                  </label>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded border border-brand-line bg-brand-accent/40 p-4 text-xs text-brand-ink">
              <div className="font-semibold text-brand-dark">
                Payment methods
              </div>
              <p className="mt-1 leading-relaxed text-brand-mute">
                All listings accept Paystack (cards + instant EFT) and manual
                EFT once the booking flow ships in Phase 2. PayPal opens on Pro
                and above.
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={pending} className="gap-1.5">
                <Save className="h-4 w-4" />
                {pending ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
