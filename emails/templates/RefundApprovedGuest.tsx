import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wieloplatform.com";

type Props = {
  guestFirstName?: string;
  listingName?: string;
  bookingReference?: string;
  refundAmount?: string;
  paymentMethod?: string;
  processingNote?: string;
  bookingId?: string;
};

export default function RefundApprovedGuest({
  guestFirstName = "there",
  listingName = "your stay",
  bookingReference = "—",
  refundAmount = "—",
  paymentMethod = "your original payment method",
  processingNote = "Allow 3–5 business days to appear in your account.",
  bookingId = "",
}: Props) {
  return (
    <Layout
      preview={`Your refund of ${refundAmount} for ${bookingReference} has been approved.`}
    >
      <Heading>Your refund has been approved</Heading>
      <Text>Hi {guestFirstName},</Text>
      <Text>
        Good news — your refund of <strong>{refundAmount}</strong> for{" "}
        <strong>{listingName}</strong> ({bookingReference}) has been approved.
      </Text>
      <Text>
        It's being returned to {paymentMethod}. {processingNote}
      </Text>

      <Button href={`${APP_URL}/my-trips/${bookingId}`}>View booking</Button>
    </Layout>
  );
}
