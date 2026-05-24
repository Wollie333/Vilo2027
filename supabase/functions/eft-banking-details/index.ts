// Edge Function: eft-banking-details
//
// Exposes a host's default banking details to a verified guest with an EFT
// booking. Per AGENT_RULES.md §1.5 banking details may only be exposed via
// an Edge Function, and per §4.4 only when payment_method='eft' AND the
// booking is in pending_eft / pending_eft_review.
//
// Request:  POST { booking_id: uuid }
//           Authorization: Bearer <guest JWT>
//
// Response: { success: true, data: { banking, business, reference } }
//        |  { success: false, error: { code, message } }
//
// Never log the decrypted account number or the ciphertext.

// @ts-expect-error Deno-only import — TypeScript in the Next workspace can't
// resolve esm.sh, but the function runs on Supabase's Deno runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

import { decryptAccountNumber } from "../_shared/banking-crypto.ts";

// @ts-expect-error Deno global
const env = Deno.env;

type ErrorCode =
  | "UNAUTHORIZED"
  | "METHOD_NOT_ALLOWED"
  | "INVALID_INPUT"
  | "BOOKING_NOT_FOUND"
  | "NOT_BOOKING_GUEST"
  | "EFT_NOT_APPLICABLE"
  | "NO_DEFAULT_BANK_ACCOUNT"
  | "DECRYPT_FAILED";

const HTTP_FOR_CODE: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  METHOD_NOT_ALLOWED: 405,
  INVALID_INPUT: 400,
  BOOKING_NOT_FOUND: 404,
  NOT_BOOKING_GUEST: 403,
  EFT_NOT_APPLICABLE: 409,
  NO_DEFAULT_BANK_ACCOUNT: 404,
  DECRYPT_FAILED: 500,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, x-client-info, apikey",
};

function errorResponse(code: ErrorCode, message: string): Response {
  return new Response(
    JSON.stringify({ success: false, error: { code, message } }),
    {
      status: HTTP_FOR_CODE[code],
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

function successResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function adminClient() {
  const url = env.get("SUPABASE_URL");
  const serviceKey = env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error(
      "eft-banking-details: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function userClient(jwt: string) {
  const url = env.get("SUPABASE_URL");
  const anonKey = env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error(
      "eft-banking-details: SUPABASE_URL and SUPABASE_ANON_KEY must be set.",
    );
  }
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function applyReferenceFormat(format: string, bookingRef: string): string {
  return format.replace(/\{booking_ref\}/g, bookingRef);
}

// @ts-expect-error Deno global
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Use POST.");
  }

  const authHeader = req.headers.get("Authorization");
  const jwt = authHeader?.replace(/^Bearer\s+/i, "") ?? null;
  if (!jwt) {
    return errorResponse("UNAUTHORIZED", "Missing bearer token.");
  }

  let payload: { booking_id?: unknown };
  try {
    payload = (await req.json()) as { booking_id?: unknown };
  } catch {
    return errorResponse("INVALID_INPUT", "Body must be JSON.");
  }
  const bookingId = payload.booking_id;
  if (typeof bookingId !== "string" || bookingId.length < 16) {
    return errorResponse("INVALID_INPUT", "booking_id is required.");
  }

  // Resolve the caller via the JWT-scoped client (RLS-enforced).
  const supabaseUser = userClient(jwt);
  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    return errorResponse("UNAUTHORIZED", "Invalid or expired token.");
  }

  // Service-role client for the actual data read (we cross host/guest
  // boundaries and need to read the host's banking_details row, which the
  // guest's JWT cannot under RLS).
  const supabase = adminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, host_id, guest_id, status, payment_method, reference")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) {
    return errorResponse("BOOKING_NOT_FOUND", "We couldn't find that booking.");
  }
  if (booking.guest_id !== user.id) {
    return errorResponse(
      "NOT_BOOKING_GUEST",
      "You're not the guest on this booking.",
    );
  }
  if (booking.payment_method !== "eft") {
    return errorResponse("EFT_NOT_APPLICABLE", "This booking isn't using EFT.");
  }
  if (
    booking.status !== "pending_eft" &&
    booking.status !== "pending_eft_review"
  ) {
    return errorResponse(
      "EFT_NOT_APPLICABLE",
      "EFT instructions aren't available for this booking's status.",
    );
  }

  const { data: account } = await supabase
    .from("eft_banking_details")
    .select(
      "label, bank_name, account_holder, account_number, account_type, branch_code, swift_code, reference_format",
    )
    .eq("host_id", booking.host_id)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();

  if (!account) {
    return errorResponse(
      "NO_DEFAULT_BANK_ACCOUNT",
      "The host hasn't set up EFT banking yet.",
    );
  }

  let accountNumber: string;
  try {
    accountNumber = await decryptAccountNumber(account.account_number);
  } catch {
    return errorResponse(
      "DECRYPT_FAILED",
      "Banking details are temporarily unavailable.",
    );
  }

  const { data: business } = await supabase
    .from("host_business_details")
    .select(
      "legal_name, trading_name, vat_number, company_registration_number, billing_address_line1, billing_address_line2, billing_city, billing_postcode, billing_country",
    )
    .eq("host_id", booking.host_id)
    .maybeSingle();

  return successResponse({
    banking: {
      label: account.label,
      bank_name: account.bank_name,
      account_holder: account.account_holder,
      account_number: accountNumber,
      account_type: account.account_type,
      branch_code: account.branch_code,
      swift_code: account.swift_code,
    },
    business: business ?? null,
    reference: applyReferenceFormat(
      account.reference_format,
      booking.reference,
    ),
  });
});
