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
import { Textarea } from "@/components/ui/textarea";

import { saveListingPatchAction } from "../actions";
import type { EditorListing } from "../Editor";
import { policiesSchema, type PoliciesInput } from "../schemas";

const CANCELLATION_OPTIONS = [
  {
    value: "flexible" as const,
    name: "Flexible",
    body: "Full refund up to 24 hours before check-in.",
  },
  {
    value: "moderate" as const,
    name: "Moderate",
    body: "Full refund up to 5 days before check-in.",
  },
  {
    value: "strict" as const,
    name: "Strict",
    body: "50% refund up to 7 days before. No refund after.",
  },
];

export function PoliciesTab({ listing }: { listing: EditorListing }) {
  const [pending, start] = useTransition();
  const form = useForm<PoliciesInput>({
    resolver: zodResolver(policiesSchema),
    defaultValues: {
      check_in_time: listing.check_in_time?.slice(0, 5) ?? "",
      check_out_time: listing.check_out_time?.slice(0, 5) ?? "",
      cancellation_policy: listing.cancellation_policy,
      house_rules: listing.house_rules ?? "",
    },
  });

  function onSubmit(values: PoliciesInput) {
    start(async () => {
      const result = await saveListingPatchAction(listing.id, {
        check_in_time:
          values.check_in_time && values.check_in_time.length > 0
            ? `${values.check_in_time}:00`
            : null,
        check_out_time:
          values.check_out_time && values.check_out_time.length > 0
            ? `${values.check_out_time}:00`
            : null,
        cancellation_policy: values.cancellation_policy,
        house_rules:
          values.house_rules && values.house_rules.length > 0
            ? values.house_rules
            : null,
      });
      if (result.ok) toast.success("Policies saved");
      else toast.error(result.error);
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Policies
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Check-in/out, house rules and cancellation. Full Policy Manager
          (per-policy versioning, snapshots) lands later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="check_in_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check-in time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="check_out_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check-out time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="cancellation_policy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cancellation policy</FormLabel>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {CANCELLATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
                        className={`rounded-card border p-4 text-left transition-colors ${
                          field.value === opt.value
                            ? "border-brand-primary bg-brand-accent/50"
                            : "border-brand-line bg-white hover:bg-brand-light/60"
                        }`}
                      >
                        <div className="font-display text-sm font-semibold text-brand-dark">
                          {opt.name}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-brand-mute">
                          {opt.body}
                        </p>
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="house_rules"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    House rules{" "}
                    <span className="font-normal text-brand-mute">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder="Quiet hours after 10pm, no smoking inside, etc."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={pending} className="gap-1.5">
                <Save className="h-4 w-4" />
                {pending ? "Saving…" : "Save policies"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
