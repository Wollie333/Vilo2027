"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as Icons from "lucide-react";
import { Bell, Clock, Lock, RotateCcw, Save, Shuffle, Zap } from "lucide-react";
import { useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { savePreferencesAction } from "@/lib/notifications/preferences-action";
import type {
  EffectiveCategoryPref,
  PreferencesViewModel,
} from "@/lib/notifications/preferences-loader";
import {
  preferencesSchema,
  type PreferencesInput,
} from "@/lib/notifications/preferences-schema";

type Props = {
  initial: PreferencesViewModel;
  revalidate: string[];
};

// Looks up a lucide icon by name (the seed stores names like "Calendar").
// Falls back to Bell when the name isn't recognised so a missing icon
// doesn't crash the form.
function getIcon(name: string): React.ComponentType<{ className?: string }> {
  const lookup = Icons as unknown as Record<
    string,
    React.ComponentType<{ className?: string }>
  >;
  return lookup[name] ?? Bell;
}

export function PreferencesForm({ initial, revalidate }: Props) {
  const [pending, start] = useTransition();

  const form = useForm<PreferencesInput>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      categories: initial.categories.map((c) => ({
        category_id: c.id,
        email_enabled: c.email_enabled,
        push_enabled: c.push_enabled,
        in_app_enabled: c.in_app_enabled,
        digest_mode: c.digest_mode,
      })),
      quiet_hours_enabled: initial.settings.quiet_hours_enabled,
      quiet_hours_start: initial.settings.quiet_hours_start ?? "22:00",
      quiet_hours_end: initial.settings.quiet_hours_end ?? "07:00",
      quiet_hours_timezone: initial.settings.quiet_hours_timezone,
      dedupe_enabled: initial.settings.dedupe_enabled,
      digest_send_hour: initial.settings.digest_send_hour,
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "categories",
  });

  const quietOn = form.watch("quiet_hours_enabled");

  function onSubmit(values: PreferencesInput) {
    start(async () => {
      const result = await savePreferencesAction(values, revalidate);
      if (result.ok) toast.success("Notification preferences saved");
      else toast.error(result.error);
    });
  }

  function resetToDefaults() {
    form.reset({
      categories: initial.categories.map((c) => ({
        category_id: c.id,
        email_enabled: c.is_locked ? true : c.default_email,
        push_enabled: c.is_locked ? true : c.default_push,
        in_app_enabled: c.is_locked ? true : c.default_in_app,
        digest_mode: "off",
      })),
      quiet_hours_enabled: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      quiet_hours_timezone:
        initial.settings.quiet_hours_timezone || "Africa/Johannesburg",
      dedupe_enabled: true,
      digest_send_hour: 9,
    });
    toast.info("Reset to defaults — click Save to apply.");
  }

  // Two visual groups derived from display_order:
  //   < 70  → "Activity" (bookings, payments, messages, reviews, calendar, subscription)
  //   = 70  → "Account & security" (locked)
  //   > 70  → "Other" (admin_broadcasts, marketing_tips)
  const activity = initial.categories.filter((c) => c.display_order < 70);
  const account = initial.categories.filter((c) => c.display_order === 70);
  const other = initial.categories.filter((c) => c.display_order > 70);

  function indexOf(catId: string): number {
    return fields.findIndex((f) => f.category_id === catId);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <CategoryGroup
        title="Activity"
        subtitle="Booking and operational notifications you can fine-tune per channel."
      >
        {activity.map((cat) => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            index={indexOf(cat.id)}
            control={form.control}
          />
        ))}
      </CategoryGroup>

      <CategoryGroup
        title="Account & security"
        subtitle="Always on so you don't miss anything critical."
      >
        {account.map((cat) => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            index={indexOf(cat.id)}
            control={form.control}
          />
        ))}
      </CategoryGroup>

      <CategoryGroup
        title="Other"
        subtitle="Platform announcements and optional product news."
      >
        {other.map((cat) => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            index={indexOf(cat.id)}
            control={form.control}
          />
        ))}
      </CategoryGroup>

      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-brand-primary" />
            Smart delivery
          </CardTitle>
          <CardDescription className="text-brand-mute">
            Reduce noise — hold non-critical push during quiet hours, skip
            doubled-up channels, choose when digests arrive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-3">
            <Controller
              control={form.control}
              name="quiet_hours_enabled"
              render={({ field }) => (
                <Checkbox
                  id="quiet_hours_enabled"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                />
              )}
            />
            <div className="flex-1">
              <Label
                htmlFor="quiet_hours_enabled"
                className="flex items-center gap-2 font-medium text-brand-ink"
              >
                <Clock className="h-3.5 w-3.5 text-brand-mute" />
                Quiet hours
              </Label>
              <p className="text-xs text-brand-mute">
                Hold non-critical push notifications until your window ends.
                Critical alerts (account, security) always come through.
              </p>
              {quietOn ? (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs text-brand-mute">From</Label>
                    <Input
                      type="time"
                      {...form.register("quiet_hours_start")}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-brand-mute">To</Label>
                    <Input type="time" {...form.register("quiet_hours_end")} />
                  </div>
                  <div>
                    <Label className="text-xs text-brand-mute">Timezone</Label>
                    <Input
                      type="text"
                      {...form.register("quiet_hours_timezone")}
                      placeholder="Africa/Johannesburg"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Controller
              control={form.control}
              name="dedupe_enabled"
              render={({ field }) => (
                <Checkbox
                  id="dedupe_enabled"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                />
              )}
            />
            <div className="flex-1">
              <Label
                htmlFor="dedupe_enabled"
                className="flex items-center gap-2 font-medium text-brand-ink"
              >
                <Shuffle className="h-3.5 w-3.5 text-brand-mute" />
                Smart deduplication
              </Label>
              <p className="text-xs text-brand-mute">
                If a push for the same event has already been opened on another
                device, skip the email follow-up.
              </p>
            </div>
          </div>

          <div>
            <Label className="text-xs text-brand-mute">
              Digest delivery hour (0–23)
            </Label>
            <Input
              type="number"
              min={0}
              max={23}
              {...form.register("digest_send_hour", { valueAsNumber: true })}
              className="mt-1 w-24"
            />
            <p className="mt-1 text-xs text-brand-mute">
              The hour of day (your timezone) when bundled digests are sent.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-brand-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
        <Button
          type="button"
          variant="ghost"
          onClick={resetToDefaults}
          disabled={pending}
        >
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Reset to defaults
        </Button>
        <Button type="submit" disabled={pending}>
          <Save className="mr-1.5 h-4 w-4" />
          {pending ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </form>
  );
}

function CategoryGroup({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h3 className="font-display text-base font-bold text-brand-ink">
          {title}
        </h3>
        <p className="text-xs text-brand-mute">{subtitle}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function CategoryCard({
  cat,
  index,
  control,
}: {
  cat: EffectiveCategoryPref;
  index: number;
  control: ReturnType<typeof useForm<PreferencesInput>>["control"];
}) {
  const Icon = getIcon(cat.icon_name);
  const locked = cat.is_locked;
  return (
    <div
      className={`grid gap-3 rounded-card border p-4 transition-colors sm:grid-cols-[2fr,3fr] sm:gap-6 ${
        locked
          ? "border-brand-accent/60 bg-brand-accent/20"
          : "border-brand-line bg-white hover:border-brand-primary/40"
      }`}
    >
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-medium text-brand-ink">
            {cat.label}
            {locked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-primary">
                <Lock className="h-2.5 w-2.5" /> Always on
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-brand-mute">{cat.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <ChannelToggle
          control={control}
          index={index}
          name="email_enabled"
          label="Email"
          disabled={locked}
        />
        <ChannelToggle
          control={control}
          index={index}
          name="push_enabled"
          label="Push"
          disabled={locked}
        />
        <ChannelToggle
          control={control}
          index={index}
          name="in_app_enabled"
          label="In-app"
          disabled={locked}
        />
        {cat.supports_digest && !locked ? (
          <Controller
            control={control}
            name={`categories.${index}.digest_mode`}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="Delivery" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Send immediately</SelectItem>
                  <SelectItem value="daily">Daily digest</SelectItem>
                  <SelectItem value="weekly">Weekly digest</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        ) : null}
      </div>
    </div>
  );
}

function ChannelToggle({
  control,
  index,
  name,
  label,
  disabled,
}: {
  control: ReturnType<typeof useForm<PreferencesInput>>["control"];
  index: number;
  name: "email_enabled" | "push_enabled" | "in_app_enabled";
  label: string;
  disabled: boolean;
}) {
  return (
    <Controller
      control={control}
      name={`categories.${index}.${name}` as const}
      render={({ field }) => (
        <Label
          className={`flex cursor-pointer items-center gap-2 text-sm ${
            disabled ? "cursor-not-allowed opacity-60" : ""
          }`}
        >
          <Checkbox
            checked={field.value}
            disabled={disabled}
            onCheckedChange={(v) => field.onChange(v === true)}
          />
          <span>{label}</span>
        </Label>
      )}
    />
  );
}
