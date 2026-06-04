"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  ExternalLink,
  Mail,
  Plus,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { useBrandName } from "@/components/brand/BrandProvider";
import { combineName, splitName } from "@/lib/profile/name";
import { LANGUAGE_OPTIONS } from "@/app/signup/host/schemas";
import {
  saveProfileAction,
  uploadAvatarAction,
} from "@/app/dashboard/settings/actions";
import {
  profileSchema,
  type ProfileInput,
} from "@/app/dashboard/settings/schemas";
import { Chip, Field, TextArea, TextInput } from "@/app/dashboard/setup/_atoms";

// Single source of truth for the host profile form. Rendered by both
// /dashboard/settings (sidebar) and the onboarding setup card. RHF + Zod
// against profileSchema; saves through saveProfileAction.
export function HostProfileForm({
  defaults,
  host,
  emailVerified,
  submitLabel = "Save profile",
  onSaved,
}: {
  defaults: ProfileInput;
  host: { handle: string; isVerified: boolean } | null;
  emailVerified?: boolean;
  submitLabel?: string;
  onSaved?: (values: ProfileInput) => void;
}) {
  const brandName = useBrandName();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [highlightDraft, setHighlightDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });

  const avatarUrl = watch("avatar_url") ?? "";
  const bio = watch("bio") ?? "";
  const fullName = watch("full_name") ?? "";
  const email = watch("email") ?? "";

  // Name is captured as two fields but stored as a single full_name (DB column).
  // Split/combine via the app-wide source of truth (lib/profile/name).
  const initialName = splitName(defaults.full_name);
  const [firstName, setFirstName] = useState(initialName.first_name);
  const [lastName, setLastName] = useState(initialName.surname);
  function syncName(first: string, last: string) {
    setValue("full_name", combineName(first, last), {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  function onSubmit(values: ProfileInput) {
    // Required beyond the Zod schema (these also gate "profile complete").
    if (!avatarUrl) return toast.error("Add a profile photo.");
    if (!values.bio || values.bio.trim().length < 10)
      return toast.error("Add a short bio (at least 10 characters).");
    if (!values.languages_spoken?.length)
      return toast.error("Pick at least one language you speak.");

    start(async () => {
      // The host's public display name is just their name — no separate field.
      const result = await saveProfileAction({
        ...values,
        display_name: values.full_name,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Profile saved.");
      onSaved?.({ ...values, display_name: values.full_name });
    });
  }

  async function onAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return toast.error("Choose an image file.");
    if (file.size > 8 * 1024 * 1024)
      return toast.error("Image must be 8 MB or smaller.");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadAvatarAction(fd);
      if (!result.ok || !result.url) {
        toast.error(result.ok ? "Upload failed." : result.error);
        return;
      }
      setValue("avatar_url", result.url, { shouldDirty: true });
      toast.success("Photo uploaded.");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <p className="-mt-1 text-sm text-brand-mute">
        Guests see this on your public page. A photo and a short bio earn trust
        — hosts with both get 2.3× more enquiries.
      </p>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative h-24 w-24 overflow-hidden rounded-full border border-brand-line bg-brand-accent">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Profile photo"
                width={96}
                height={96}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-brand-secondary">
                {(fullName || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary hover:underline disabled:opacity-60"
          >
            <Camera className="h-3.5 w-3.5" />
            {uploading
              ? "Uploading…"
              : avatarUrl
                ? "Replace photo"
                : "Add photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onAvatarPick}
          />
        </div>

        {/* Identity */}
        <div className="flex-1 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required error={errors.full_name?.message}>
              <TextInput
                placeholder="Lerato"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  syncName(e.target.value, lastName);
                }}
              />
            </Field>
            <Field label="Surname">
              <TextInput
                placeholder="Mokoena"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  syncName(firstName, e.target.value);
                }}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Email"
              required
              hint="Your sign-in. Changing it updates where notifications go."
              error={errors.email?.message}
            >
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
                <TextInput
                  type="email"
                  autoComplete="email"
                  className="pl-9 pr-24"
                  value={email}
                  onChange={(e) =>
                    setValue("email", e.target.value, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
                <span
                  className={`absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    emailVerified
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-status-pending/10 text-status-pending"
                  }`}
                >
                  {emailVerified ? <CheckCircle2 className="h-3 w-3" /> : null}
                  {emailVerified ? "Verified" : "Unverified"}
                </span>
              </div>
            </Field>
            <Field label="Phone" required error={errors.phone?.message}>
              <TextInput
                type="tel"
                autoComplete="tel"
                placeholder="+27 82 123 4567"
                {...register("phone")}
              />
            </Field>
          </div>

          <Field
            label={`Your ${brandName} handle`}
            hint={host ? `Your public page: /${host.handle}` : undefined}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-brand-mute">
                @
              </span>
              <TextInput
                value={host?.handle ?? ""}
                disabled
                className="pl-7"
                title="Set at signup — change it in Settings."
              />
            </div>
          </Field>

          <Field
            label="Short bio"
            required
            hint={`${bio.length}/2000 — what makes you a great host?`}
            error={errors.bio?.message}
          >
            <TextArea
              rows={4}
              maxLength={2000}
              placeholder="A line or two about you and your place…"
              {...register("bio")}
            />
          </Field>
        </div>
      </div>

      <Field
        label="Languages you speak"
        required
        hint="Guests filter by these."
      >
        <Controller
          control={control}
          name="languages_spoken"
          render={({ field }) => {
            const selected = field.value ?? [];
            return (
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <Chip
                    key={lang}
                    selected={selected.includes(lang)}
                    onClick={() =>
                      field.onChange(
                        selected.includes(lang)
                          ? selected.filter((l) => l !== lang)
                          : [...selected, lang],
                      )
                    }
                    label={lang}
                  />
                ))}
              </div>
            );
          }}
        />
      </Field>

      <Field
        label="Highlights"
        hint="Up to 4 short tags guests see on your page — e.g. “Lives on the property”, “Stargazing & hiking”."
      >
        <Controller
          control={control}
          name="highlights"
          render={({ field }) => {
            const tags = field.value ?? [];
            const atMax = tags.length >= 4;
            const addTag = () => {
              const next = highlightDraft.trim().slice(0, 28);
              if (!next || atMax || tags.includes(next)) return;
              field.onChange([...tags, next]);
              setHighlightDraft("");
            };
            return (
              <div className="space-y-2.5">
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, i) => (
                      <span
                        key={`${tag}-${i}`}
                        className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-brand-light px-3 py-1 text-sm text-brand-ink"
                      >
                        {tag}
                        <button
                          type="button"
                          aria-label={`Remove ${tag}`}
                          onClick={() =>
                            field.onChange(tags.filter((_, j) => j !== i))
                          }
                          className="text-brand-mute hover:text-brand-ink"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {!atMax ? (
                  <div className="flex items-center gap-2">
                    <TextInput
                      value={highlightDraft}
                      maxLength={28}
                      placeholder="Add a highlight…"
                      onChange={(e) => setHighlightDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      disabled={!highlightDraft.trim()}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded border border-brand-line px-3.5 py-2.5 text-sm font-medium text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                ) : null}
              </div>
            );
          }}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-line pt-5">
        {host ? (
          <Link
            href={`/${host.handle}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary hover:underline"
          >
            {host.isVerified ? <BadgeCheck className="h-3.5 w-3.5" /> : null}
            View public page
            <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending || uploading}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
