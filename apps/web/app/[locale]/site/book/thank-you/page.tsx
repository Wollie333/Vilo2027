import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { FirePurchase } from "@/components/site/FirePurchase";
import { SiteChrome } from "@/components/site/SiteChrome";
import { BookingConfirmationCard } from "@/components/site/BookingConfirmationCard";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { confirmHostCardPaymentByReference } from "@/lib/payments/pay-booking";
import {
  loadSiteContext,
  resolveSiteRef,
  siteBookHref,
} from "@/lib/site/loadSitePage";
import { loadSystemPageStyle } from "@/lib/site/systemPageStyle";
import { BookingStyleOverlay } from "@/components/site/BookingStyleOverlay";
import { siteSurfaceIsDark } from "@/lib/site/themes";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SP = { site?: string; b?: string; reference?: string; trxref?: string };

type EftDetails = {
  account_holder: string;
  bank_name: string;
  account_number: string;
  branch_code: string;
  account_type: string;
};

type BookingRow = {
  id: string;
  reference: string | null;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  total_amount: number | string | null;
  currency: string | null;
  check_in: string | null;
  check_out: string | null;
  guests_count: number | null;
  host_id: string;
  property_id: string;
  guest_name: string | null;
};

function money(total: number | null, currency: string) {
  if (total == null) return "—";
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(total);
  } catch {
    return `${currency} ${total}`;
  }
}

/**
 * On-site thank-you page (Phase 6B/c) — the post-payment landing on the host's
 * own domain. For card payments it confirms the charge via the SAME host-key
 * verification the app success page uses (confirmHostCardPaymentByReference);
 * for EFT it shows the awaiting-transfer state + the host's banking details.
 * Anti-tamper: the booking must belong to a property this site can sell.
 */
export default async function SiteThankYouPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const h = await headers();
  const ref = resolveSiteRef({
    host: h.get("x-wielo-site-host"),
    siteParam: sp?.site,
  });
  if (!ref) notFound();

  const ctx = await loadSiteContext(ref, { siteParam: sp?.site });
  if (!ctx) notFound();

  const bookingId = sp?.b?.trim();
  if (!bookingId) notFound();

  const admin = createAdminClient();
  const select =
    "id, reference, status, payment_status, payment_method, total_amount, currency, check_in, check_out, guests_count, host_id, property_id, guest_name";

  let { data: booking } = await admin
    .from("bookings")
    .select(select)
    .eq("id", bookingId)
    .maybeSingle<BookingRow>();

  // Anti-tamper: the booking must be for one of this site's sellable properties.
  if (!booking || !ctx.propertyIds.includes(booking.property_id)) notFound();

  // Card payment just returned from Paystack — verify with the host's key and
  // settle the booking (idempotent; the webhook is a backstop). Then re-read.
  const providerRef = sp?.reference?.trim() || sp?.trxref?.trim();
  if (
    booking.payment_method === "paystack" &&
    providerRef &&
    booking.status !== "confirmed"
  ) {
    try {
      await confirmHostCardPaymentByReference({
        reference: providerRef,
        hostId: booking.host_id,
        bookingId: booking.id,
      });
      const { data: refreshed } = await admin
        .from("bookings")
        .select(select)
        .eq("id", bookingId)
        .maybeSingle<BookingRow>();
      if (refreshed) booking = refreshed;
    } catch {
      // Leave the booking as-is; the webhook backstop will settle it and the
      // page shows the processing state.
    }
  }

  const currency = booking.currency || "ZAR";
  const total =
    booking.total_amount == null ? null : Number(booking.total_amount);
  const isConfirmed = booking.status === "confirmed";
  const isEftPending =
    booking.payment_method === "eft" || booking.status === "pending_eft";

  // EFT awaiting-transfer → load the host's default banking details.
  let eft: EftDetails | null = null;
  if (isEftPending && !isConfirmed) {
    const { data } = await admin
      .from("eft_banking_details")
      .select(
        "account_holder, bank_name, account_number, branch_code, account_type",
      )
      .eq("host_id", booking.host_id)
      .eq("is_default", true)
      .eq("is_archived", false)
      .maybeSingle<EftDetails>();
    if (data) eft = data;
  }

  // Purchase event (dynamic value + currency) — fired once the booking is paid.
  // Null until confirmed, so EFT-pending / processing states don't count a sale.
  // Host-editable styling of the thank-you's `booking_confirmation` element (from
  // the `thank-you` builder page). Applied as an overlay around the real card.
  const bookingStyle = await loadSystemPageStyle({
    websiteId: ctx.websiteId,
    kind: "thank-you",
    widgetType: "booking_confirmation",
    preview: ctx.preview,
  });

  const purchase =
    isConfirmed && total != null
      ? {
          transactionId: booking.reference || booking.id,
          value: total,
          currency,
          contentName: ctx.brand.name,
          contentIds: [booking.property_id],
          numItems: 1,
          items: [
            {
              item_id: booking.property_id,
              item_name: ctx.brand.name,
              price: total,
              quantity: 1,
            },
          ],
        }
      : null;

  return (
    <SiteThemeRoot theme={ctx.theme}>
      <SiteChrome
        brand={ctx.brand}
        nav={ctx.nav}
        navigation={ctx.navigation}
        conversion={ctx.conversion}
        analytics={ctx.analytics}
        layout={ctx.layout}
        popupForm={ctx.popupForm}
        websiteId={ctx.websiteId}
        bookHref={
          ctx.propertyIds.length > 0 ? siteBookHref(ctx, {}) : undefined
        }
        darkChrome={siteSurfaceIsDark(ctx.theme)}
        header={ctx.theme.header}
        footer={ctx.theme.footer}
        pageHasHero={false}
      >
        <FirePurchase purchase={purchase} />
        <BookingStyleOverlay
          node={bookingStyle}
          sectionType="booking_confirmation"
        >
          <BookingConfirmationCard
            heading={
              isConfirmed
                ? "You're booked in 🎉"
                : isEftPending
                  ? "Almost there — complete your transfer"
                  : "We're confirming your payment"
            }
            message={
              isConfirmed
                ? `Thanks${booking.guest_name ? `, ${booking.guest_name.split(" ")[0]}` : ""} — a confirmation is on its way to your email.`
                : isEftPending
                  ? "Your booking is reserved. Transfer the amount below using your booking reference and the host will confirm once it reflects."
                  : "This can take a moment. We'll email your confirmation as soon as it's settled."
            }
            rows={[
              { label: "Reference", value: booking.reference ?? "—" },
              {
                label: "Dates",
                value:
                  booking.check_in && booking.check_out
                    ? `${booking.check_in} → ${booking.check_out}`
                    : "—",
              },
              { label: "Guests", value: String(booking.guests_count ?? "—") },
            ]}
            total={money(total, currency) ?? "—"}
            eft={
              eft
                ? [
                    { label: "Account holder", value: eft.account_holder },
                    { label: "Bank", value: eft.bank_name },
                    { label: "Account number", value: eft.account_number },
                    { label: "Branch code", value: eft.branch_code },
                    { label: "Account type", value: eft.account_type },
                    { label: "Use reference", value: booking.reference ?? "—" },
                  ]
                : null
            }
          />
        </BookingStyleOverlay>
      </SiteChrome>
    </SiteThemeRoot>
  );
}
