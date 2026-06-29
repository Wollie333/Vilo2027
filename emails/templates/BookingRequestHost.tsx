import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wieloplatform.com";

type Props = {
  hostFirstName?: string;
  guestName?: string;
  listingName?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  guests?: number;
  totalAmount?: string;
  bookingId?: string;
};

export default function BookingRequestHost({
  hostFirstName = "there",
  guestName = "A guest",
  listingName = "your listing",
  checkIn = "—",
  checkOut = "—",
  nights = 1,
  guests = 1,
  totalAmount = "—",
  bookingId = "",
}: Props) {
  return (
    <Layout
      preview={`${guestName} wants to book ${listingName} — please respond within 24 hours.`}
    >
      <Heading>You have a new booking request</Heading>
      <Text>Hi {hostFirstName},</Text>
      <Text>
        <strong>{guestName}</strong> wants to book{" "}
        <strong>{listingName}</strong>. Please confirm or decline within 24
        hours so the guest can plan.
      </Text>

      <Detail label="Check in" value={checkIn} />
      <Detail label="Check out" value={checkOut} />
      <Detail
        label="Length of stay"
        value={`${nights} ${nights === 1 ? "night" : "nights"}`}
      />
      <Detail
        label="Guests"
        value={`${guests} ${guests === 1 ? "guest" : "guests"}`}
      />
      <Detail label="Total" value={totalAmount} />

      <Button href={`${APP_URL}/dashboard/bookings/${bookingId}`}>
        Review request
      </Button>

      <Text style={{ marginTop: 20, fontSize: 13, color: "#6B7280" }}>
        Auto-cancel kicks in after 24 hours with no response.
      </Text>
    </Layout>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Text style={{ margin: "6px 0", fontSize: 14 }}>
      <span style={{ color: "#6B7280" }}>{label}:</span>{" "}
      <strong>{value}</strong>
    </Text>
  );
}
