import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

// Pre-MVP feature-gate policy (AGENT_RULES.md §3.4): every gated feature is
// open to the free plan while there's no subscription management UI. The
// check_feature_permission infrastructure stays in place so plans can be
// narrowed in Phase 3 without code changes.
//
// Business identity, billing address and per-business EFT banking now live on
// the dedicated "Businesses" tab (one source of truth per business). This tab
// keeps the account-wide card payment gateways (the host's own Paystack /
// PayPal), which settle directly to the host regardless of business.

import { createServerClient } from "@/lib/supabase/server";

import type { GatewayView } from "./_components/PaymentGatewayDialog";
import { PaymentGatewaysSection } from "./_components/PaymentGatewaysSection";
import type { Currency, PaymentGateway } from "./schemas";

export const metadata: Metadata = {
  title: "Payment processors · Settings",
};

export const dynamic = "force-dynamic";

export default async function CardPaymentsSettingsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: host } = await supabase
    .from("hosts")
    .select("id, default_currency")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) redirect("/dashboard/settings");

  // Never select any *_secret_cipher — it must not reach the client.
  const { data: gatewayRows } = await supabase
    .from("host_payment_gateways")
    .select(
      "business_id, gateway, environment, public_identifier, secret_last4, statement_descriptor, is_enabled, last_validated_at, mode, test_public_identifier, test_secret_last4, live_public_identifier, live_secret_last4",
    )
    .eq("host_id", host.id);

  const gateways: GatewayView[] = (gatewayRows ?? []).map((row) => ({
    business_id: row.business_id as string,
    gateway: row.gateway as PaymentGateway,
    environment: row.environment as "test" | "live",
    public_identifier: row.public_identifier ?? "",
    secret_last4: row.secret_last4 ?? "",
    statement_descriptor: row.statement_descriptor,
    is_enabled: row.is_enabled,
    last_validated_at: row.last_validated_at,
    mode: (row.mode as "test" | "live" | null) ?? "test",
    test_public_identifier: row.test_public_identifier,
    test_secret_last4: row.test_secret_last4,
    live_public_identifier: row.live_public_identifier,
    live_secret_last4: row.live_secret_last4,
  }));

  // The host's businesses — gateways are connected per business.
  const { data: bizRows } = await supabase
    .from("businesses")
    .select("id, trading_name, legal_name")
    .eq("host_id", host.id)
    .eq("is_archived", false)
    .order("is_default", { ascending: false });
  const businesses = (bizRows ?? []).map((b) => ({
    id: b.id as string,
    name: (b.trading_name || b.legal_name || "Business") as string,
  }));
  const defaultCurrency = (host.default_currency ?? "ZAR") as Currency;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-brand-ink">
          Payment processors
        </h2>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-brand-accent px-2.5 py-1 text-[11px] font-medium text-brand-secondary">
          <ShieldCheck className="h-3 w-3" />
          Encrypted at rest
        </span>
      </div>
      <p className="-mt-2 text-sm text-brand-mute">
        Connect your own Paystack or PayPal so card payments settle directly
        into your account — Wielo never touches the money. Gateways are set{" "}
        <strong>per business</strong> (like EFT banking) — a booking charges the
        gateway of its listing&rsquo;s business.
      </p>

      <PaymentGatewaysSection
        gateways={gateways}
        businesses={businesses}
        defaultCurrency={defaultCurrency}
      />
    </div>
  );
}
