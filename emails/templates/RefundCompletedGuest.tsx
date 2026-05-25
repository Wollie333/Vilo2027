import { Text } from "@react-email/components";
import * as React from "react";

import Heading from "../components/Heading";
import Layout from "../components/Layout";

type Props = {
  guestFirstName?: string;
  refundAmount?: string;
  bookingReference?: string;
  paymentMethod?: string;
  processingNote?: string;
};

export default function RefundCompletedGuest({
  guestFirstName = "there",
  refundAmount = "—",
  bookingReference = "—",
  paymentMethod = "your original payment method",
  processingNote = "Allow 3–5 business days for the funds to appear.",
}: Props) {
  return (
    <Layout
      preview={`Your refund of ${refundAmount} for ${bookingReference} is on its way.`}
    >
      <Heading>Your refund is on its way</Heading>
      <Text>Hi {guestFirstName},</Text>
      <Text>
        Your refund of <strong>{refundAmount}</strong> for booking{" "}
        <strong>{bookingReference}</strong> has been processed back to{" "}
        {paymentMethod}.
      </Text>
      <Text>{processingNote}</Text>
    </Layout>
  );
}
