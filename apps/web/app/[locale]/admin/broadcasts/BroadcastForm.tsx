"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  Megaphone,
  MonitorSmartphone,
  Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { modal } from "@/components/ui/modal-host";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBrandName } from "@/components/brand/BrandProvider";

import { createBroadcastAction, editBroadcastSafe } from "./actions";
import {
  broadcastSchema,
  type BroadcastInput,
  type EditBroadcastInput,
} from "./schemas";

const DEFAULTS: BroadcastInput = {
  severity: "info",
  audience: "all",
  title: "",
  body: "",
  link_url: "",
  link_label: "",
  starts_at: null,
  ends_at: null,
  requires_ack: false,
  show_banner: true,
  banner_surfaces: ["dashboard"],
  banner_dismiss_mode: "dismissible",
};

type EditContext = {
  id: string;
  severity: string;
  audience: string;
};

export function BroadcastForm({
  mode = "create",
  initial,
  editContext,
}: {
  mode?: "create" | "edit";
  initial?: Partial<BroadcastInput>;
  editContext?: EditContext;
}) {
  const router = useRouter();
  const brandName = useBrandName();
  const [pending, start] = useTransition();
  const isEdit = mode === "edit";
  const form = useForm<BroadcastInput>({
    resolver: zodResolver(broadcastSchema),
    defaultValues: { ...DEFAULTS, ...initial },
  });

  const severity = form.watch("severity");
  const showBanner = form.watch("show_banner");
  const surfaces = form.watch("banner_surfaces");
  const dismissMode = form.watch("banner_dismiss_mode");

  function toggleSurface(surface: "dashboard" | "public", on: boolean) {
    const next = new Set(surfaces);
    if (on) next.add(surface);
    else next.delete(surface);
    form.setValue(
      "banner_surfaces",
      Array.from(next) as ("dashboard" | "public")[],
      { shouldValidate: true },
    );
  }

  async function onSubmit(values: BroadcastInput) {
    if (isEdit && editContext) {
      start(async () => {
        const payload: EditBroadcastInput = {
          id: editContext.id,
          title: values.title,
          body: values.body,
          link_url: values.link_url ?? "",
          link_label: values.link_label ?? "",
          starts_at: values.starts_at ?? null,
          ends_at: values.ends_at ?? null,
          requires_ack: values.requires_ack,
          show_banner: values.show_banner,
          banner_surfaces: values.banner_surfaces,
          banner_dismiss_mode: values.banner_dismiss_mode,
        };
        const result = await editBroadcastSafe(payload);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Broadcast updated");
        router.push(`/admin/broadcasts/${editContext.id}`);
        router.refresh();
      });
      return;
    }

    // Create — guard the blast: a broadcast fans out to a whole audience (and a
    // critical one emails every one of them). Confirm before it goes out — a
    // mis-click here is only undone by the after-the-fact cancel.
    const audienceLabel =
      (
        {
          all: "everyone",
          hosts: "all hosts",
          guests: "all guests",
          staff: "all staff",
          super_admins: "super admins only",
        } as Record<string, string>
      )[values.audience] ?? values.audience;
    const when = values.starts_at ? "when it goes live" : "immediately";
    const emailWarning =
      values.severity === "critical"
        ? ` This is CRITICAL — it also emails ${audienceLabel}.`
        : "";
    const ok = await modal.confirm({
      title: `Send this broadcast to ${audienceLabel}?`,
      description: `It goes out ${when}.${emailWarning}`,
      confirmLabel: "Send broadcast",
    });
    if (!ok) return;

    start(async () => {
      const result = await createBroadcastAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Broadcast created");
      router.push(`/admin/broadcasts/${result.id}`);
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 text-brand-primary" />
            Announcement details
          </CardTitle>
          <CardDescription className="text-brand-mute">
            Severity sets the colour, the bell notification, and (for critical)
            the email. Whether it also shows as a banner is controlled
            separately below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-brand-mute">Severity</Label>
              <Controller
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info — blue</SelectItem>
                      <SelectItem value="warning">Warning — amber</SelectItem>
                      <SelectItem value="critical">
                        Critical — red + email
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {isEdit ? (
                <p className="mt-1 text-xs text-brand-mute">
                  Locked after send —{" "}
                  <span className="capitalize">{editContext?.severity}</span>.
                </p>
              ) : null}
            </div>
            <div>
              <Label className="text-xs text-brand-mute">Audience</Label>
              <Controller
                control={form.control}
                name="audience"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Everyone</SelectItem>
                      <SelectItem value="hosts">Hosts only</SelectItem>
                      <SelectItem value="guests">Guests only</SelectItem>
                      <SelectItem value="staff">Staff only</SelectItem>
                      <SelectItem value="super_admins">
                        Super admins only
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {isEdit ? (
                <p className="mt-1 text-xs text-brand-mute">
                  Locked after send — {editContext?.audience}.
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <Label className="text-xs text-brand-mute" htmlFor="title">
              Title
            </Label>
            <Input
              id="title"
              {...form.register("title")}
              placeholder="Scheduled maintenance window"
            />
            {form.formState.errors.title ? (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.title.message}
              </p>
            ) : null}
          </div>

          <div>
            <Label className="text-xs text-brand-mute" htmlFor="body">
              Message body
            </Label>
            <Textarea
              id="body"
              rows={5}
              {...form.register("body")}
              placeholder={`${brandName} will be unavailable on Saturday 02:00–04:00 SAST for database upgrades.`}
            />
            {form.formState.errors.body ? (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.body.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-brand-mute" htmlFor="link_url">
                Action link URL (optional)
              </Label>
              <Input
                id="link_url"
                type="url"
                {...form.register("link_url")}
                placeholder="https://status.wielo.app"
              />
            </div>
            <div>
              <Label className="text-xs text-brand-mute" htmlFor="link_label">
                Action link label
              </Label>
              <Input
                id="link_label"
                {...form.register("link_label")}
                placeholder="View status page"
              />
              {form.formState.errors.link_label ? (
                <p className="mt-1 text-xs text-red-600">
                  {form.formState.errors.link_label.message}
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Banner display ─────────────────────────────────────────────── */}
      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MonitorSmartphone className="h-4 w-4 text-brand-primary" />
            Banner display
          </CardTitle>
          <CardDescription className="text-brand-mute">
            Optionally pin this as a banner on top of the app and/or public
            site. It always lands in the bell regardless of this setting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label
                htmlFor="show_banner"
                className="font-medium text-brand-ink"
              >
                Show as a banner
              </Label>
              <p className="text-xs text-brand-mute">
                Off = bell notification only.
              </p>
            </div>
            <Controller
              control={form.control}
              name="show_banner"
              render={({ field }) => (
                <Checkbox
                  id="show_banner"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  className="h-5 w-5"
                />
              )}
            />
          </div>

          {showBanner ? (
            <>
              <div>
                <Label className="text-xs text-brand-mute">Show on</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <SurfaceToggle
                    label="Dashboard"
                    hint="Host & guest app, admin"
                    checked={surfaces.includes("dashboard")}
                    onChange={(on) => toggleSurface("dashboard", on)}
                  />
                  <SurfaceToggle
                    label="Public site"
                    hint="Wielo public pages"
                    checked={surfaces.includes("public")}
                    onChange={(on) => toggleSurface("public", on)}
                  />
                </div>
                {form.formState.errors.banner_surfaces ? (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.banner_surfaces.message}
                  </p>
                ) : null}
              </div>

              <div>
                <Label className="text-xs text-brand-mute">
                  How viewers close it
                </Label>
                <Controller
                  control={form.control}
                  name="banner_dismiss_mode"
                  render={({ field }) => (
                    <div className="mt-2 space-y-2">
                      <DismissOption
                        value="dismissible"
                        current={field.value}
                        onSelect={field.onChange}
                        label="Dismissible"
                        hint="Viewer can close it; it stays closed for them."
                      />
                      <DismissOption
                        value="acknowledge"
                        current={field.value}
                        onSelect={field.onChange}
                        label="Require acknowledgement"
                        hint="Viewer must click ‘Acknowledge’ before it closes."
                      />
                      <DismissOption
                        value="persistent"
                        current={field.value}
                        onSelect={field.onChange}
                        label="Always show"
                        hint="No close button — shows for the whole active window."
                      />
                    </div>
                  )}
                />
                {dismissMode === "persistent" && surfaces.includes("public") ? (
                  <p className="mt-2 text-xs text-amber-700">
                    On the public site an “always show” banner can’t be closed
                    by anonymous visitors — use sparingly.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* ─── Scheduling ─────────────────────────────────────────────────── */}
      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardDescription className="text-brand-mute">
            Scheduling — leave start blank to publish immediately, end blank for
            open-ended (cancel manually when done).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-brand-mute" htmlFor="starts_at">
                Start / delay until (optional)
              </Label>
              <Input
                id="starts_at"
                type="datetime-local"
                {...form.register("starts_at")}
              />
            </div>
            <div>
              <Label className="text-xs text-brand-mute" htmlFor="ends_at">
                Expire at (optional)
              </Label>
              <Input
                id="ends_at"
                type="datetime-local"
                {...form.register("ends_at")}
              />
              {form.formState.errors.ends_at ? (
                <p className="mt-1 text-xs text-red-600">
                  {form.formState.errors.ends_at.message}
                </p>
              ) : null}
            </div>
          </div>

          {severity === "critical" ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                A critical broadcast also sends an email to every targeted user.
                Use it for outages, security advisories, or platform-wide
                changes — not for marketing.
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            router.push(
              isEdit && editContext
                ? `/admin/broadcasts/${editContext.id}`
                : "/admin/broadcasts",
            )
          }
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          <Send className="mr-1.5 h-4 w-4" />
          {pending ? "Saving…" : isEdit ? "Save changes" : "Send broadcast"}
        </Button>
      </div>
    </form>
  );
}

function SurfaceToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition ${
        checked
          ? "border-brand-primary bg-brand-primary/5"
          : "border-brand-line hover:border-brand-primary/40"
      }`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <span>
        <span className="font-medium text-brand-ink">{label}</span>
        <span className="block text-xs text-brand-mute">{hint}</span>
      </span>
    </label>
  );
}

function DismissOption({
  value,
  current,
  onSelect,
  label,
  hint,
}: {
  value: string;
  current: string;
  onSelect: (v: string) => void;
  label: string;
  hint: string;
}) {
  const active = current === value;
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition ${
        active
          ? "border-brand-primary bg-brand-primary/5"
          : "border-brand-line hover:border-brand-primary/40"
      }`}
    >
      <input
        type="radio"
        checked={active}
        onChange={() => onSelect(value)}
        className="mt-1 accent-brand-primary"
      />
      <span>
        <span className="font-medium text-brand-ink">{label}</span>
        <span className="block text-xs text-brand-mute">{hint}</span>
      </span>
    </label>
  );
}
