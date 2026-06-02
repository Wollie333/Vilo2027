"use server";

import { revalidatePath } from "next/cache";

import { encryptAccountNumber } from "@/lib/crypto/banking";
import { createServerClient } from "@/lib/supabase/server";

import {
  bankAccountSchema,
  businessDetailsSchema,
  resolveBankName,
  type BankAccountInput,
  type BusinessDetailsInput,
} from "./schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };

const PLAN_GATE_MSG = "Banking details aren't available on your plan.";

async function resolveHost(): Promise<
  { ok: true; hostId: string } | { ok: false; error: string }
> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to manage banking." };
  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) return { ok: false, error: "No host profile on this account." };
  return { ok: true, hostId: host.id };
}

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

async function clearExistingDefault(hostId: string): Promise<void> {
  const supabase = createServerClient();
  await supabase
    .from("eft_banking_details")
    .update({ is_default: false })
    .eq("host_id", hostId)
    .eq("is_default", true);
}

export async function createBankAccountAction(
  input: BankAccountInput,
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

  // If the user wants this account to be the default, clear the existing
  // default first — the partial unique index will reject the INSERT otherwise.
  // Also: if the host has no accounts yet, make this one the default.
  const { count } = await supabase
    .from("eft_banking_details")
    .select("id", { count: "exact", head: true })
    .eq("host_id", host.hostId)
    .eq("is_archived", false);

  const shouldBeDefault = parsed.data.is_default || (count ?? 0) === 0;
  if (shouldBeDefault) await clearExistingDefault(host.hostId);

  // encryptAccountNumber returns the value encrypted with v1.… if
  // BANKING_CIPHER_KEY is set, otherwise the plain digits. Either way the
  // value round-trips through decryptAccountNumber transparently.
  const storedAccount = encryptAccountNumber(parsed.data.account_number);

  const { error } = await supabase.from("eft_banking_details").insert({
    host_id: host.hostId,
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
    await clearExistingDefault(host.hostId);
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

  await clearExistingDefault(host.hostId);

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

  const { error } = await supabase.from("host_business_details").upsert(
    {
      host_id: host.hostId,
      legal_name: toNullable(parsed.data.legal_name),
      trading_name: toNullable(parsed.data.trading_name),
      vat_number: toNullable(parsed.data.vat_number),
      company_registration_number: toNullable(
        parsed.data.company_registration_number,
      ),
      billing_address_line1: toNullable(parsed.data.billing_address_line1),
      billing_address_line2: toNullable(parsed.data.billing_address_line2),
      billing_city: toNullable(parsed.data.billing_city),
      billing_postcode: toNullable(parsed.data.billing_postcode),
      billing_country: parsed.data.billing_country.toUpperCase(),
    },
    { onConflict: "host_id" },
  );
  if (error) {
    return { ok: false, error: "Could not save the business details." };
  }

  revalidatePath("/dashboard/settings/banking");
  revalidatePath("/dashboard/settings");
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
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const storagePath = `${host.hostId}/logo-${crypto.randomUUID()}.${ext}`;

  const { data: existing } = await supabase
    .from("host_business_details")
    .select("logo_path")
    .eq("host_id", host.hostId)
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
    .from("host_business_details")
    .upsert(
      { host_id: host.hostId, logo_path: storagePath },
      { onConflict: "host_id" },
    );
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
  const { data: existing } = await supabase
    .from("host_business_details")
    .select("logo_path")
    .eq("host_id", host.hostId)
    .maybeSingle();
  if (existing?.logo_path) {
    await supabase.storage.from(LOGO_BUCKET).remove([existing.logo_path]);
  }
  await supabase
    .from("host_business_details")
    .update({ logo_path: null })
    .eq("host_id", host.hostId);
  revalidatePath("/dashboard/settings/banking");
  return { ok: true };
}
