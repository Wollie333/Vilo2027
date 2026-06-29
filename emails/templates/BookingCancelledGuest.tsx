import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wieloplatform.com";

type Props = {
  guestFirstName?: string;
  listingName?: string;
  checkIn?: string;
  checkOut?: string;
  refundAmount?: string | null;
  cancelledBy?: "guest" | "host" | "system";
};

export default function BookingCancelledGuest({
  guestFirstName = "there",
  listingName = "your stay",
  checkIn = "—",
  checkOut = "—",
  refundAmount = null,
  cancelledBy = "host",
}: Props) {
  const intro =
    cancelledBy === "guest"
      ? "Your booking has been cancelled as requested."
      : cancelledBy === "host"
        ? "Your host has had to cancel your booking."
        : "Your booking was cancelled automatically.";

  return (
    <Layout
      preview={`Your stay at ${listingName} — ${checkIn} to ${checkOut} — has been cancelled.`}
    >
      <Heading>Your booking was cancelled</Heading>
      <Text>Hi {guestFirstName},</Text>
      <Text>
        {intro} The dates affected were{" "}
        <strong>
          {checkIn} → {checkOut}
        </strong>{" "}
        at <strong>{listingName}</strong>.
      </Text>

      {refundAmount ? (
        <Text style={{ margin: "8px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Refund:</span>{" "}
          <strong>{refundAmount}</strong> — processed back to your original
          payment method within 5 business days.
        </Text>
      ) : null}

      <Button href={`${APP_URL}/explore`}>Find another place</Button>
    </Layout>
  );
}
