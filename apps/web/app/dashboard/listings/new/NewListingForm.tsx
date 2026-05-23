"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { createListingAction } from "./actions";
import { newListingSchema, type NewListingInput } from "./schemas";

const ACCOMMODATION_TYPES = [
  { value: "self_catering", label: "Self-catering" },
  { value: "bb", label: "B&B" },
  { value: "guesthouse", label: "Guesthouse" },
  { value: "lodge", label: "Lodge" },
  { value: "hotel", label: "Hotel" },
  { value: "other", label: "Other" },
] as const;

const EXPERIENCE_TYPES = [
  { value: "tour", label: "Tour" },
  { value: "activity", label: "Activity" },
  { value: "workshop", label: "Workshop" },
  { value: "transfer", label: "Transfer" },
  { value: "other", label: "Other" },
] as const;

export function NewListingForm() {
  const [pending, start] = useTransition();
  const form = useForm<NewListingInput>({
    resolver: zodResolver(newListingSchema),
    defaultValues: {
      name: "",
      listing_type: "accommodation",
      accommodation_type: undefined,
      experience_type: undefined,
    },
  });

  const listingType = form.watch("listing_type");

  function onSubmit(values: NewListingInput) {
    start(async () => {
      const result = await createListingAction(values);
      if (result && !result.ok) {
        toast.error(result.error);
      }
      // Success path is a server-side redirect; nothing to do here.
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Basics
        </CardTitle>
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Listing name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Karoo Stargazer Cottage"
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
              name="listing_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What is it?</FormLabel>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["accommodation", "experience"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => field.onChange(t)}
                        disabled={pending}
                        className={`rounded-card border p-4 text-left transition-colors ${
                          field.value === t
                            ? "border-brand-primary bg-brand-accent/50"
                            : "border-brand-line bg-white hover:bg-brand-light/60"
                        }`}
                      >
                        <div className="font-display text-base font-semibold capitalize text-brand-dark">
                          {t === "accommodation"
                            ? "A place to stay"
                            : "An experience"}
                        </div>
                        <div className="mt-1 text-xs text-brand-mute">
                          {t === "accommodation"
                            ? "Cottage, B&B, lodge, self-catering."
                            : "Tour, workshop, transfer, activity."}
                        </div>
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {listingType === "accommodation" ? (
              <FormField
                control={form.control}
                name="accommodation_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {ACCOMMODATION_TYPES.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => field.onChange(opt.value)}
                          disabled={pending}
                          className={`rounded border px-3 py-2 text-left text-sm transition-colors ${
                            field.value === opt.value
                              ? "border-brand-primary bg-brand-accent/50 text-brand-dark"
                              : "border-brand-line bg-white text-brand-mute hover:bg-brand-light/60"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {listingType === "experience" ? (
              <FormField
                control={form.control}
                name="experience_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {EXPERIENCE_TYPES.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => field.onChange(opt.value)}
                          disabled={pending}
                          className={`rounded border px-3 py-2 text-left text-sm transition-colors ${
                            field.value === opt.value
                              ? "border-brand-primary bg-brand-accent/50 text-brand-dark"
                              : "border-brand-line bg-white text-brand-mute hover:bg-brand-light/60"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={pending}
                className="gap-1.5"
              >
                {pending ? "Creating…" : "Create draft"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
