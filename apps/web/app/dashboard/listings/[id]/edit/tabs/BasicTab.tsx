"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useState, useTransition } from "react";
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
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { saveListingPatchAction, setBookingModeAction } from "../actions";
import type { EditorListing } from "../Editor";
import {
  ACCOMMODATION_TYPES,
  BOOKING_MODES,
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
    <div className="space-y-6">
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        disabled={pending}
                        placeholder="Tell guests what makes this place special. Mornings, the views, the breakfast, the why behind it."
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-brand-mute">
                      Bold what matters, use headings for sections like
                      &ldquo;The space&rdquo; or &ldquo;The
                      neighbourhood&rdquo;.
                    </p>
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

      {listing.listing_type === "accommodation" ? (
        <BookingModeCard listing={listing} />
      ) : null}
    </div>
  );
}

function BookingModeCard({ listing }: { listing: EditorListing }) {
  const [mode, setMode] = useState<EditorListing["booking_mode"]>(
    listing.booking_mode,
  );
  const [savePending, startSave] = useTransition();

  function save() {
    startSave(async () => {
      const result = await setBookingModeAction(listing.id, {
        booking_mode: mode,
      });
      if (result.ok) {
        toast.success("Booking mode saved");
      } else {
        toast.error(result.error);
        // Revert local state on rejection.
        setMode(listing.booking_mode);
      }
    });
  }

  const dirty = mode !== listing.booking_mode;

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Booking mode
        </CardTitle>
        <CardDescription className="text-brand-mute">
          How guests book this place. Switch any time — rooms you&rsquo;ve added
          are kept either way.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {BOOKING_MODES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              disabled={savePending}
              className={`rounded-card border p-4 text-left transition-colors ${
                mode === opt.value
                  ? "border-brand-primary bg-brand-accent/50"
                  : "border-brand-line bg-white hover:bg-brand-light/60"
              }`}
            >
              <div className="font-display text-sm font-semibold text-brand-dark">
                {opt.label}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-brand-mute">
                {opt.body}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            onClick={save}
            disabled={!dirty || savePending}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {savePending ? "Saving…" : "Save booking mode"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
