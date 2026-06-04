"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Compass,
  DoorOpen,
  GripVertical,
  KeyRound,
  Lock,
  Plus,
  Save,
  Trash2,
  Wifi,
} from "lucide-react";
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

import { replaceLocalPicksAction, saveListingAccessAction } from "../actions";
import {
  LOCAL_PICK_CATEGORIES,
  listingAccessSchema,
  type ListingAccessInput,
  type LocalPickInput,
} from "../schemas";

export type AccessInitial = {
  check_in_method: string | null;
  check_in_instructions: string | null;
  gate_code: string | null;
  door_code: string | null;
  wifi_network: string | null;
  wifi_password: string | null;
};

export function GuestAccessTab({
  listingId,
  access,
  picks: initialPicks,
}: {
  listingId: string;
  access: AccessInitial | null;
  picks: LocalPickInput[];
}) {
  return (
    <div className="space-y-6">
      <AccessForm listingId={listingId} access={access} />
      <LocalPicksEditor listingId={listingId} initial={initialPicks} />
    </div>
  );
}

function AccessForm({
  listingId,
  access,
}: {
  listingId: string;
  access: AccessInitial | null;
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
      const result = await saveListingAccessAction(listingId, values);
      if (result.ok) toast.success("Access details saved");
      else toast.error(result.error);
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Guest access
        </CardTitle>
        <CardDescription className="text-brand-mute">
          What your guest needs to arrive and settle in. The door code and Wi-Fi
          password are sensitive, so guests only see them from 24 hours before
          check-in — and they&rsquo;re never shown on your public page.
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
              name="check_in_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
                    <DoorOpen className="h-4 w-4 text-brand-mute" /> Check-in
                    method
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
                      placeholder="How to find the place, where to park, which door to use…"
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
                      <Input placeholder="e.g. Featherstone_Guest" {...field} />
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
                      <Lock className="h-4 w-4 text-brand-mute" /> Wi-Fi
                      password
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
                {pending ? "Saving…" : "Save access details"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

const EMPTY_PICK: LocalPickInput = {
  category: "do",
  title: "",
  blurb: "",
  distance_label: "",
};

function LocalPicksEditor({
  listingId,
  initial,
}: {
  listingId: string;
  initial: LocalPickInput[];
}) {
  const [picks, setPicks] = useState<LocalPickInput[]>(initial);
  const [pending, start] = useTransition();

  function update(i: number, patch: Partial<LocalPickInput>) {
    setPicks((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    );
  }
  function remove(i: number) {
    setPicks((prev) => prev.filter((_, idx) => idx !== i));
  }
  function add() {
    setPicks((prev) => [...prev, { ...EMPTY_PICK }]);
  }
  function move(i: number, dir: -1 | 1) {
    setPicks((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function save() {
    // Drop blank rows (no title) before validating.
    const clean = picks.filter((p) => p.title.trim().length > 0);
    if (clean.some((p) => p.title.trim().length === 0)) {
      toast.error("Each pick needs a name.");
      return;
    }
    start(async () => {
      const result = await replaceLocalPicksAction(listingId, clean);
      if (result.ok) {
        toast.success("Local picks saved");
        setPicks(
          (result.data ?? []).map((r) => ({
            category: r.category as LocalPickInput["category"],
            title: r.title,
            blurb: r.blurb ?? "",
            distance_label: r.distance_label ?? "",
          })),
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl font-bold text-brand-dark">
          <Compass className="h-5 w-5 text-brand-primary" /> Local picks
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Your favourite nearby spots — where to eat, what to do, what to see.
          They appear as &ldquo;your local picks&rdquo; on the guest&rsquo;s
          trip page. Leave it empty and the section simply won&rsquo;t show.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {picks.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-brand-light/40 px-4 py-8 text-center text-sm text-brand-mute">
            No picks yet. Add a few favourites to give your guests a head start.
          </div>
        ) : (
          <ul className="space-y-3">
            {picks.map((pick, i) => (
              <li
                key={i}
                className="rounded-card border border-brand-line bg-white p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 pt-1.5">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label="Move up"
                      className="text-brand-mute hover:text-brand-ink disabled:opacity-30"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid flex-1 gap-3 sm:grid-cols-[120px_1fr_140px]">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                        Type
                      </label>
                      <select
                        value={pick.category}
                        onChange={(e) =>
                          update(i, {
                            category: e.target
                              .value as LocalPickInput["category"],
                          })
                        }
                        className="mt-1 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
                      >
                        {LOCAL_PICK_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                        Name
                      </label>
                      <Input
                        value={pick.title}
                        onChange={(e) => update(i, { title: e.target.value })}
                        placeholder="e.g. The Knysna Heads"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                        Distance
                      </label>
                      <Input
                        value={pick.distance_label ?? ""}
                        onChange={(e) =>
                          update(i, { distance_label: e.target.value })
                        }
                        placeholder="5 min walk"
                        className="mt-1"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                        Blurb
                      </label>
                      <Textarea
                        value={pick.blurb ?? ""}
                        onChange={(e) => update(i, { blurb: e.target.value })}
                        rows={2}
                        placeholder="A line on why you love it."
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label="Remove pick"
                    className="mt-1.5 text-brand-mute hover:text-status-cancelled"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={add}
            disabled={picks.length >= 24}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add a pick
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={pending}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save local picks"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
