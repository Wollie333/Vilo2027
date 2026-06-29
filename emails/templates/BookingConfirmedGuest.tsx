import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wieloplatform.com";

type Props = {
  guestFirstName?: string;
  listingName?: string;
  hostName?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  totalAmount?: string;
  bookingReference?: string;
  bookingId?: string;
  checkInTime?: string;
  address?: string;
};

export default function BookingConfirmedGuest({
  guestFirstName = "there",
  listingName = "your stay",
  hostName = "your host",
  checkIn = "—",
  checkOut = "—",
  nights = 1,
  totalAmount = "—",
  bookingReference = "WIELO-XXXX",
  bookingId = "",
  checkInTime = "—",
  address = "Address shared by host",
}: Props) {
  return (
    <Layout
      preview={`Your booking at ${listingName} is confirmed — ${checkIn} to ${checkOut}.`}
    >
      <Heading>You&apos;re booked, {guestFirstName} 🎉</Heading>
      <Text>
        Your stay at <strong>{listingName}</strong> with {hostName} is
        confirmed.
      </Text>

      <div
        style={{
          background: "#F2F8F4",
          border: "1px solid #C7DCC9",
          borderRadius: 12,
          padding: 20,
          margin: "16px 0",
        }}
      >
        <Text style={{ margin: "2px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Check in:</span>{" "}
          <strong>
            {checkIn} from {checkInTime}
          </strong>
        </Text>
        <Text style={{ margin: "2px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Check out:</span>{" "}
          <strong>{checkOut}</strong>
        </Text>
        <Text style={{ margin: "2px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Length of stay:</span>{" "}
          <strong>
            {nights} {nights === 1 ? "night" : "nights"}
          </strong>
        </Text>
        <Text style={{ margin: "2px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Total paid:</span>{" "}
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
        <strong>Where:</strong> {address}
      </Text>

      <Button href={`${APP_URL}/booking/${bookingId}/success`}>
        View booking
      </Button>

      <Text style={{ marginTop: 20, fontSize: 13, color: "#6B7280" }}>
        Need to change something? Reply to this email or message {hostName}{" "}
        through your Wielo inbox.
      </Text>
    </Layout>
  );
}
