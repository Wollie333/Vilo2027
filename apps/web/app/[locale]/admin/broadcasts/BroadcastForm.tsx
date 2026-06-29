"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Megaphone, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBrandName } from "@/components/brand/BrandProvider";

import { createBroadcastAction } from "./actions";
import { broadcastSchema, type BroadcastInput } from "./schemas";

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
};

export function BroadcastForm() {
  const router = useRouter();
  const brandName = useBrandName();
  const [pending, start] = useTransition();
  const form = useForm<BroadcastInput>({
    resolver: zodResolver(broadcastSchema),
    defaultValues: DEFAULTS,
  });

  const severity = form.watch("severity");

  // Critical always requires ack.
  useEffect(() => {
    if (severity === "critical") form.setValue("requires_ack", true);
  }, [severity, form]);

  function onSubmit(values: BroadcastInput) {
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
            Severity controls how recipients see it: info lands in the bell,
            warning shows a dismissable banner, critical pins a red banner +
            sends email to the audience.
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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">
                        Info — bell entry only
                      </SelectItem>
                      <SelectItem value="warning">
                        Warning — yellow banner, dismissable
                      </SelectItem>
                      <SelectItem value="critical">
                        Critical — red banner + email + must acknowledge
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label className="text-xs text-brand-mute">Audience</Label>
              <Controller
                control={form.control}
                name="audience"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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
                Link URL (optional)
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
                Link label
              </Label>
              <Input
                id="link_label"
                {...form.register("link_label")}
                placeholder="View status page"
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
                Start (optional)
              </Label>
              <Input
                id="starts_at"
                type="datetime-local"
                {...form.register("starts_at")}
              />
            </div>
            <div>
              <Label className="text-xs text-brand-mute" htmlFor="ends_at">
                End (optional)
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

          <div className="flex items-start gap-3">
            <Controller
              control={form.control}
              name="requires_ack"
              render={({ field }) => (
                <Checkbox
                  id="requires_ack"
                  checked={field.value}
                  disabled={severity === "critical"}
                  onCheckedChange={(v) => field.onChange(v === true)}
                />
              )}
            />
            <div>
              <Label
                htmlFor="requires_ack"
                className="font-medium text-brand-ink"
              >
                Require acknowledgement
              </Label>
              <p className="text-xs text-brand-mute">
                {severity === "critical"
                  ? "Critical broadcasts always require an acknowledgement."
                  : "Recipient must click 'Got it' before the banner is dismissed."}
              </p>
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
          onClick={() => router.push("/admin/broadcasts")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          <Send className="mr-1.5 h-4 w-4" />
          {pending ? "Sending…" : "Send broadcast"}
        </Button>
      </div>
    </form>
  );
}
