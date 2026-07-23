"use client";

import { ImagePlus } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import {
  ensureTurnstileToken,
  TurnstileWidget,
  turnstileEnabled,
} from "@/components/site/TurnstileWidget";
import { AgreementBody } from "@/components/affiliate/AgreementBody";

import {
  createPartnerAccountAction,
  uploadPartnerPhotoAction,
} from "./actions";

export function PartnerSignupForm({
  brand,
  campaign,
  agreementBody,
  agreementVersion,
  rules,
}: {
  brand: string;
  campaign: { slug: string; name: string; full: boolean } | null;
  agreementBody: string;
  agreementVersion: string;
  rules: { slug: string; title: string } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [region, setRegion] = useState("");
  const [terms, setTerms] = useState(false);
  const [agreement, setAgreement] = useState(false);
  const [campaignRules, setCampaignRules] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [honeypot, setHoneypot] = useState("");
  // The photo is held here until the account exists — there is nowhere to write
  // it before then. Uploaded immediately after signup returns.
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  // Object URLs leak until revoked, so the preview is derived from the file
  // rather than set alongside it — one owner, cleaned up on change/unmount.
  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  // Set when the email already has an account — we never issue a session on
  // that path, so the form offers a sign-in link that returns them here.
  const [signInUrl, setSignInUrl] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSignInUrl(null);
    if (!terms) {
      toast.error("Please accept the platform terms to continue.");
      return;
    }
    if (!agreement) {
      toast.error("Please accept the affiliate agreement to continue.");
      return;
    }
    if (rules && !campaignRules) {
      toast.error("Please accept the competition rules to enter.");
      return;
    }
    start(async () => {
      // A slow connection often lands the token AFTER the visitor is ready to
      // submit. Wait for it here — inside the pending state, so this reads as
      // progress — rather than refusing a submit that is moments from valid.
      const captcha = await ensureTurnstileToken(captchaToken);
      if (turnstileEnabled() && !captcha) {
        toast.error(
          "The human check didn't finish. Check your connection and try again.",
        );
        return;
      }
      const r = await createPartnerAccountAction(
        {
          first_name: firstName,
          surname,
          email,
          password,
          community_name: communityName,
          region,
          terms,
          agreement,
          campaign_rules: campaignRules,
          campaign_slug: campaign?.slug,
        },
        captcha,
        honeypot,
      );
      if (!r.ok) {
        toast.error(r.error);
        if (r.signInUrl) setSignInUrl(r.signInUrl);
        setCaptchaReset((n) => n + 1);
        setCaptchaToken(null);
        return;
      }
      // The account (and its session) now exist, so the held photo has somewhere
      // to go. Never fail the signup over it — they can add one later.
      if (photo) {
        const fd = new FormData();
        fd.append("file", photo);
        const up = await uploadPartnerPhotoAction(fd);
        if (!up.ok) toast.error(`${up.error} You can add a photo later.`);
      }

      toast.success(
        r.data?.awaitingEmail
          ? "Account created — confirm your email to go live."
          : "Welcome aboard, partner!",
      );
      router.push(r.data?.redirectTo ?? "/portal/affiliates");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {campaign?.full ? (
        <div className="rounded-input border border-[#FDE9C8] bg-[#FFFBEB] p-3 text-[12.5px] leading-relaxed text-[#B45309]">
          <strong className="font-semibold">
            {campaign.name} is currently full.
          </strong>{" "}
          You can still sign up as a {brand} partner and start earning — we
          &apos;ll let you know if a place opens up.
        </div>
      ) : null}

      {/* Your photo — optional, but it's the face on the partner landing page
          and the race standings, so it's asked for up front. */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-line bg-white">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreview}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <ImagePlus className="h-5 w-5 text-brand-mute" aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-brand-ink">
            Your photo{" "}
            <span className="font-normal text-brand-mute">(optional)</span>
          </div>
          <p className="mt-0.5 text-[12px] leading-snug text-brand-mute">
            Shown on your partner page and the leaderboard. Max 5MB.
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              className="text-[12px] font-semibold text-brand-primary hover:underline"
            >
              {photo ? "Change photo" : "Choose a photo"}
            </button>
            {photo ? (
              <button
                type="button"
                onClick={() => {
                  setPhoto(null);
                  if (photoInput.current) photoInput.current.value = "";
                }}
                className="text-[12px] font-semibold text-brand-mute hover:underline"
              >
                Remove
              </button>
            ) : null}
          </div>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && f.size > 5 * 1024 * 1024) {
                toast.error("Image is too large — max 5MB.");
                e.target.value = "";
                return;
              }
              setPhoto(f);
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-brand-ink">
            First name
          </label>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jane"
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-brand-ink">
            Surname
          </label>
          <Input
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            placeholder="Doe"
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-brand-ink">
          Email
        </label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-brand-ink">
          Password
        </label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Choose a strong password"
          autoComplete="new-password"
        />
        <PasswordStrengthMeter password={password} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-brand-ink">
            Community or network{" "}
            <span className="font-normal text-brand-mute">(optional)</span>
          </label>
          <Input
            value={communityName}
            onChange={(e) => setCommunityName(e.target.value)}
            placeholder="Karoo Stays Network"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-brand-ink">
            Region <span className="font-normal text-brand-mute">(opt.)</span>
          </label>
          <Input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Mpumalanga"
          />
        </div>
      </div>

      {/* Platform terms — the consent every Wielo account gives. */}
      <label className="flex items-start gap-2.5 text-[12.5px] leading-snug text-brand-mute">
        <input
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
        />
        <span>
          I agree to the{" "}
          <Link
            href="/terms"
            className="font-semibold text-brand-primary hover:underline"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="font-semibold text-brand-primary hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      {/* Affiliate agreement — a SEPARATE act of consent. The exact text shown
          here is what gets snapshotted and hashed against the signature. Styled
          identically to the other two consents: three checkboxes asking for
          three agreements should look like three of the same thing. */}
      <div>
        <label className="flex items-start gap-2.5 text-[12.5px] leading-snug text-brand-mute">
          <input
            type="checkbox"
            checked={agreement}
            onChange={(e) => setAgreement(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
          />
          <span>
            I have read and agree to the{" "}
            <strong className="font-semibold text-brand-ink">
              {brand} Affiliate Agreement
            </strong>{" "}
            <span className="text-brand-mute">({agreementVersion})</span>.
          </span>
        </label>
        <button
          type="button"
          onClick={() => setShowAgreement((v) => !v)}
          className="mt-1.5 pl-[26px] text-[12px] font-semibold text-brand-primary hover:underline"
        >
          {showAgreement ? "Hide agreement" : "Read the agreement"}
        </button>
        {showAgreement ? (
          <div className="rounded-input mt-2 max-h-52 overflow-y-auto border border-brand-line bg-brand-light/50 p-3">
            <AgreementBody rendered={agreementBody} className="text-[12px]" />
          </div>
        ) : null}
      </div>

      {/* Competition rules — only when this campaign publishes some. */}
      {rules ? (
        <label className="flex items-start gap-2.5 text-[12.5px] leading-snug text-brand-mute">
          <input
            type="checkbox"
            checked={campaignRules}
            onChange={(e) => setCampaignRules(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
          />
          <span>
            I accept the{" "}
            <Link
              href={`/legal/${rules.slug}`}
              target="_blank"
              className="font-semibold text-brand-primary hover:underline"
            >
              {rules.title}
            </Link>
            .
          </span>
        </label>
      ) : null}

      {/* Honeypot — off-screen decoy; real users never see or fill it. */}
      <div
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="company_website">Company website</label>
        <input
          id="company_website"
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {turnstileEnabled() ? (
        <TurnstileWidget
          onVerify={setCaptchaToken}
          resetSignal={captchaReset}
        />
      ) : null}

      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending
          ? "Creating your account…"
          : campaign && !campaign.full
            ? "Join and enter the race"
            : "Create my partner account"}
      </Button>

      {signInUrl ? (
        <a
          href={signInUrl}
          className="rounded-input block border border-brand-line bg-white p-3 text-center text-[13px] font-semibold text-brand-primary hover:underline"
        >
          Sign in to continue
        </a>
      ) : null}

      <p className="text-center text-[13px] text-brand-mute">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-brand-ink hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
