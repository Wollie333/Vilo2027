"use client";

import { Send, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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

import { sendIndividualNotificationAction } from "../actions";
import type { UserSearchResult } from "../schemas";
import { UserMultiPicker } from "../UserMultiPicker";

export function SendForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [recipients, setRecipients] = useState<UserSearchResult[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [severity, setSeverity] = useState<"info" | "default" | "high">(
    "default",
  );
  const [emailOn, setEmailOn] = useState(true);
  const [pushOn, setPushOn] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (recipients.length === 0) {
      toast.error("Pick at least one recipient.");
      return;
    }
    if (title.trim().length < 3) {
      toast.error("Title needs at least 3 characters.");
      return;
    }
    if (body.trim().length < 5) {
      toast.error("Body needs at least 5 characters.");
      return;
    }
    start(async () => {
      const result = await sendIndividualNotificationAction({
        title: title.trim(),
        body: body.trim(),
        link_url: linkUrl.trim() || undefined,
        link_label: linkLabel.trim() || undefined,
        severity,
        channels: { email: emailOn, push: pushOn, in_app: true },
        recipient_ids: recipients.map((r) => r.id),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Sent to ${result.deliveredTo} recipient(s)`);
      router.push("/admin/notifications/sent");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-brand-primary" />
            Recipients
          </CardTitle>
          <CardDescription className="text-brand-mute">
            Pick one or more users by name or email. Filter by role to narrow
            the list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserMultiPicker value={recipients} onChange={setRecipients} />
        </CardContent>
      </Card>

      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Message</CardTitle>
          <CardDescription className="text-brand-mute">
            Plain text. Recipients see this in their in-app bell, and on the
            channels you tick below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-xs text-brand-mute">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Quick question about your listing"
            />
          </div>
          <div>
            <Label htmlFor="body" className="text-xs text-brand-mute">
              Body
            </Label>
            <Textarea
              id="body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              placeholder="Hi — we noticed your bookings show…"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="link_url" className="text-xs text-brand-mute">
                Link URL (optional)
              </Label>
              <Input
                id="link_url"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="/dashboard/listings/abc"
              />
            </div>
            <div>
              <Label htmlFor="link_label" className="text-xs text-brand-mute">
                Link label
              </Label>
              <Input
                id="link_label"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="Open listing"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-brand-mute">Severity</Label>
            <Select
              value={severity}
              onValueChange={(v) =>
                setSeverity(v as "info" | "default" | "high")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-brand-mute">
              Individual sends never reach &ldquo;critical&rdquo; — that tier is
              reserved for broadcasts.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Channels</CardTitle>
          <CardDescription className="text-brand-mute">
            In-app always sends. Email and push are optional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Label className="flex cursor-not-allowed items-center gap-2 text-sm opacity-60">
              <Checkbox checked disabled />
              <span>In-app (always on)</span>
            </Label>
            <Label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={emailOn}
                onCheckedChange={(v) => setEmailOn(v === true)}
              />
              <span>Email</span>
            </Label>
            <Label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={pushOn}
                onCheckedChange={(v) => setPushOn(v === true)}
              />
              <span>Push</span>
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/notifications/sent")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending || recipients.length === 0}>
          <Send className="mr-1.5 h-4 w-4" />
          {pending
            ? "Sending…"
            : `Send to ${recipients.length || 0} recipient${
                recipients.length === 1 ? "" : "s"
              }`}
        </Button>
      </div>
    </form>
  );
}
