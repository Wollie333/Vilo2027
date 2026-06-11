"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Lock, Save, Wifi } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

import { updateRoomAccessAction } from "../../../actions";
import { listingAccessSchema, type ListingAccessInput } from "../../../schemas";

export type RoomAccessInitial = {
  check_in_method: string | null;
  check_in_instructions: string | null;
  gate_code: string | null;
  door_code: string | null;
  wifi_network: string | null;
  wifi_password: string | null;
};

export function RoomAccessSection({
  listingId,
  roomId,
  access,
}: {
  listingId: string;
  roomId: string;
  access: RoomAccessInitial | null;
}) {
  const [pending, start] = useTransition();
  const form = useForm<ListingAccessInput>({
    resolver: zodResolver(listingAccessSchema),
    defaultValues: {
      check_in_method: access?.check_in_method ?? "",
      check_in_instructions: access?.check_in_instructions ?? "",
      gate_code: access?.gate_code ?? "",
      door_code: access?.door_code ?? "",
      wifi_network: access?.wifi_network ?? "",
      wifi_password: access?.wifi_password ?? "",
    },
  });

  function onSubmit(values: ListingAccessInput) {
    start(async () => {
      const r = await updateRoomAccessAction(listingId, roomId, values);
      if (r.ok) toast.success("Room access saved.");
      else toast.error(r.error);
    });
  }

  return (
    <section className="rounded-card border border-brand-line bg-white p-5 shadow-card sm:p-6">
      <header className="mb-1">
        <h3 className="font-display text-lg font-semibold text-brand-ink">
          Room access
        </h3>
        <p className="mt-0.5 text-sm text-brand-mute">
          What a guest who books <strong>this room</strong> needs to arrive.
          Anything you leave blank falls back to the listing&rsquo;s access
          details. Codes and the Wi-Fi password unlock for the guest 1 hour
          before check-in.
        </p>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-5">
          <FormField
            control={form.control}
            name="check_in_method"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold text-brand-dark">
                  Check-in method
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Self check-in · smart lock"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="check_in_instructions"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold text-brand-dark">
                  Arrival instructions
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="How to find the room, where to park, which door to use…"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="gate_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
                    <KeyRound className="h-4 w-4 text-brand-mute" /> Gate code
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 1234 (estate/complex gate)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="door_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
                    <KeyRound className="h-4 w-4 text-brand-mute" /> Door code
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 4821#" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="wifi_network"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
                    <Wifi className="h-4 w-4 text-brand-mute" /> Wi-Fi network
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Featherstone_Room2" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="wifi_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
                    <Lock className="h-4 w-4 text-brand-mute" /> Wi-Fi password
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Shared with the guest near check-in"
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
              {pending ? "Saving…" : "Save room access"}
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
}
