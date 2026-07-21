"use server";

import { headers } from "next/headers";

import { findFreeSlug, getAffiliateForUser } from "@/lib/affiliate/account";
import { activateAffiliateIfReady } from "@/lib/affiliate/activation";
import { recordAcceptance } from "@/lib/affiliate/agreement";
import { agreementHash, normaliseIp } from "@/lib/affiliate/agreement.crypto";
import { renderAgreementBody } from "@/lib/affiliate/agreement.shared";
import { bindAffiliateReferral } from "@/lib/affiliate/attribution";
import { getConsentVersion } from "@/lib/auth/consent";
import { isBreachedPassword } from "@/lib/auth/password";
import { checkSignupRateLimit } from "@/lib/auth/rateLimit";
import {
  sendSignupCollisionEmail,
  sendVerificationEmail,
} from "@/lib/auth/verifyEmail";
import { getBrandName } from "@/lib/brand";
import { getPublishedLegalDocument } from "@/lib/legalDocuments";
import { combineName } from "@/lib/profile/name";
import { isHoneypotTripped } from "@/lib/security/honeypot";
import { clientIpFromHeaders, verifyTurnstile } from "@/lib/security/turnstile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { partnerSignupSchema, type PartnerSignupInput } from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  // `signInUrl` is set when the failure is "this email already has an account" —
  // the form turns it into a sign-in link that carries them back to finish
  // joining. No session is issued on that path.
  | { ok: false; error: string; signInUrl?: string };

export type PartnerSignupResult = {
  /** Where the browser should go next. */
  redirectTo: string;
  /** True when every gate but email confirmation is already clear. */
  awaitingEmail: boolean;
};

/**
 * Public affiliate signup — the per-campaign onboarding form.
 *
 * Creates a free Wielo account, signs the affiliate agreement, opens a PENDING
 * affiliate account, and drops the partner into their portal on a "finish setup"
 * checklist. They become active the moment the last gate closes (normally
 * confirming their email) — see lib/affiliate/activation.ts.
 *
 * Security: this is an anonymous, public endpoint that provisions accounts, so
 * it carries the same hardening as guest signup (honeypot → rate limit →
 * Turnstile → breached password) and, critically, the same ANTI-ENUMERATION
 * behaviour. An email that already exists never yields a session here: we email
 * the real owner and tell the caller to sign in. Handing a session to whoever
 * typed an address is exactly the takeover hole closed in 550a6eac, and a new
 * public form is where it would come back.
 */
export async function createPartnerAccountAction(
  input: PartnerSignupInput,
  captchaToken?: string | null,
  honeypot?: string | null,
): Promise<ActionResult<PartnerSignupResult>> {
  if (isHoneypotTripped(honeypot)) {
    return { ok: false, error: "Could not create your account. Try again." };
  }

  const parsed = partnerSignupSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }
  const d = parsed.data;
  const full_name = combineName(d.first_name, d.surname);
  const pw = d.password && d.password.length > 0 ? d.password : null;

  const hdrs = headers();
  const origin = hdrs.get("origin") ?? "";
  const ip = clientIpFromHeaders(hdrs);

  const limit = await checkSignupRateLimit(ip);
  if (!limit.ok) {
    return {
      ok: false,
      error: "Too many signups from this network. Please try again later.",
    };
  }

  const captcha = await verifyTurnstile(captchaToken, ip);
  if (!captcha.ok) {
    return {
      ok: false,
      error: "Couldn't verify you're human. Refresh and try again.",
    };
  }

  if (pw && (await isBreachedPassword(pw))) {
    return {
      ok: false,
      error:
        "That password has appeared in a data breach. Please choose a different one.",
    };
  }

  const admin = createAdminClient();

  // Resolve the competition (if any) BEFORE creating anything, so a bad slug
  // fails cleanly rather than leaving a half-onboarded partner.
  const campaign = await resolveSignupCampaign(admin, d.campaign_slug);
  if (d.campaign_slug && !campaign) {
    return { ok: false, error: "That competition isn't open for signups." };
  }

  // Campaign rules are enforced from the DB, never from the submitted boolean:
  // a forged `campaign_rules: true` can't skip a doc, and a missing one can't
  // block a campaign that publishes none.
  const rulesDoc = campaign?.rules_doc_slug
    ? await getPublishedLegalDocument(campaign.rules_doc_slug)
    : null;
  if (rulesDoc && d.campaign_rules !== true) {
    return {
      ok: false,
      error: "Please accept the competition rules to enter.",
    };
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email: d.email,
      ...(pw ? { password: pw } : {}),
      email_confirm: true,
      user_metadata: { full_name },
    },
  );
  if (createErr || !created?.user) {
    const msg = createErr?.message?.toLowerCase() ?? "";
    if (
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists")
    ) {
      // Existing account → NO session. Mail the real owner, and send the caller
      // to sign in; the `next` carries them back to finish joining afterwards.
      await sendSignupCollisionEmail({ email: d.email, origin });
      const next = campaign
        ? `/portal/affiliates/competitions?join=${encodeURIComponent(campaign.slug)}`
        : "/portal/affiliates";
      return {
        ok: false,
        error:
          "You already have a Wielo account with this email — please sign in to continue.",
        signInUrl: `/login?next=${encodeURIComponent(next)}`,
      };
    }
    return { ok: false, error: "Could not create your account. Try again." };
  }
  const newUserId = created.user.id;

  // Establish the session so they land inside their portal (mirrors guest
  // signup: password users sign in, passwordless verify a server-minted link).
  const supabase = createServerClient();
  if (pw) {
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: d.email,
      password: pw,
    });
    if (signInErr) {
      return {
        ok: false,
        error: "Account was created but sign-in failed. Try signing in.",
      };
    }
  } else {
    const { data: link } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: d.email,
    });
    const hashed = link?.properties?.hashed_token;
    if (!hashed) {
      return {
        ok: false,
        error: "Account was created but sign-in failed. Try signing in.",
      };
    }
    const { error: otpErr } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: hashed,
    });
    if (otpErr) {
      return {
        ok: false,
        error: "Account was created but sign-in failed. Try signing in.",
      };
    }
  }

  await admin
    .from("user_profiles")
    .update({
      full_name,
      role: "guest",
      terms_accepted_at: new Date().toISOString(),
      terms_version: await getConsentVersion(),
    })
    .eq("id", newUserId);

  // Open the affiliate account in PENDING — it exists, but earns nothing and is
  // on no leaderboard until the gates close.
  const [{ data: settings }, brand] = await Promise.all([
    admin
      .from("affiliate_settings")
      .select("terms_version, terms_content, currency")
      .eq("id", true)
      .maybeSingle(),
    getBrandName(),
  ]);
  const version = settings?.terms_version ?? "v1";

  const slug = await findFreeSlug(admin, full_name || d.email.split("@")[0]);
  const { error: acctErr } = await admin.from("affiliate_accounts").insert({
    user_id: newUserId,
    slug,
    status: "pending",
    terms_version: version,
    currency: settings?.currency ?? "ZAR",
    signup_campaign_id: campaign?.id ?? null,
    community_name: d.community_name || null,
    region: d.region || null,
  });
  const account = await getAffiliateForUser(admin, newUserId);
  if (acctErr && !account) {
    return { ok: false, error: "Could not start your partner account." };
  }
  if (!account) {
    return { ok: false, error: "Could not start your partner account." };
  }

  // Sign the affiliate agreement — an immutable snapshot of exactly what was
  // shown, its sha256, and the signing IP (WS-6b).
  const signingIp = normaliseIp(
    hdrs.get("cf-connecting-ip") ??
      hdrs.get("x-forwarded-for")?.split(",")[0] ??
      hdrs.get("x-real-ip"),
  );
  const userAgent = hdrs.get("user-agent") ?? undefined;
  const signed = await recordAcceptance(admin, {
    affiliateId: account.id,
    userId: newUserId,
    signatoryEmail: d.email,
    signatoryName: full_name,
    version,
    bodyText: renderAgreementBody(settings?.terms_content ?? "", brand),
    ip: signingIp,
    userAgent,
  });
  if (!signed) {
    return { ok: false, error: "Could not record your agreement. Try again." };
  }

  // Competition rules signature — same immutable shape, keyed to the doc version
  // actually on file so a later edit can't be back-dated onto this signature.
  if (rulesDoc && campaign) {
    const rulesBody = rulesDoc.bodyHtml ?? "";
    await admin.from("affiliate_campaign_rule_acceptances").insert({
      campaign_id: campaign.id,
      affiliate_id: account.id,
      user_id: newUserId,
      signatory_email: d.email,
      signatory_name: full_name,
      doc_slug: rulesDoc.slug,
      doc_version: rulesDoc.version,
      body_snapshot: rulesBody,
      body_sha256: agreementHash(rulesBody),
      ip: signingIp,
      user_agent: userAgent,
    });
  }

  await sendVerificationEmail({
    userId: newUserId,
    email: d.email,
    origin,
    firstName: d.first_name,
  });

  // Attribute this signup to a referring affiliate if a vilo_ref cookie is set —
  // partners can recruit partners.
  await bindAffiliateReferral(newUserId);

  // Everything except email confirmation is already done, so this normally
  // reports "not yet". It still runs: verification can be a no-op in
  // environments where email is already confirmed.
  const { activated } = await activateAffiliateIfReady(admin, account.id);

  return {
    ok: true,
    data: {
      redirectTo: "/portal/affiliates",
      awaitingEmail: !activated,
    },
  };
}

/**
 * Attach the partner's photo after signup.
 *
 * Deliberately a SECOND call rather than part of the signup payload: there is no
 * account (and therefore no folder to write to, and no session to authorise the
 * write) until the account exists. The form holds the chosen file and sends it
 * here the moment signup returns.
 *
 * Writes to the same `avatars` bucket as guest onboarding, under the user's own
 * folder — storage RLS allows an owner to write only under `<user_id>/`, so the
 * session is what constrains the path, not the caller's claim about it.
 *
 * Saved in BOTH places on purpose: `user_profiles.avatar_url` is who they are in
 * the app chrome, `affiliate_accounts.photo_url` is the face on their partner
 * landing page and the race standings.
 */
export async function uploadPartnerPhotoAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file received." };
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "Image is too large — max 5MB." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Only image files are allowed." };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to upload a photo." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) return { ok: false, error: "Upload failed. Try again." };

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = pub.publicUrl;

  const admin = createAdminClient();
  await admin
    .from("user_profiles")
    .update({ avatar_url: url })
    .eq("id", user.id);
  await admin
    .from("affiliate_accounts")
    .update({ photo_url: url })
    .eq("user_id", user.id);

  return { ok: true, data: { url } };
}

/** The campaign behind a signup URL — must be open to be joinable. */
async function resolveSignupCampaign(
  admin: ReturnType<typeof createAdminClient>,
  slug?: string | null,
): Promise<{
  id: string;
  slug: string;
  rules_doc_slug: string | null;
} | null> {
  if (!slug) return null;
  const { data } = await admin
    .from("affiliate_campaigns")
    .select("id, slug, rules_doc_slug, status, eligible_partners")
    .ilike("slug", slug)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  // An invite-only competition has no public signup page.
  if (data.eligible_partners === "invite") return null;
  return { id: data.id, slug: data.slug, rules_doc_slug: data.rules_doc_slug };
}
