import dynamic from "next/dynamic";

import type { WebsiteSection } from "@/lib/website/sections.schema";
import type {
  CheckoutRoom,
  CheckoutAddon,
} from "@/app/[locale]/site/book/SiteCheckoutForm";

import { BookingConfirmationCard } from "../BookingConfirmationCard";

// Builder V3 — the checkout + thank-you SYSTEM-PAGE elements, as shown in the
// builder canvas. These render the REAL live components (the same SiteCheckoutForm
// the /book route ships, and the shared BookingConfirmationCard the thank-you route
// ships) in an INERT preview with generic demo data — so the host styles the ACTUAL
// page, not a look-alike. The live routes render the same components with real data
// and apply the host's saved `--el-*` styling via BookingStyleOverlay.
//
// SiteCheckoutForm is lazy-loaded (it's a large client component) so the checkout
// bundle never lands in every guest-facing site page — booking_form only ever
// renders here, in the builder.
const SiteCheckoutForm = dynamic(() =>
  import("@/app/[locale]/site/book/SiteCheckoutForm").then((m) => ({
    default: m.SiteCheckoutForm,
  })),
);

type BookingConfirmationProps = Extract<
  WebsiteSection,
  { type: "booking_confirmation" }
>["props"];

// Generic demo data for the checkout preview — realistic rooms/add-ons so the host
// sees the true form anatomy. All booking DATA is dynamic on the live route; this
// is purely for the builder canvas.
const DEMO_ROOMS: CheckoutRoom[] = [
  {
    id: "demo-olive",
    name: "Olive Room",
    price: 1300,
    currency: "ZAR",
    maxGuests: 2,
    minGuests: 1,
    minNights: 1,
  },
  {
    id: "demo-vineyard",
    name: "Vineyard Suite",
    price: 1900,
    currency: "ZAR",
    maxGuests: 3,
    minGuests: 1,
    minNights: 1,
  },
  {
    id: "demo-loft",
    name: "Mountain Loft",
    price: 2100,
    currency: "ZAR",
    maxGuests: 4,
    minGuests: 1,
    minNights: 2,
  },
];

const DEMO_ADDONS: CheckoutAddon[] = [
  {
    id: "demo-breakfast",
    name: "Breakfast hamper",
    description: "Farm eggs, estate olives, fresh bread and good coffee.",
    imageUrl: null,
    pricingModel: "per_guest_per_night",
    unitPrice: 180,
    currency: "ZAR",
    minQuantity: 1,
    maxQuantity: null,
    allowCustom: false,
    stock: null,
    isRequired: false,
    roomIds: null,
  },
  {
    id: "demo-game-drive",
    name: "Sunset game drive",
    description:
      "Two hours on the reserve with a guide as the light goes gold.",
    imageUrl: null,
    pricingModel: "per_guest",
    unitPrice: 650,
    currency: "ZAR",
    minQuantity: 1,
    maxQuantity: null,
    allowCustom: false,
    stock: null,
    isRequired: false,
    roomIds: null,
  },
  {
    id: "demo-transfer",
    name: "Airport transfer",
    description: "Private return transfer from Cape Town International.",
    imageUrl: null,
    pricingModel: "per_stay",
    unitPrice: 1400,
    currency: "ZAR",
    minQuantity: 1,
    maxQuantity: 1,
    allowCustom: false,
    stock: null,
    isRequired: false,
    roomIds: null,
  },
];

/**
 * Checkout (/book) builder element — renders the REAL SiteCheckoutForm as an inert
 * preview (no network, no submit, pay button disabled) with demo data, wrapped so
 * canvas clicks select the node instead of interacting with the form. `props` is
 * accepted for the registry contract but the form's copy is intrinsic.
 */
export function BookingFormSection() {
  return (
    <div style={{ pointerEvents: "none" }}>
      <SiteCheckoutForm
        preview
        websiteId="demo"
        propertyId="demo"
        propertyName="Olive Grove Guesthouse"
        currency="ZAR"
        maxGuests={6}
        basePrice={1850}
        bookingMode="whole_and_rooms"
        rooms={DEMO_ROOMS}
        addons={DEMO_ADDONS}
        cardAvailable
        eftAvailable
        paypalAvailable
        cancellation={{
          title: "Moderate cancellation",
          note: "Free cancellation up to 7 days before check-in.",
        }}
        initial={{ from: "", to: "", guests: 2, roomId: null, scope: null }}
      />
    </div>
  );
}

/**
 * Thank-you (/book/thank-you) builder element — renders the SAME shared
 * BookingConfirmationCard the live route ships, with demo booking data.
 */
export function BookingConfirmationSection({
  props,
}: {
  props: BookingConfirmationProps;
}) {
  const heading = props.heading?.trim() || "You're booked in 🎉";
  const message =
    props.body?.trim() || "A confirmation is on its way to your email.";
  return (
    <BookingConfirmationCard
      heading={heading}
      message={message}
      rows={[
        { label: "Reference", value: "WLO-4827" },
        { label: "Dates", value: "12 Aug → 15 Aug" },
        { label: "Guests", value: "2" },
      ]}
      total="R 3,900"
      eft={null}
    />
  );
}
