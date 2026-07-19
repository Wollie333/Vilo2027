import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

import { FirePurchase } from "@/components/site/FirePurchase";
import { SiteChrome } from "@/components/site/SiteChrome";
import { BookingConfirmationCard } from "@/components/site/BookingConfirmationCard";
import { MarmaladeThankYou } from "@/components/site/marmalade/MarmaladeThankYou";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import {
  getHostWebsiteCapi,
  sendCapiPurchase,
} from "@/lib/integrations/meta-capi";
import {
  capturePayPalOrderForBooking,
  confirmHostCardPaymentByReference,
} from "@/lib/payments/pay-booking";
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

type SP = {
  site?: string;
  b?: string;
  reference?: string;
  trxref?: string;
  // PayPal appends ?token=<orderId>&PayerID=… to the return URL.
  token?: string;
  paypal?: string;
};

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
  guest_email: string | null;
  guest_phone: string | null;
  capi_purchase_sent_at: string | null;
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
    "id, reference, status, payment_status, payment_method, total_amount, currency, check_in, check_out, guests_count, host_id, property_id, guest_name, guest_email, guest_phone, capi_purchase_sent_at";

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

  // PayPal just returned (approval → ?token=<orderId>) — capture on the host's
  // app and settle the booking (idempotent). A cancel (?paypal=cancel) has no
  // token, so the booking stays pending and the expire cron cleans it up.
  const paypalOrderId = sp?.token?.trim();
  if (
    booking.payment_method === "paypal" &&
    paypalOrderId &&
    booking.status !== "confirmed"
  ) {
    try {
      await capturePayPalOrderForBooking({
        orderId: paypalOrderId,
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
      // Leave the booking as-is; the page shows the processing state.
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

  // Meta CAPI (server-side) Purchase — fires the HOST's own pixel via their own
  // CAPI token (Website → Settings), deduped against their browser Purchase via
  // event_id = booking.reference. Once per booking (reuses capi_purchase_sent_at;
  // a website booking never touches Wielo's CAPI). Best-effort.
  if (purchase && !ctx.preview && !booking.capi_purchase_sent_at) {
    try {
      const creds = await getHostWebsiteCapi(ctx.websiteId);
      if (creds) {
        const c = await cookies();
        const fwd = h.get("x-forwarded-for") ?? "";
        const clientIp =
          fwd.split(",")[0]?.trim() || h.get("x-real-ip") || null;
        const host = h.get("x-forwarded-host") || h.get("host") || "";
        const scheme =
          host.startsWith("localhost") || host.startsWith("127.")
            ? "http"
            : "https";
        const sent = await sendCapiPurchase(
          {
            eventId: purchase.transactionId,
            eventSourceUrl: host ? `${scheme}://${host}/book/thank-you` : "",
            email: booking.guest_email,
            phone: booking.guest_phone,
            clientIp,
            userAgent: h.get("user-agent"),
            fbp: c.get("_fbp")?.value ?? null,
            fbc: c.get("_fbc")?.value ?? null,
            value: purchase.value,
            currency: purchase.currency,
            contentIds: purchase.contentIds,
            contents: purchase.items.map((i) => ({
              id: i.item_id,
              quantity: i.quantity,
              item_price: i.price,
            })),
            numItems: purchase.numItems,
          },
          creds,
        );
        if (sent) {
          await admin
            .from("bookings")
            .update({ capi_purchase_sent_at: new Date().toISOString() })
            .eq("id", booking.id);
        }
      }
    } catch {
      // best-effort — the host's browser pixel still fires
    }
  }

  // Shared copy + rows (used by both the generic card and the bespoke themes).
  const firstName = booking.guest_name ? booking.guest_name.split(" ")[0] : "";
  const heading = isConfirmed
    ? "You're booked in 🎉"
    : isEftPending
      ? "Almost there — complete your transfer"
      : "We're confirming your payment";
  const message = isConfirmed
    ? `Thanks${firstName ? `, ${firstName}` : ""} — a confirmation is on its way to your email.`
    : isEftPending
      ? "Your booking is reserved. Transfer the amount below using your booking reference and the host will confirm once it reflects."
      : "This can take a moment. We'll email your confirmation as soon as it's settled.";
  const totalStr = money(total, currency) ?? "—";
  const eftRows = eft
    ? [
        { label: "Account holder", value: eft.account_holder },
        { label: "Bank", value: eft.bank_name },
        { label: "Account number", value: eft.account_number },
        { label: "Branch code", value: eft.branch_code },
        { label: "Account type", value: eft.account_type },
        { label: "Use reference", value: booking.reference ?? "—" },
      ]
    : null;
  const genericRows = [
    { label: "Reference", value: booking.reference ?? "—" },
    {
      label: "Dates",
      value:
        booking.check_in && booking.check_out
          ? `${booking.check_in} → ${booking.check_out}`
          : "—",
    },
    { label: "Guests", value: String(booking.guests_count ?? "—") },
  ];

  const isMarmalade = ctx.theme.preset === "marmalade";
  // Marmalade summary rows (reference is shown in its own chip): arrive / depart /
  // guests·nights, with the amount folded in as a row when it's still to be paid.
  const nights =
    booking.check_in && booking.check_out
      ? Math.max(
          0,
          Math.round(
            (Date.parse(booking.check_out) - Date.parse(booking.check_in)) /
              86_400_000,
          ),
        )
      : 0;
  const mmRows = [
    { label: "Arrive", value: booking.check_in ?? "—" },
    { label: "Depart", value: booking.check_out ?? "—" },
    {
      label: "Guests · nights",
      value: `${booking.guests_count ?? "—"} · ${nights || "—"}`,
    },
  ];

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
        preset={ctx.theme.preset}
        header={ctx.theme.header}
        footer={ctx.theme.footer}
        pageHasHero={isMarmalade}
      >
        <FirePurchase purchase={purchase} />
        {isMarmalade ? (
          <MarmaladeThankYou
            brandName={ctx.brand.name}
            handLine={
              isConfirmed
                ? "see you soon!"
                : isEftPending
                  ? "almost there!"
                  : "one moment…"
            }
            heading={heading}
            message={message}
            confirmed={isConfirmed}
            reference={booking.reference}
            rows={
              isEftPending
                ? [...mmRows, { label: "Amount to transfer", value: totalStr }]
                : mmRows
            }
            total={isEftPending ? null : totalStr}
            eft={eftRows}
            primaryCta={{ label: "Back to home", href: "/" }}
            secondaryCta={{ label: "Get in touch", href: "/contact" }}
            footnote={
              isConfirmed
                ? "Booked direct — no booking fees were charged."
                : null
            }
          />
        ) : (
          <BookingStyleOverlay
            node={bookingStyle}
            sectionType="booking_confirmation"
          >
            <BookingConfirmationCard
              heading={heading}
              message={message}
              rows={genericRows}
              total={totalStr}
              eft={eftRows}
            />
          </BookingStyleOverlay>
        )}
      </SiteChrome>
    </SiteThemeRoot>
  );
}
