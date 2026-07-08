"use server";

import { headers } from "next/headers";

import { bindAffiliateReferral } from "@/lib/affiliate/attribution";
import { TERMS_VERSION } from "@/lib/auth/consent";
import { isBreachedPassword } from "@/lib/auth/password";
import { checkSignupRateLimit } from "@/lib/auth/rateLimit";
import {
  sendExistingAccountNotice,
  sendVerificationEmail,
} from "@/lib/auth/verifyEmail";
import { startProductCheckoutDirect } from "@/lib/billing/product-checkout";
import { clientIpFromHeaders, verifyTurnstile } from "@/lib/security/turnstile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { combineName } from "@/lib/profile/name";

import {
  accountSchema,
  finalizeOnboardingSchema,
  type AccountInput,
  type FinalizeOnboardingInput,
} from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// ─── Step 1: create the auth user + sign them in ─────────────────
//
// Soft email verification (see lib/auth/verifyEmail.ts): GoTrue auto-confirms
// on this project, so its email_confirmed_at is useless as a "proved they own
// the inbox" signal. We create the account, track verification ourselves in
// user_profiles.email_verified_at (left null here), email a signed confirm
// link via Resend, and sign the user in so they can finish onboarding. A
// persistent in-app banner nags until they click the link. Hardened with an IP
// rate limit, Turnstile, and a breached-password check before any account is
// created.

export async function createAccountAction(
  input: AccountInput,
  captchaToken?: string | null,
): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }
  const d = parsed.data;
  const full_name = combineName(d.first_name, d.surname);

  const hdrs = headers();
  const origin = hdrs.get("origin") ?? "";
  const ip = clientIpFromHeaders(hdrs);

  // 1. Rate limit — the admin create path bypasses Supabase's per-IP throttle.
  const limit = await checkSignupRateLimit(ip);
  if (!limit.ok) {
    return {
      ok: false,
      error: "Too many signups from this network. Please try again later.",
    };
  }

  // 2. Bot check (inert until TURNSTILE_SECRET_KEY is set).
  const captcha = await verifyTurnstile(captchaToken, ip);
  if (!captcha.ok) {
    return {
      ok: false,
      error: "Couldn't verify you're human. Refresh and try again.",
    };
  }

  // 3. Reject known-breached passwords (best-effort; never blocks on outage).
  if (await isBreachedPassword(d.password)) {
    return {
      ok: false,
      error:
        "That password has appeared in a data breach. Please choose a different one.",
    };
  }

  const admin = createAdminClient();

  // 4. Provision the user. GoTrue auto-confirms on this project, so we create
  //    them confirmed (guaranteed password sign-in for the wizard) and track
  //    "has proven they own the inbox" ourselves via email_verified_at below.
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email: d.email,
      password: d.password,
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
      // Anti-enumeration: don't confirm the email is registered. Email the real
      // owner a heads-up instead, and return a neutral, non-committal message.
      await sendExistingAccountNotice({ email: d.email, origin });
      return {
        ok: false,
        error:
          "We couldn't complete your signup. If you already have an account, sign in or reset your password.",
      };
    }
    return { ok: false, error: "Could not create your account. Try again." };
  }
  const newUserId = created.user.id;

  // 5. Sign them in so the wizard can continue under their session.
  const supabase = createServerClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: d.email,
    password: d.password,
  });
  if (signInErr) {
    return {
      ok: false,
      error: "Account was created but sign-in failed. Try signing in manually.",
    };
  }

  // 6. Record legal consent (the wizard forced the Terms + Privacy checkbox).
  //    email_verified_at stays null → the soft "confirm your email" banner shows
  //    until they click the link in step 7's email.
  await admin
    .from("user_profiles")
    .update({
      full_name,
      terms_accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
    })
    .eq("id", newUserId);

  // 7. Send the confirmation email (best-effort — inert without a Resend key).
  await sendVerificationEmail({
    userId: newUserId,
    email: d.email,
    origin,
    firstName: d.first_name,
  });

  // Attribute this signup to a referring affiliate if a vilo_ref cookie is set.
  // Keyed on the user — the host row is created later in finalizeOnboardingAction.
  await bindAffiliateReferral(newUserId);

  return { ok: true };
}

// ─── Avatar upload — used by step 2 (About you) ──────────────────
//
// Mirrors the guest-side action: uploads to the `avatars` bucket at
// <user_id>/avatar-<ts>.<ext> and returns the public URL. Storage RLS
// (avatars bucket: owner can write/update under their folder) ensures
// the user can only write under their own folder.

export async function uploadHostAvatarAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file received." };
  }
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
    return {
      ok: false,
      error: "Your session expired — sign back in to upload a photo.",
    };
  }

  // Use the admin storage client so the upload doesn't depend on session
  // cookies being readable inside this server-action context. The path is
  // still scoped to user.id from the authenticated session above.
  const admin = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) {
    console.error("[host-onboarding:uploadAvatar] failed", uploadErr);
    return { ok: false, error: `Upload failed: ${uploadErr.message}` };
  }

  const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
  return { ok: true, data: { url: pub.publicUrl } };
}

// ─── Paid plan chosen during signup → start checkout for that product ──
//
// Called after finalize (host exists, free subscription created). Creates a
// product order tied to the signed-in user's email and returns its pay-link;
// the webhook upgrades their subscription to the product's plan once paid.

export async function startSignupCheckoutAction(
  slug: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, error: "Your session expired — sign in to continue." };
  }
  // Goes straight to the Paystack card form when card is available (skips the
  // redundant /pay/product summary page); falls back to that page for EFT-only.
  const r = await startProductCheckoutDirect(slug, user.email);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, url: r.url };
}

// ─── Final step: create profile + host + listing + free subscription ─

export type FinalizeOnboardingData = {
  host_id: string;
  handle: string;
  plan: "free" | "basic" | "pro" | "business";
  billing_cycle: "monthly" | "annual";
};

export async function finalizeOnboardingAction(
  input: FinalizeOnboardingInput,
): Promise<ActionResult<FinalizeOnboardingData>> {
  const parsed = finalizeOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "Please check the form and try again.",
    };
  }
  const d = parsed.data;

  // We authenticate via the user-bound client so we can trust auth.uid(),
  // then switch to the service-role client for the writes. Reasons:
  //  - user_profiles RLS forbids users changing their own `role` column
  //    (WITH CHECK requires the new role to equal the old role), so the
  //    user-bound update would silently fail for the guest→host promotion.
  //  - The host_id chain (hosts → listings → subscriptions) is cleaner
  //    under one privileged code path that won't half-succeed because of
  //    RLS edge cases. We already validated the user above.
  const userClient = createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: "Your session expired — sign back in to finish onboarding.",
    };
  }

  const admin = createAdminClient();

  // Bail if onboarding already ran (e.g. double-submit, duplicate tab).
  // Return the existing host so the wizard can still render the receipt
  // (with `data.plan`/`data.billing_cycle` from the current submission).
  const { data: existingHost } = await admin
    .from("hosts")
    .select("id, handle")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingHost) {
    const eh = existingHost as { id: string; handle: string };
    return {
      ok: true,
      data: {
        host_id: eh.id,
        handle: eh.handle,
        plan: d.plan,
        billing_cycle: d.billing_cycle,
      },
    };
  }

  // 1. Profile — every field collected in the About step persisted on
  //    user_profiles so they survive past onboarding.
  const { error: profileErr } = await admin
    .from("user_profiles")
    .update({
      full_name: d.full_name,
      phone: d.phone,
      country: d.country,
      bio: d.bio && d.bio.length > 0 ? d.bio : null,
      languages: d.languages,
      avatar_url: d.avatar_url && d.avatar_url.length > 0 ? d.avatar_url : null,
      role: "host",
    })
    .eq("id", user.id);
  if (profileErr) {
    return { ok: false, error: "Could not save your details. Try again." };
  }

  // 2. Host row — handle auto-generated by trigger_host_handle from
  //    display_name. bio + languages mirrored onto hosts so the public
  //    host page can render them without joining user_profiles.
  const { data: host, error: hostErr } = await admin
    .from("hosts")
    .insert({
      user_id: user.id,
      display_name: d.full_name,
      bio: d.bio && d.bio.length > 0 ? d.bio : null,
      languages_spoken: d.languages,
      // Mirror avatar onto hosts so the public host page + listing cards
      // can render it without joining user_profiles.
      avatar_url: d.avatar_url && d.avatar_url.length > 0 ? d.avatar_url : null,
    })
    .select("id, handle")
    .single();
  if (hostErr || !host) {
    return {
      ok: false,
      error: "Could not create your host profile. Try again.",
    };
  }

  // 3. First DRAFT listing — full address collected, capacity/pricing/
  //    photos stay NULL until the host opens the listing editor.
  //    If this fails we KEEP the host row (the user is still a host, they
  //    can create a listing from the dashboard) — avoids the stuck state
  //    where the cleanup deletes the host and leaves the user homeless.
  // Enrich the auto-created default business (made by the
  // on_host_created_default_business trigger when the host row was inserted)
  // with the captured business name + this listing's address, so the host's
  // first business — and every document for this listing — is properly named.
  await admin
    .from("businesses")
    .update({
      trading_name:
        d.business_name && d.business_name.length > 0
          ? d.business_name
          : d.full_name,
      address_line1: d.address_line1,
      address_line2:
        d.address_line2 && d.address_line2.length > 0 ? d.address_line2 : null,
      city: d.city,
      province: d.region,
      postal_code: d.postal_code,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
    })
    .eq("host_id", host.id)
    .eq("is_default", true);

  const { error: listingErr } = await admin.from("properties").insert({
    host_id: host.id,
    property_type: "accommodation",
    category_id: d.category_id ?? null,
    accommodation_type: d.accommodation_type ?? null,
    name: d.listing_name,
    address_line1: d.address_line1,
    address_line2:
      d.address_line2 && d.address_line2.length > 0 ? d.address_line2 : null,
    city: d.city,
    province: d.region,
    postal_code: d.postal_code,
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    // country defaults to 'ZA'; business_id is filled by the
    // set_listing_default_business trigger (the host's default business).
  });
  if (listingErr) {
    // Non-blocking — host can create their first listing from the editor.
    // Surface it as a soft warning rather than failing the whole onboard.
    console.error("[host-onboarding] listings insert failed", listingErr);
  }

  // 3b. If they paid for a product before signing up, link that paid order to
  //     the new account so the purchase shows in their billing / the Wielo
  //     ledger. If the product maps to a subscription plan (slug === plan key),
  //     start them on that plan instead of Free. Non-blocking.
  let resolvedPlan: "free" | "basic" | "pro" | "business" = "free";
  let resolvedProductId: string | null = null;
  if (d.purchased_order_token) {
    const { data: order } = await admin
      .from("product_orders")
      .select("id, product_id, status")
      .eq("pay_token", d.purchased_order_token)
      .maybeSingle();
    if (order && order.status === "paid") {
      await admin
        .from("product_orders")
        .update({ payer_user_id: user.id })
        .eq("id", order.id);

      // The product is authoritative for gating/scopes — record it on the
      // subscription (check_feature_permission resolves from product_features).
      // Derive `plan` from the product slug only when it matches a real plan key
      // (FK to plans.key); a bespoke product keeps the host on Free for the FK.
      if (order.product_id) {
        resolvedProductId = order.product_id;
        const { data: prod } = await admin
          .from("products")
          .select("slug")
          .eq("id", order.product_id)
          .maybeSingle();
        const slug = prod?.slug ?? null;
        if (slug) {
          const { data: planRow } = await admin
            .from("plans")
            .select("key")
            .eq("key", slug)
            .maybeSingle();
          if (planRow) resolvedPlan = planRow.key as typeof resolvedPlan;
        }
      }
    }
  }

  // 4. Subscription — Free unless a purchased product maps to a paid plan.
  //    product_id records the exact catalog product (drives gating). Payment
  //    auto-renewal lands later. Non-blocking on failure.
  await admin.from("subscriptions").insert({
    host_id: host.id,
    plan: resolvedPlan,
    product_id: resolvedProductId,
    status: "active",
  });

  // Return the host id + chosen plan so the wizard can render a
  // thank-you / receipt step. The user clicks through to /dashboard
  // themselves — no server-side redirect.
  return {
    ok: true,
    data: {
      host_id: host.id,
      handle: host.handle,
      plan: d.purchased_order_token ? resolvedPlan : d.plan,
      billing_cycle: d.billing_cycle,
    },
  };
}
