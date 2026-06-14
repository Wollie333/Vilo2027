"use server";

import { revalidatePath } from "next/cache";

import { encryptAccountNumber } from "@/lib/crypto/banking";
import {
  decryptSecret,
  encryptSecret,
  secretLast4,
} from "@/lib/crypto/payments";
import {
  createPaystackPaymentLink,
  validatePaystackSecret,
} from "@/lib/paystack";
import {
  assertBusinessOwnership,
  getDefaultBusinessId,
} from "@/lib/business/resolveBusiness";
import { requireHost as resolveHost } from "@/lib/host/current";
import {
  getHostPaystack,
  getHostPaystackForBusiness,
} from "@/lib/payments/host-paystack";
import { validatePayPalCredentials } from "@/lib/paypal";
import { createServerClient } from "@/lib/supabase/server";

import {
  bankAccountSchema,
  businessDetailsSchema,
  defaultCurrencySchema,
  paymentGatewaySchema,
  paymentLinkSchema,
  resolveBankName,
  type BankAccountInput,
  type BusinessDetailsInput,
  type DefaultCurrencyInput,
  type PaymentGateway,
  type PaymentGatewayInput,
  type PaymentLinkInput,
} from "./schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };

const PLAN_GATE_MSG = "Banking details aren't available on your plan.";

// Pre-MVP policy (AGENT_RULES.md §3.4): every feature is open to the free
// plan while there's no subscription management UI. The RPC infrastructure
// stays wired so Phase 3 can flip the gate per-plan without code changes.
//
// To re-enable strict gating later, replace the body with the original:
//   const { data } = await supabase.rpc("check_feature_permission", {
//     p_host_id: hostId,
//     p_feature_key: "banking_details",
//   });
//   return (data as { is_enabled: boolean } | null)?.is_enabled ?? false;
async function assertFeatureEnabled(hostId: string): Promise<boolean> {
  if (!hostId) return false;
  return true;
}

async function assertAccountOwnership(
  accountId: string,
  hostId: string,
): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("eft_banking_details")
    .select("id")
    .eq("id", accountId)
    .eq("host_id", hostId)
    .maybeSingle();
  return !!data;
}

// Default is now scoped per business (the partial unique index is per
// business_id). Clear the current default within the SAME business before
// promoting a new one, or the unique index rejects the write.
async function clearExistingDefault(businessId: string): Promise<void> {
  const supabase = createServerClient();
  await supabase
    .from("eft_banking_details")
    .update({ is_default: false })
    .eq("business_id", businessId)
    .eq("is_default", true);
}

// Resolve the business an account belongs to (banking is per-business).
async function accountBusinessId(accountId: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("eft_banking_details")
    .select("business_id")
    .eq("id", accountId)
    .maybeSingle();
  return data?.business_id ?? null;
}

export async function createBankAccountAction(
  input: BankAccountInput,
  businessId?: string,
): Promise<ActionResult> {
  const parsed = bankAccountSchema.safeParse(input);
  if (!parsed.success) {
    // Surface the first Zod issue so callers (and the user) see the
    // specific field that failed, not a generic catch-all.
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "Please check the form and try again.",
    };
  }
  if (!parsed.data.account_number) {
    return { ok: false, error: "Enter the account number." };
  }

  const host = await resolveHost();
  if (!host.ok) return host;
  if (!(await assertFeatureEnabled(host.hostId))) {
    return { ok: false, error: PLAN_GATE_MSG };
  }

  const supabase = createServerClient();

  // Banking is per-business. Use the caller-supplied business (verified owned)
  // or fall back to the host's default business so the legacy single-business
  // banking UI keeps working unchanged.
  const targetBusinessId =
    businessId &&
    (await assertBusinessOwnership(supabase, businessId, host.hostId))
      ? businessId
      : await getDefaultBusinessId(supabase, host.hostId);
  if (!targetBusinessId) {
    return { ok: false, error: "No business to attach this account to." };
  }

  // If the user wants this account to be the default, clear the existing
  // default first — the partial unique index will reject the INSERT otherwise.
  // Also: if this business has no accounts yet, make this one the default.
  const { count } = await supabase
    .from("eft_banking_details")
    .select("id", { count: "exact", head: true })
    .eq("business_id", targetBusinessId)
    .eq("is_archived", false);

  const shouldBeDefault = parsed.data.is_default || (count ?? 0) === 0;
  if (shouldBeDefault) await clearExistingDefault(targetBusinessId);

  // encryptAccountNumber returns the value encrypted with v1.… if
  // BANKING_CIPHER_KEY is set, otherwise the plain digits. Either way the
  // value round-trips through decryptAccountNumber transparently.
  const storedAccount = encryptAccountNumber(parsed.data.account_number);

  const { error } = await supabase.from("eft_banking_details").insert({
    host_id: host.hostId,
    business_id: targetBusinessId,
    label: parsed.data.label,
    bank_name: resolveBankName(parsed.data),
    account_holder: parsed.data.account_holder,
    account_number: storedAccount,
    account_type: parsed.data.account_type,
    branch_code: parsed.data.branch_code,
    swift_code: parsed.data.swift_code || null,
    reference_format: parsed.data.reference_format,
    is_default: shouldBeDefault,
    is_archived: false,
  });
  if (error) {
    return { ok: false, error: "Could not save the bank account." };
  }

  revalidatePath("/dashboard/settings/banking");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  return { ok: true };
}

export async function updateBankAccountAction(
  accountId: string,
  input: BankAccountInput,
): Promise<ActionResult> {
  const parsed = bankAccountSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "Please check the form and try again.",
    };
  }

  const host = await resolveHost();
  if (!host.ok) return host;
  if (!(await assertFeatureEnabled(host.hostId))) {
    return { ok: false, error: PLAN_GATE_MSG };
  }
  if (!(await assertAccountOwnership(accountId, host.hostId))) {
    return { ok: false, error: "Account not found." };
  }

  if (parsed.data.is_default) {
    const bizId = await accountBusinessId(accountId);
    if (bizId) await clearExistingDefault(bizId);
  }

  const update: Record<string, unknown> = {
    label: parsed.data.label,
    bank_name: resolveBankName(parsed.data),
    account_holder: parsed.data.account_holder,
    account_type: parsed.data.account_type,
    branch_code: parsed.data.branch_code,
    swift_code: parsed.data.swift_code || null,
    reference_format: parsed.data.reference_format,
    is_default: parsed.data.is_default,
  };

  // Only re-store if the user supplied a new account number. Empty input
  // means "keep the existing stored value" (encrypted or plain).
  if (parsed.data.account_number) {
    update.account_number = encryptAccountNumber(parsed.data.account_number);
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("eft_banking_details")
    .update(update)
    .eq("id", accountId)
    .eq("host_id", host.hostId);
  if (error) {
    return { ok: false, error: "Could not update the bank account." };
  }

  revalidatePath("/dashboard/settings/banking");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  return { ok: true };
}

export async function setDefaultBankAccountAction(
  accountId: string,
): Promise<ActionResult> {
  const host = await resolveHost();
  if (!host.ok) return host;
  if (!(await assertFeatureEnabled(host.hostId))) {
    return { ok: false, error: PLAN_GATE_MSG };
  }
  if (!(await assertAccountOwnership(accountId, host.hostId))) {
    return { ok: false, error: "Account not found." };
  }

  const bizId = await accountBusinessId(accountId);
  if (bizId) await clearExistingDefault(bizId);

  const supabase = createServerClient();
  const { error } = await supabase
    .from("eft_banking_details")
    .update({ is_default: true })
    .eq("id", accountId)
    .eq("host_id", host.hostId)
    .eq("is_archived", false);
  if (error) {
    return { ok: false, error: "Could not set the default account." };
  }

  revalidatePath("/dashboard/settings/banking");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  return { ok: true };
}

export async function archiveBankAccountAction(
  accountId: string,
): Promise<ActionResult> {
  const host = await resolveHost();
  if (!host.ok) return host;
  if (!(await assertFeatureEnabled(host.hostId))) {
    return { ok: false, error: PLAN_GATE_MSG };
  }

  const supabase = createServerClient();
  const { data: account } = await supabase
    .from("eft_banking_details")
    .select("id, is_default")
    .eq("id", accountId)
    .eq("host_id", host.hostId)
    .maybeSingle();
  if (!account) return { ok: false, error: "Account not found." };

  if (account.is_default) {
    return {
      ok: false,
      error:
        "Set another account as default before archiving this one — invoices and EFT need a default.",
    };
  }

  const { error } = await supabase
    .from("eft_banking_details")
    .update({ is_archived: true })
    .eq("id", accountId)
    .eq("host_id", host.hostId);
  if (error) {
    return { ok: false, error: "Could not archive the account." };
  }

  revalidatePath("/dashboard/settings/banking");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  return { ok: true };
}

export async function saveBusinessDetailsAction(
  input: BusinessDetailsInput,
): Promise<ActionResult> {
  const parsed = businessDetailsSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "Please check the form and try again.",
    };
  }

  const host = await resolveHost();
  if (!host.ok) return host;
  if (!(await assertFeatureEnabled(host.hostId))) {
    return { ok: false, error: PLAN_GATE_MSG };
  }

  const supabase = createServerClient();
  const toNullable = (v: string | undefined) => (v && v.length > 0 ? v : null);

  // Write to the host's DEFAULT business (the single source of truth that drives
  // documents) rather than the deprecated host_business_details. Map the form's
  // billing_* fields onto the businesses columns. (This form now only renders in
  // the finish-setup flow.)
  const bizId = await getDefaultBusinessId(supabase, host.hostId);
  if (!bizId) {
    return { ok: false, error: "No business to save these details to." };
  }
  const { error } = await supabase
    .from("businesses")
    .update({
      legal_name: toNullable(parsed.data.legal_name),
      trading_name: toNullable(parsed.data.trading_name),
      vat_number: toNullable(parsed.data.vat_number),
      company_registration_number: toNullable(
        parsed.data.company_registration_number,
      ),
      address_line1: toNullable(parsed.data.billing_address_line1),
      address_line2: toNullable(parsed.data.billing_address_line2),
      city: toNullable(parsed.data.billing_city),
      postal_code: toNullable(parsed.data.billing_postcode),
      country: parsed.data.billing_country.toUpperCase(),
    })
    .eq("id", bizId)
    .eq("host_id", host.hostId);
  if (error) {
    return { ok: false, error: "Could not save the business details." };
  }

  revalidatePath("/dashboard/setup");
  revalidatePath("/dashboard/settings/businesses");
  return { ok: true };
}

// ─── Host logo (branded financial documents) ─────────────────────
const LOGO_BUCKET = "host-logos";

export type LogoUploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Store the host's logo for branded quotes / invoices / credit notes. The
 * client resizes the image before upload, so this just validates + stores it
 * in the public host-logos bucket under the host's own folder (RLS-gated).
 */
export async function uploadHostLogoAction(
  formData: FormData,
): Promise<LogoUploadResult> {
  const host = await resolveHost();
  if (!host.ok) return host;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file selected." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "Logo must be under 5 MB." };
  }
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG or WebP image." };
  }

  const supabase = createServerClient();
  // The logo lives on the host's DEFAULT business (documents resolve their logo
  // from the listing's business → default fallback). This setup-flow uploader
  // writes the default; per-business logos are managed under Settings → Businesses.
  const bizId = await getDefaultBusinessId(supabase, host.hostId);
  if (!bizId) {
    return { ok: false, error: "No business to attach the logo to." };
  }
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const storagePath = `${host.hostId}/logo-${crypto.randomUUID()}.${ext}`;

  const { data: existing } = await supabase
    .from("businesses")
    .select("logo_path")
    .eq("id", bizId)
    .maybeSingle();

  const { error: upErr } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (upErr) return { ok: false, error: "Upload failed. Try a smaller file." };

  const { error: rowErr } = await supabase
    .from("businesses")
    .update({ logo_path: storagePath })
    .eq("id", bizId)
    .eq("host_id", host.hostId);
  if (rowErr) {
    await supabase.storage.from(LOGO_BUCKET).remove([storagePath]);
    return { ok: false, error: "Upload saved but record failed." };
  }

  if (existing?.logo_path && existing.logo_path !== storagePath) {
    await supabase.storage.from(LOGO_BUCKET).remove([existing.logo_path]);
  }

  const { data: pub } = supabase.storage
    .from(LOGO_BUCKET)
    .getPublicUrl(storagePath);
  revalidatePath("/dashboard/settings/banking");
  return { ok: true, url: pub.publicUrl };
}

export async function removeHostLogoAction(): Promise<ActionResult> {
  const host = await resolveHost();
  if (!host.ok) return host;
  const supabase = createServerClient();
  const bizId = await getDefaultBusinessId(supabase, host.hostId);
  if (!bizId) return { ok: true };
  const { data: existing } = await supabase
    .from("businesses")
    .select("logo_path")
    .eq("id", bizId)
    .maybeSingle();
  if (existing?.logo_path) {
    await supabase.storage.from(LOGO_BUCKET).remove([existing.logo_path]);
  }
  await supabase
    .from("businesses")
    .update({ logo_path: null })
    .eq("id", bizId)
    .eq("host_id", host.hostId);
  revalidatePath("/dashboard/settings/banking");
  return { ok: true };
}

// ─── Payment gateways (host's own Paystack / PayPal) ──────────────
// Each host connects their OWN gateway credentials so booking payments settle
// directly into their account (Vilo takes 0%). Secrets are encrypted at rest
// (PAYMENT_CIPHER_KEY) and never returned to the client. New secrets are
// validated live against the gateway before we store them.

const GATEWAY_PLAN_MSG = "Payment gateways aren't available on your plan.";

export async function savePaymentGatewayAction(
  input: PaymentGatewayInput,
): Promise<ActionResult> {
  const parsed = paymentGatewaySchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "Please check the form and try again.",
    };
  }

  const host = await resolveHost();
  if (!host.ok) return host;
  if (!(await assertFeatureEnabled(host.hostId))) {
    return { ok: false, error: GATEWAY_PLAN_MSG };
  }

  const supabase = createServerClient();
  // Gateways are per-business — verify the target business belongs to this host.
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", parsed.data.business_id)
    .eq("host_id", host.hostId)
    .maybeSingle();
  if (!biz) return { ok: false, error: "That business isn't yours." };

  const { data: existing } = await supabase
    .from("host_payment_gateways")
    .select("id")
    .eq("business_id", parsed.data.business_id)
    .eq("gateway", parsed.data.gateway)
    .maybeSingle();

  const newSecret = parsed.data.secret ?? "";
  const hasNewSecret = newSecret.length > 0;
  if (!existing && !hasNewSecret) {
    return {
      ok: false,
      error:
        parsed.data.gateway === "paystack"
          ? "Enter your Paystack secret key."
          : "Enter your PayPal client secret.",
    };
  }

  // Validate live whenever a new secret is supplied — reject bad credentials
  // rather than storing something that will fail at payment time.
  let environment = parsed.data.environment;
  if (hasNewSecret) {
    if (parsed.data.gateway === "paystack") {
      const r = await validatePaystackSecret(newSecret);
      if (!r.valid) {
        return {
          ok: false,
          error: "Paystack rejected that secret key. Double-check it.",
        };
      }
      environment = r.environment; // trust the key prefix (sk_test_ / sk_live_)
    } else {
      const ok = await validatePayPalCredentials({
        clientId: parsed.data.public_identifier,
        secret: newSecret,
        env: parsed.data.environment,
      });
      if (!ok) {
        return {
          ok: false,
          error:
            "PayPal rejected those credentials for the selected environment.",
        };
      }
    }
  }

  const descriptor =
    parsed.data.gateway === "paystack"
      ? parsed.data.statement_descriptor || null
      : null;

  const base = {
    host_id: host.hostId,
    business_id: parsed.data.business_id,
    gateway: parsed.data.gateway,
    environment,
    public_identifier: parsed.data.public_identifier,
    statement_descriptor: descriptor,
    is_enabled: parsed.data.is_enabled,
  };

  if (existing) {
    const update: Record<string, unknown> = { ...base };
    if (hasNewSecret) {
      update.secret_cipher = encryptSecret(newSecret);
      update.secret_last4 = secretLast4(newSecret);
      update.last_validated_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("host_payment_gateways")
      .update(update)
      .eq("id", existing.id)
      .eq("host_id", host.hostId);
    if (error) return { ok: false, error: "Could not save the gateway." };
  } else {
    const { error } = await supabase.from("host_payment_gateways").insert({
      ...base,
      secret_cipher: encryptSecret(newSecret),
      secret_last4: secretLast4(newSecret),
      last_validated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: "Could not save the gateway." };
  }

  revalidatePath("/dashboard/settings/banking");
  return { ok: true };
}

export async function togglePaymentGatewayAction(
  businessId: string,
  gateway: PaymentGateway,
  enabled: boolean,
): Promise<ActionResult> {
  const host = await resolveHost();
  if (!host.ok) return host;
  const supabase = createServerClient();
  const { error } = await supabase
    .from("host_payment_gateways")
    .update({ is_enabled: enabled })
    .eq("host_id", host.hostId)
    .eq("business_id", businessId)
    .eq("gateway", gateway);
  if (error) return { ok: false, error: "Could not update the gateway." };
  revalidatePath("/dashboard/settings/banking");
  return { ok: true };
}

/**
 * Live "test connection" for a saved gateway — decrypts the stored secret and
 * pings the provider so the host can confirm the integration works (and which
 * mode it's in) without re-entering the key.
 */
export async function testPaymentGatewayAction(
  businessId: string,
  gateway: PaymentGateway,
): Promise<{ ok: true; mode: "test" | "live" } | { ok: false; error: string }> {
  const host = await resolveHost();
  if (!host.ok) return host;
  const supabase = createServerClient();
  const { data: row } = await supabase
    .from("host_payment_gateways")
    .select("id, secret_cipher, public_identifier, environment")
    .eq("host_id", host.hostId)
    .eq("business_id", businessId)
    .eq("gateway", gateway)
    .maybeSingle();
  if (!row?.secret_cipher) {
    return { ok: false, error: "No credentials saved for this gateway yet." };
  }

  let secret: string;
  try {
    secret = decryptSecret(row.secret_cipher);
  } catch {
    return { ok: false, error: "Stored secret couldn't be read." };
  }

  if (gateway === "paystack") {
    const r = await validatePaystackSecret(secret);
    if (!r.valid) {
      return { ok: false, error: "Paystack didn't accept the saved key." };
    }
    await supabase
      .from("host_payment_gateways")
      .update({ last_validated_at: new Date().toISOString() })
      .eq("id", row.id);
    return { ok: true, mode: r.environment };
  }

  const okPaypal = await validatePayPalCredentials({
    clientId: row.public_identifier,
    secret,
    env: row.environment as "test" | "live",
  });
  if (!okPaypal) {
    return { ok: false, error: "PayPal didn't accept the saved credentials." };
  }
  await supabase
    .from("host_payment_gateways")
    .update({ last_validated_at: new Date().toISOString() })
    .eq("id", row.id);
  return { ok: true, mode: row.environment as "test" | "live" };
}

export async function deletePaymentGatewayAction(
  businessId: string,
  gateway: PaymentGateway,
): Promise<ActionResult> {
  const host = await resolveHost();
  if (!host.ok) return host;
  const supabase = createServerClient();
  const { error } = await supabase
    .from("host_payment_gateways")
    .delete()
    .eq("host_id", host.hostId)
    .eq("business_id", businessId)
    .eq("gateway", gateway);
  if (error) return { ok: false, error: "Could not remove the gateway." };
  revalidatePath("/dashboard/settings/banking");
  return { ok: true };
}

export async function setDefaultCurrencyAction(
  input: DefaultCurrencyInput,
): Promise<ActionResult> {
  const parsed = defaultCurrencySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick a valid currency." };
  const host = await resolveHost();
  if (!host.ok) return host;
  const supabase = createServerClient();
  const { error } = await supabase
    .from("hosts")
    .update({ default_currency: parsed.data.default_currency })
    .eq("id", host.hostId);
  if (error) {
    return { ok: false, error: "Could not update the default currency." };
  }
  revalidatePath("/dashboard/settings/banking");
  return { ok: true };
}

export type PaymentLinkResult =
  | { ok: true; url: string; reference: string }
  | { ok: false; error: string };

/**
 * Create a shareable Paystack payment link on the host's own account so they
 * can take a real payment today (pre guest-portal). Money settles directly to
 * the host; the host's statement descriptor rides along.
 */
export async function createPaymentLinkAction(
  input: PaymentLinkInput,
  businessId?: string,
): Promise<PaymentLinkResult> {
  const parsed = paymentLinkSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Please check the form." };
  }
  const host = await resolveHost();
  if (!host.ok) return host;

  // One source of truth for the host's connected, enabled Paystack secret.
  // Gateways are per-business: charge the selected business's Paystack when one
  // is supplied (verified owned), else fall back to the host's default business.
  const ownsBusiness =
    businessId &&
    (await assertBusinessOwnership(
      createServerClient(),
      businessId,
      host.hostId,
    ));
  const hostPaystack = ownsBusiness
    ? await getHostPaystackForBusiness(businessId!)
    : await getHostPaystack(host.hostId);
  if (!hostPaystack) {
    return {
      ok: false,
      error: "Connect and enable your Paystack account first.",
    };
  }

  try {
    const result = await createPaystackPaymentLink({
      amount: parsed.data.amount,
      email: parsed.data.email,
      description: parsed.data.description || undefined,
      statementDescriptor: hostPaystack.statementDescriptor,
      secretKey: hostPaystack.secretKey,
    });
    return { ok: true, url: result.url, reference: result.reference };
  } catch {
    return {
      ok: false,
      error: "Paystack could not create the link. Re-check your keys.",
    };
  }
}
