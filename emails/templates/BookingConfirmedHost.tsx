import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  hostFirstName?: string;
  guestName?: string;
  guestEmail?: string;
  listingName?: string;
  checkIn?: string;
  checkOut?: string;
  totalAmount?: string;
  bookingId?: string;
};

export default function BookingConfirmedHost({
  hostFirstName = "there",
  guestName = "Your guest",
  guestEmail = "—",
  listingName = "your listing",
  checkIn = "—",
  checkOut = "—",
  totalAmount = "—",
  bookingId = "",
}: Props) {
  return (
    <Layout
      preview={`${guestName} is booked at ${listingName} — ${checkIn} to ${checkOut}.`}
    >
      <Heading>Booking confirmed</Heading>
      <Text>Hi {hostFirstName},</Text>
      <Text>
        <strong>{guestName}</strong> is confirmed at{" "}
        <strong>{listingName}</strong>. Payment has cleared and the dates are
        now blocked across all your calendars.
      </Text>

      <Text style={{ margin: "8px 0", fontSize: 14 }}>
        <span style={{ color: "#6B7280" }}>Stay:</span>{" "}
        <strong>
          {checkIn} → {checkOut}
        </strong>
      </Text>
      <Text style={{ margin: "8px 0", fontSize: 14 }}>
        <span style={{ color: "#6B7280" }}>Total:</span>{" "}
        <strong>{totalAmount}</strong>
      </Text>
      <Text style={{ margin: "8px 0", fontSize: 14 }}>
        <span style={{ color: "#6B7280" }}>Guest email:</span>{" "}
        <strong style={{ fontFamily: "monospace" }}>{guestEmail}</strong>
      </Text>

      <Button href={`${APP_URL}/dashboard/bookings/${bookingId}`}>
        Open booking
      </Button>
    </Layout>
  );
}
