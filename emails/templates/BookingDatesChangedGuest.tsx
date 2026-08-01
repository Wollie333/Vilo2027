import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  guestFirstName?: string;
  listingName?: string;
  hostName?: string;
  oldCheckIn?: string;
  oldCheckOut?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  totalAmount?: string;
  bookingReference?: string;
  bookingId?: string;
};

export default function BookingDatesChangedGuest({
  guestFirstName = "there",
  listingName = "your stay",
  hostName = "your host",
  oldCheckIn = "—",
  oldCheckOut = "—",
  checkIn = "—",
  checkOut = "—",
  nights = 1,
  totalAmount = "—",
  bookingReference = "WIELO-XXXX",
  bookingId = "",
}: Props) {
  return (
    <Layout
      preview={`Your dates at ${listingName} moved to ${checkIn} → ${checkOut}.`}
    >
      <Heading>Your booking dates have changed</Heading>
      <Text>Hi {guestFirstName},</Text>
      <Text>
        {hostName} updated the dates for your stay at{" "}
        <strong>{listingName}</strong>. Here&apos;s what changed:
      </Text>

      <div
        style={{
          background: "#FAFAFA",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: 20,
          margin: "16px 0",
        }}
      >
        <Text style={{ margin: "2px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Was:</span>{" "}
          <span style={{ textDecoration: "line-through", color: "#9CA3AF" }}>
            {oldCheckIn} → {oldCheckOut}
          </span>
        </Text>
        <Text style={{ margin: "2px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Now:</span>{" "}
          <strong>
            {checkIn} → {checkOut}
          </strong>
        </Text>
        <Text style={{ margin: "2px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Length of stay:</span>{" "}
          <strong>
            {nights} {nights === 1 ? "night" : "nights"}
          </strong>
        </Text>
        <Text style={{ margin: "2px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Booking total:</span>{" "}
          <strong>{totalAmount}</strong>
        </Text>
        <Text style={{ margin: "2px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Reference:</span>{" "}
          <strong style={{ fontFamily: "monospace" }}>
            {bookingReference}
          </strong>
        </Text>
      </div>

      <Text style={{ fontSize: 14 }}>
        If the total changed, any balance owing or refund due will show on your
        booking. Check the details there and reach out if anything looks off.
      </Text>

      <Button href={`${APP_URL}/booking/${bookingId}/success`}>
        View booking
      </Button>

      <Text style={{ marginTop: 20, fontSize: 13, color: "#6B7280" }}>
        Didn&apos;t expect this change? Reply to this email or message{" "}
        {hostName} through your Wielo inbox.
      </Text>
    </Layout>
  );
}
