import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  hostFirstName?: string;
  guestName?: string;
  listingName?: string;
  checkIn?: string;
  checkOut?: string;
  refundAmount?: string | null;
  cancelledBy?: "guest" | "host" | "system";
  bookingId?: string;
};

export default function BookingCancelledHost({
  hostFirstName = "there",
  guestName = "the guest",
  listingName = "your listing",
  checkIn = "—",
  checkOut = "—",
  refundAmount = null,
  cancelledBy = "guest",
  bookingId = "",
}: Props) {
  const by =
    cancelledBy === "guest"
      ? `${guestName} cancelled`
      : cancelledBy === "host"
        ? "You cancelled"
        : "Wielo cancelled automatically";

  return (
    <Layout preview={`${guestName} cancelled their stay at ${listingName}.`}>
      <Heading>A booking was cancelled</Heading>
      <Text>Hi {hostFirstName},</Text>
      <Text>
        {by} the {checkIn} → {checkOut} stay at <strong>{listingName}</strong>.
        The dates are now open on your calendar again.
      </Text>

      {refundAmount ? (
        <Text style={{ margin: "8px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Guest refund:</span>{" "}
          <strong>{refundAmount}</strong> — per your cancellation policy.
        </Text>
      ) : null}

      <Button href={`${APP_URL}/dashboard/bookings/${bookingId}`}>
        Open booking
      </Button>
    </Layout>
  );
}
