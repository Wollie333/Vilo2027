"use client";

import { Camera, Check, CheckCircle2, Mail, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { LANGUAGE_OPTIONS } from "@/app/signup/host/schemas";

import { saveProfileAction, uploadAvatarAction } from "../../settings/actions";
import type { Host, Profile } from "../types";

type Props = {
  host: Host;
  profile: Profile;
  emailVerified: boolean;
  onSaved: (next: { host: Partial<Host>; profile: Partial<Profile> }) => void;
};

export function StepProfile({ host, profile, emailVerified, onSaved }: Props) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone);
  const [bio, setBio] = useState(host.bio);
  const [languages, setLanguages] = useState<string[]>(
    host.languages_spoken.length > 0 ? host.languages_spoken : ["English"],
  );
  const [avatarUrl, setAvatarUrl] = useState(host.avatar_url);

  const [uploading, setUploading] = useState(false);
  const [savePending, startSave] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleLanguage(lang: string) {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  }

  async function onAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadAvatarAction(fd);
    setUploading(false);
    if (!result.ok || !result.url) {
      toast.error(result.ok ? "Upload failed." : result.error);
      return;
    }
    setAvatarUrl(result.url);
    toast.success("Photo uploaded.");
  }

  function onSave() {
    if (!fullName || fullName.trim().length < 2) {
      toast.error("Enter your name.");
      return;
    }
    if (!bio || bio.trim().length < 10) {
      toast.error("Add a short bio (at least 10 characters).");
      return;
    }
    if (!avatarUrl) {
      toast.error("Add a profile photo so guests know who they're booking.");
      return;
    }
    if (languages.length === 0) {
      toast.error("Pick at least one language you speak.");
      return;
    }

    startSave(async () => {
      const result = await saveProfileAction({
        full_name: fullName.trim(),
        email: profile.email,
        phone: phone.trim(),
        avatar_url: avatarUrl,
        display_name: host.display_name,
        bio: bio.trim(),
        website_url: host.website_url,
        languages_spoken: languages,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onSaved({
        host: {
          bio: bio.trim(),
          avatar_url: avatarUrl,
          languages_spoken: languages,
        },
        profile: {
          full_name: fullName.trim(),
          phone: phone.trim(),
        },
      });
      toast.success("Profile saved.");
    });
  }

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-pill border-2 border-brand-line bg-brand-accent">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Profile photo"
              width={96}
              height={96}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-brand-secondary">
              {(fullName || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Upload profile photo"
            className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-pill border-2 border-white bg-brand-primary text-white shadow-card transition hover:bg-brand-secondary"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-semibold text-brand-ink">
            Profile photo
          </div>
          <p className="mt-0.5 text-xs text-brand-mute">
            JPEG, PNG or WebP. Max 5 MB. Square photos work best.
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-2 inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-accent disabled:opacity-60"
          >
            <Upload className="h-3 w-3" />
            {uploading
              ? "Uploading…"
              : avatarUrl
                ? "Replace photo"
                : "Upload photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onAvatarPick}
          />
        </div>
      </div>

      {/* Email verified strip */}
      <div className="flex items-center gap-3 rounded border border-brand-line bg-brand-light/50 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
          <Mail className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-brand-ink">
            {profile.email || "No email on file"}
          </div>
          <div className="text-xs text-brand-mute">
            {emailVerified
              ? "Verified — this is your sign-in."
              : "Not verified yet — check your inbox for the confirmation link."}
          </div>
        </div>
        {emailVerified ? (
          <span className="inline-flex items-center gap-1 rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> Verified
          </span>
        ) : null}
      </div>

      {/* Name + phone */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" hint="As it appears to guests.">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-primary"
          />
        </Field>
        <Field label="Phone" hint="Visible to guests after booking.">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +27 82 123 4567"
            className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-primary"
          />
        </Field>
      </div>

      {/* Bio */}
      <Field
        label="About you"
        hint="A short intro guests see on your public page. 2–3 sentences works best."
      >
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          maxLength={240}
          placeholder="I run a small guesthouse in Sea Point. I love coffee, jazz and meeting travellers from everywhere…"
          className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-primary"
        />
        <div className="mt-1 text-right text-[10.5px] text-brand-mute">
          {bio.length}/240
        </div>
      </Field>

      {/* Languages */}
      <Field
        label="Languages you speak"
        hint="Pick all that apply. Guests filter by these."
      >
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map((lang) => {
            const on = languages.includes(lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => toggleLanguage(lang)}
                className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium transition ${
                  on
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-line bg-white text-brand-ink hover:bg-brand-accent"
                }`}
              >
                {on ? <Check className="h-3 w-3" /> : null}
                {lang}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={savePending}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
        >
          {savePending ? "Saving…" : "Save & continue"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 font-display text-[13px] font-semibold text-brand-ink">
        {label}
      </div>
      {hint ? (
        <div className="mb-2 text-[11px] text-brand-mute">{hint}</div>
      ) : null}
      {children}
    </label>
  );
}
