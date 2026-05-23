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
import {
  ACCOMMODATION_TYPES,
  EXPERIENCE_TYPES,
  basicSchema,
  type BasicInput,
} from "../schemas";

export function BasicTab({ listing }: { listing: EditorListing }) {
  const [pending, start] = useTransition();
  const form = useForm<BasicInput>({
    resolver: zodResolver(basicSchema),
    defaultValues: {
      name: listing.name,
      accommodation_type:
        listing.accommodation_type as BasicInput["accommodation_type"],
      experience_type: listing.experience_type as BasicInput["experience_type"],
      description: listing.description ?? "",
    },
  });

  function onSubmit(values: BasicInput) {
    start(async () => {
      const patch = {
        name: values.name,
        accommodation_type:
          listing.listing_type === "accommodation"
            ? (values.accommodation_type ?? null)
            : null,
        experience_type:
          listing.listing_type === "experience"
            ? (values.experience_type ?? null)
            : null,
        description:
          values.description && values.description.length > 0
            ? values.description
            : null,
      };
      const result = await saveListingPatchAction(listing.id, patch);
      if (result.ok) toast.success("Basic info saved");
      else toast.error(result.error);
    });
  }

  const options =
    listing.listing_type === "accommodation"
      ? ACCOMMODATION_TYPES
      : EXPERIENCE_TYPES;
  const typeField =
    listing.listing_type === "accommodation"
      ? ("accommodation_type" as const)
      : ("experience_type" as const);

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Basic info
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Name, type and description guests will read first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Listing name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={typeField}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {listing.listing_type === "accommodation"
                      ? "Accommodation type"
                      : "Experience type"}
                  </FormLabel>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {options.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
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

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description{" "}
                    <span className="font-normal text-brand-mute">
                      (plain text for now — rich editor lands later)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={8} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={pending} className="gap-1.5">
                <Save className="h-4 w-4" />
                {pending ? "Saving…" : "Save basic info"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
