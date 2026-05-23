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
import { roomsSchema, type RoomsInput } from "../schemas";

function toInt(v: string): number | null {
  if (v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function numToStr(v: number | null | undefined, fallback = ""): string {
  return v == null ? fallback : String(v);
}

export function RoomsTab({ listing }: { listing: EditorListing }) {
  const [pending, start] = useTransition();
  const form = useForm<RoomsInput>({
    resolver: zodResolver(roomsSchema),
    defaultValues: {
      bedrooms: numToStr(listing.bedrooms),
      bathrooms: numToStr(listing.bathrooms),
      max_guests: numToStr(listing.max_guests),
      min_nights: numToStr(listing.min_nights, "1"),
      max_nights: numToStr(listing.max_nights),
    },
  });

  function onSubmit(values: RoomsInput) {
    start(async () => {
      const result = await saveListingPatchAction(listing.id, {
        bedrooms: toInt(values.bedrooms),
        bathrooms: toInt(values.bathrooms),
        max_guests: toInt(values.max_guests),
        min_nights: toInt(values.min_nights),
        max_nights: toInt(values.max_nights),
      });
      if (result.ok) toast.success("Rooms & capacity saved");
      else toast.error(result.error);
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Rooms &amp; capacity
        </CardTitle>
        <CardDescription className="text-brand-mute">
          How many people fit, and how long they can stay.
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
                name="bedrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bedrooms</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bathrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bathrooms</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="max_guests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max guests</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="min_nights"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum nights</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="max_nights"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Maximum nights{" "}
                      <span className="font-normal text-brand-mute">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={pending} className="gap-1.5">
                <Save className="h-4 w-4" />
                {pending ? "Saving…" : "Save rooms & capacity"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
