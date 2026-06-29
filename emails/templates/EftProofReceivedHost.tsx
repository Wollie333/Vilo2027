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
  totalAmount?: string;
  bookingReference?: string;
  bookingId?: string;
};

export default function EftProofReceivedHost({
  hostFirstName = "there",
  guestName = "Your guest",
  listingName = "your listing",
  totalAmount = "—",
  bookingReference = "WIELO-XXXX",
  bookingId = "",
}: Props) {
  return (
    <Layout
      preview={`${guestName} uploaded proof of payment for ${listingName}.`}
    >
      <Heading>Check the EFT proof</Heading>
      <Text>Hi {hostFirstName},</Text>
      <Text>
        <strong>{guestName}</strong> uploaded proof of payment for{" "}
        <strong>{listingName}</strong>. Once you confirm the EFT has landed in
        your account, mark the booking as paid — the calendar updates
        automatically.
      </Text>

      <Text style={{ margin: "8px 0", fontSize: 14 }}>
        <span style={{ color: "#6B7280" }}>Amount:</span>{" "}
        <strong>{totalAmount}</strong>
      </Text>
      <Text style={{ margin: "8px 0", fontSize: 14 }}>
        <span style={{ color: "#6B7280" }}>Reference:</span>{" "}
        <strong style={{ fontFamily: "monospace" }}>{bookingReference}</strong>
      </Text>

      <Button href={`${APP_URL}/dashboard/bookings/${bookingId}`}>
        Review proof
      </Button>
    </Layout>
  );
}
