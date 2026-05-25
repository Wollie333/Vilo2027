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
import { logisticsSchema, type LogisticsInput } from "../schemas";

function toIntOrNull(v: string): number | null {
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function numToStr(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

export function LogisticsTab({ listing }: { listing: EditorListing }) {
  const [pending, start] = useTransition();
  const form = useForm<LogisticsInput>({
    resolver: zodResolver(logisticsSchema),
    defaultValues: {
      duration_minutes: numToStr(listing.duration_minutes),
      max_participants: numToStr(listing.max_participants),
      min_participants: numToStr(listing.min_participants),
      meeting_point: listing.meeting_point ?? "",
      what_to_bring: listing.what_to_bring ?? "",
    },
  });

  function onSubmit(values: LogisticsInput) {
    start(async () => {
      const result = await saveListingPatchAction(listing.id, {
        duration_minutes: toIntOrNull(values.duration_minutes),
        max_participants: toIntOrNull(values.max_participants),
        min_participants: toIntOrNull(values.min_participants),
        meeting_point:
          values.meeting_point && values.meeting_point.length > 0
            ? values.meeting_point
            : null,
        what_to_bring:
          values.what_to_bring && values.what_to_bring.length > 0
            ? values.what_to_bring
            : null,
      });
      if (result.ok) toast.success("Logistics saved");
      else toast.error(result.error);
    });
  }

  const duration = Number(form.watch("duration_minutes"));
  const durationHelp =
    Number.isFinite(duration) && duration > 0
      ? formatDuration(duration)
      : "e.g. 180 for a 3-hour tour";

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Logistics
        </CardTitle>
        <CardDescription className="text-brand-mute">
          How long, how many, where to meet, what to bring. Shown to guests
          before they book.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step="1"
                        placeholder="180"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-brand-mute">{durationHelp}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="max_participants"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max participants</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step="1"
                        placeholder="8"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="min_participants"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Min to confirm{" "}
                      <span className="font-normal text-brand-mute">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step="1"
                        placeholder="1"
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
              name="meeting_point"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meeting point</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Meet at the kiosk near the harbour wall. Look for the orange Vilo flag."
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-brand-mute">
                    Shown to guests after booking. Be specific — landmarks help.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="what_to_bring"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    What to bring{" "}
                    <span className="font-normal text-brand-mute">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Sunscreen, water, comfortable walking shoes, a light jacket."
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
                {pending ? "Saving…" : "Save logistics"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function formatDuration(minutes: number): string {
  const m = Math.trunc(minutes);
  if (m < 60) return `${m} min`;
  const hours = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours}h ${rem}min`;
}
