"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Home, Info, Save, type LucideIcon } from "lucide-react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { saveListingPatchAction } from "../actions";
import type { EditorListing } from "../Editor";
import { roomsSchema, type RoomsInput } from "../schemas";

const MODE_NOTICE: Record<
  EditorListing["booking_mode"],
  { tone: "neutral" | "accent"; title: string; body: string }
> = {
  whole_listing: {
    tone: "neutral",
    title: "Whole-place mode — rooms are descriptive",
    body: "Guests book this listing as a whole. Rooms you add here describe what's inside (e.g. King master, twin guest) and show on the public page. Switch to per-room or flexible mode if you want guests to book individual rooms.",
  },
  rooms_only: {
    tone: "accent",
    title: "Per-room mode — each room is independently bookable",
    body: "Guests pick specific rooms on this listing. Pricing and capacity are set per-room.",
  },
  flexible: {
    tone: "accent",
    title: "Flexible mode — guests can pick rooms or buy out",
    body: "Guests can book individual rooms (per-room rates apply) or the whole place (listing-level rate). Both paths live alongside each other.",
  },
};

function toInt(v: string): number | null {
  if (v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function numToStr(v: number | null | undefined, fallback = ""): string {
  return v == null ? fallback : String(v);
}

import type { EditorRoom } from "../Editor";
import { RoomsManager } from "./RoomsManager";

export function RoomsTab({
  listing,
  rooms,
  onRoomsChange,
  autoCreate = false,
}: {
  listing: EditorListing;
  rooms: EditorRoom[];
  onRoomsChange: (rooms: EditorRoom[]) => void;
  autoCreate?: boolean;
}) {
  const notice = MODE_NOTICE[listing.booking_mode];
  return (
    <div className="space-y-6">
      <div
        className={`flex items-start gap-3 rounded-card border p-4 ${
          notice.tone === "accent"
            ? "border-brand-primary/40 bg-brand-accent/40"
            : "border-brand-line bg-brand-light/60"
        }`}
      >
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
            notice.tone === "accent"
              ? "bg-brand-primary text-white"
              : "bg-brand-accent text-brand-primary"
          }`}
        >
          <Info className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="font-display text-sm font-semibold text-brand-ink">
            {notice.title}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-brand-mute">
            {notice.body}
          </p>
        </div>
      </div>

      <RoomsManager
        listingId={listing.id}
        rooms={rooms}
        onChange={onRoomsChange}
        autoCreate={autoCreate}
      />
      <CapacityForm listing={listing} />
    </div>
  );
}

function CapacityForm({ listing }: { listing: EditorListing }) {
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
      if (result.ok) toast.success("Capacity & stay rules saved");
      else toast.error(result.error);
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Capacity &amp; stay rules
        </CardTitle>
        <CardDescription className="text-brand-mute">
          How many people fit overall, and how long a single booking can run.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
            noValidate
          >
            {/* Group 1 — physical space */}
            <section className="space-y-4">
              <GroupHeader
                icon={Home}
                title="The space"
                hint="The physical layout guests will see on the listing."
              />
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
                      <FormDescription>
                        Separate sleeping rooms.
                      </FormDescription>
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
                      <FormDescription>Full or shared.</FormDescription>
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
                      <FormDescription>Total the place sleeps.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <div className="border-t border-brand-line" />

            {/* Group 2 — stay length rules */}
            <section className="space-y-4">
              <GroupHeader
                icon={CalendarClock}
                title="Stay length"
                hint="The shortest and longest a single booking can run."
              />
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
                      <FormDescription>
                        Shortest booking allowed.
                      </FormDescription>
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
                      <FormDescription>
                        Leave blank for no upper limit.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <div className="flex justify-end">
              <Button type="submit" disabled={pending} className="gap-1.5">
                <Save className="h-4 w-4" />
                {pending ? "Saving…" : "Save capacity & stay rules"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

/** Small labelled header for a field group inside the capacity form. */
function GroupHeader({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-accent/50 text-brand-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="font-display text-sm font-semibold text-brand-ink">
          {title}
        </div>
        <p className="text-xs text-brand-mute">{hint}</p>
      </div>
    </div>
  );
}
