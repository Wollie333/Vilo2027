"use client";

import { Camera, Check, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { DeleteAccountSection } from "@/app/dashboard/settings/data/DeleteAccountSection";
import { combineName, splitName } from "@/lib/profile/name";
import { uploadAvatarAction } from "@/app/signup/guest/actions";
import {
  COUNTRIES,
  LANGUAGE_OPTIONS,
  SA_CITIES,
} from "@/app/signup/guest/schemas";

import {
  updateContactAction,
  updatePrefsAction,
  updateProfileAction,
} from "./actions";

export type SettingsInitial = {
  full_name: string;
  phone: string;
  country: string;
  bio: string;
  avatar_url: string;
  languages: string[];
  preferred_cities: string[];
  marketing_opt_in: boolean;
};

export function SettingsForms({
  initial,
  email,
}: {
  initial: SettingsInitial;
  email: string;
}) {
  return (
    <div className="space-y-8">
      <ProfileSection initial={initial} />
      <ContactSection initial={initial} />
      <PrefsSection initial={initial} />
      <AccountSection email={email} />
      <DeleteAccountSection email={email} />
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-brand-line bg-white shadow-card">
      <header className="border-b border-brand-line px-6 py-4">
        <h2 className="font-display text-lg font-semibold text-brand-ink">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-brand-mute">{description}</p>
      </header>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

function ProfileSection({ initial }: { initial: SettingsInitial }) {
  const initialName = splitName(initial.full_name);
  const [firstName, setFirstName] = useState(initialName.first_name);
  const [surname, setSurname] = useState(initialName.surname);
  const fullName = combineName(firstName, surname);
  const [bio, setBio] = useState(initial.bio);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url);
  const [languages, setLanguages] = useState<string[]>(initial.languages);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    startTransition(async () => {
      const result = await updateProfileAction({
        full_name: combineName(firstName, surname),
        bio,
        avatar_url: avatarUrl,
        languages,
      });
      if (result.ok) toast.success("Profile updated.");
      else toast.error(result.error);
    });
  }

  function handleAvatar(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    uploadAvatarAction(fd)
      .then((r) => {
        if (r.ok && r.data) {
          setAvatarUrl(r.data.url);
          toast.success("Photo uploaded — remember to save.");
        } else if (!r.ok) {
          toast.error(r.error);
        }
      })
      .finally(() => setUploading(false));
  }

  const initials = (fullName || "V").slice(0, 2).toUpperCase();

  return (
    <SectionCard
      title="Profile"
      description="What hosts see when you book or message them."
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-pill bg-brand-accent text-base font-semibold text-brand-secondary">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={fullName || "You"}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-pill border border-brand-line bg-white shadow-card hover:bg-brand-accent"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <div className="text-sm">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
            >
              <Upload className="h-3 w-3" />{" "}
              {avatarUrl ? "Replace photo" : "Upload photo"}
            </button>
            {avatarUrl ? (
              <button
                type="button"
                onClick={() => setAvatarUrl("")}
                className="ml-3 text-xs font-medium text-brand-mute hover:text-brand-ink hover:underline"
              >
                Remove
              </button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatar(f);
                e.target.value = "";
              }}
            />
            <div className="mt-1 text-[11px] text-brand-mute">
              Square JPG/PNG, up to 5 MB.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brand-ink">
              Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              className="w-full rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brand-ink">
              Surname
            </label>
            <input
              type="text"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              autoComplete="family-name"
              className="w-full rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-brand-ink">
            Short bio{" "}
            <span className="ml-1 font-normal text-brand-mute">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={240}
            className="w-full resize-none rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
            placeholder="A line or two about you. Helps hosts feel they know who's arriving."
          />
          <div className="mt-1 text-right text-[11px] text-brand-mute">
            {bio.length} / 240
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-brand-ink">
            Languages you speak{" "}
            <span className="ml-1 font-normal text-brand-mute">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((l) => {
              const on = languages.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() =>
                    setLanguages(
                      on ? languages.filter((x) => x !== l) : [...languages, l],
                    )
                  }
                  className={`rounded-pill border px-3 py-1 text-xs font-medium transition-colors ${
                    on
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-line bg-white text-brand-mute hover:bg-brand-accent hover:text-brand-ink"
                  }`}
                >
                  {on ? <Check className="-mt-px mr-1 inline h-3 w-3" /> : null}
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-secondary disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

function ContactSection({ initial }: { initial: SettingsInitial }) {
  const [phone, setPhone] = useState(initial.phone);
  const [country, setCountry] = useState(initial.country || "South Africa");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateContactAction({ phone, country });
      if (result.ok) toast.success("Contact details updated.");
      else toast.error(result.error);
    });
  }

  return (
    <SectionCard
      title="Contact"
      description="Used for booking-critical SMS only. Never shown publicly."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-brand-ink">
            Phone
          </label>
          <div className="flex">
            <span className="inline-flex items-center rounded-l border border-r-0 border-brand-line bg-brand-light/60 px-3 font-mono text-sm text-brand-mute">
              +27
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="82 123 4567"
              className="w-full rounded-r border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-brand-ink">
            Country
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
          >
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-secondary disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save contact"}
        </button>
      </div>
    </SectionCard>
  );
}

function PrefsSection({ initial }: { initial: SettingsInitial }) {
  const [cities, setCities] = useState<string[]>(initial.preferred_cities);
  const [opt, setOpt] = useState(initial.marketing_opt_in);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updatePrefsAction({
        preferred_cities: cities,
        marketing_opt_in: opt,
      });
      if (result.ok) toast.success("Preferences updated.");
      else toast.error(result.error);
    });
  }

  return (
    <SectionCard
      title="Travel preferences"
      description="Helps Vilo surface the right stays for you on the home page."
    >
      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-brand-ink">
            Preferred cities
          </label>
          <div className="flex flex-wrap gap-2">
            {SA_CITIES.map((city) => {
              const on = cities.includes(city);
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() =>
                    setCities(
                      on ? cities.filter((c) => c !== city) : [...cities, city],
                    )
                  }
                  className={`rounded-pill border px-3 py-1.5 text-xs font-medium transition ${
                    on
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-line bg-white text-brand-mute hover:bg-brand-accent hover:text-brand-ink"
                  }`}
                >
                  {on ? <Check className="-mt-px mr-1 inline h-3 w-3" /> : null}
                  {city}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex cursor-pointer items-start justify-between gap-3 rounded border border-brand-line bg-brand-light/40 p-4">
          <div>
            <div className="font-display text-sm font-semibold text-brand-ink">
              Send me marketing emails
            </div>
            <p className="mt-1 text-xs leading-relaxed text-brand-mute">
              Featured stays, host stories and deals — max one email a week.
            </p>
          </div>
          <input
            type="checkbox"
            checked={opt}
            onChange={(e) => setOpt(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
          />
        </label>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-secondary disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

function AccountSection({ email }: { email: string }) {
  return (
    <SectionCard
      title="Account"
      description="Your sign-in details and security."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded border border-brand-line bg-brand-light/40 p-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Email
            </div>
            <div className="mt-1 font-mono text-sm text-brand-ink">{email}</div>
          </div>
          <div className="text-xs text-brand-mute">
            Email change ships with the account-management slice.
          </div>
        </div>

        <Link
          href="/forgot-password"
          className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-light"
        >
          Change password
        </Link>
      </div>
    </SectionCard>
  );
}
