import { Text } from "@react-email/components";
import * as React from "react";

import Heading from "../components/Heading";
import Layout from "../components/Layout";

type Props = {
  guestFirstName?: string;
  refundAmount?: string;
  bookingReference?: string;
  hostNote?: string | null;
  processingNote?: string;
};

export default function EftRefundSentGuest({
  guestFirstName = "there",
  refundAmount = "—",
  bookingReference = "—",
  hostNote = null,
  processingNote = "EFT transfers typically arrive within 1–2 business days.",
}: Props) {
  return (
    <Layout
      preview={`Your EFT refund of ${refundAmount} for ${bookingReference} has been sent.`}
    >
      <Heading>Your refund has been sent</Heading>
      <Text>Hi {guestFirstName},</Text>
      <Text>
        Your refund of <strong>{refundAmount}</strong> for booking{" "}
        <strong>{bookingReference}</strong> has been sent via bank transfer.
      </Text>
      <Text>{processingNote}</Text>

      {hostNote ? (
        <Text
          style={{
            margin: "16px 0",
            padding: "12px 16px",
            borderLeft: "3px solid #1B4D3E",
            backgroundColor: "#FAFDF9",
            fontSize: 14,
            color: "#0D2B21",
          }}
        >
          {hostNote}
        </Text>
      ) : null}
    </Layout>
  );
}
