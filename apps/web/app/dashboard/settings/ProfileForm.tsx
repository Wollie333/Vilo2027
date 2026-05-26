"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, Camera, ExternalLink, Save, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
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

import { saveProfileAction, uploadAvatarAction } from "./actions";
import { profileSchema, type ProfileInput } from "./schemas";

export function ProfileForm({
  defaults,
  email,
  host,
}: {
  defaults: ProfileInput;
  email: string;
  host: { handle: string; isVerified: boolean } | null;
}) {
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });

  const avatarUrl = form.watch("avatar_url");
  const fullName = form.watch("full_name");
  const initials = (fullName || email || "??").slice(0, 2).toUpperCase();

  function onSubmit(values: ProfileInput) {
    start(async () => {
      const result = await saveProfileAction(values);
      if (result.ok) toast.success("Profile saved");
      else toast.error(result.error);
    });
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image is too large — max 5MB.");
      e.target.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadAvatarAction(fd);
    setUploading(false);
    e.target.value = "";

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.url) {
      form.setValue("avatar_url", result.url, { shouldDirty: true });
      toast.success("Photo uploaded — click Save to keep it.");
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
        noValidate
      >
        {/* — Avatar + identity card — */}
        <Card className="rounded-card border-brand-line shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-base">You</CardTitle>
            <CardDescription className="text-brand-mute">
              Your name and photo appear in the header, on bookings, and on your
              public host page. Email is{" "}
              <span className="font-mono text-brand-ink">{email}</span> — change
              it via the auth flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="Your profile photo"
                    className="h-20 w-20 rounded-pill border border-brand-line object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-pill bg-brand-accent text-lg font-semibold text-brand-secondary">
                    {initials}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || pending}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-pill border border-brand-line bg-white text-brand-ink shadow-card hover:bg-brand-accent disabled:opacity-50"
                  aria-label="Upload profile photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-sm">
                <div className="font-medium text-brand-ink">Profile photo</div>
                <div className="mt-0.5 text-xs text-brand-mute">
                  Square, at least 400×400. JPG or PNG. Max 5MB.
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || pending}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline disabled:opacity-50"
                >
                  <Upload className="h-3 w-3" />
                  {uploading
                    ? "Uploading…"
                    : avatarUrl
                      ? "Replace photo"
                      : "Upload photo"}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="name"
                      placeholder="Lerato Mahlangu"
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Phone{" "}
                    <span className="font-normal text-brand-mute">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      autoComplete="tel"
                      placeholder="+27 82 123 4567"
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* — Public host page card — only renders if user has a hosts row. */}
        {host ? (
          <Card className="rounded-card border-brand-line shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-base">
                Public host page
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-3 text-brand-mute">
                <span className="font-mono text-brand-ink">
                  viloplatform.com/{host.handle}
                </span>
                {host.isVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified host
                  </span>
                ) : null}
                <Link
                  href={`/${host.handle}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
                >
                  View public
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Karoo Cottages"
                        disabled={pending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-brand-mute">
                      Shown on every listing card and your host page. Changing
                      this doesn&rsquo;t change your URL handle.
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Bio{" "}
                      <span className="font-normal text-brand-mute">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={5}
                        placeholder="Tell guests who you are and what makes your stays special."
                        disabled={pending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Website{" "}
                      <span className="font-normal text-brand-mute">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://karoocottages.co.za"
                        disabled={pending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={pending || uploading}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
