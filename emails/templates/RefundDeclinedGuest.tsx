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
  declineReasonLabel?: string;
  policySummary?: string;
  bookingId?: string;
  supportEmail?: string;
};

export default function RefundDeclinedGuest({
  guestFirstName = "there",
  listingName = "your stay",
  bookingReference = "—",
  declineReasonLabel = "Outside the cancellation policy window",
  policySummary = "",
  bookingId = "",
  supportEmail = "support@wieloplatform.com",
}: Props) {
  return (
    <Layout
      preview={`Your refund request for ${bookingReference} was declined — here's why.`}
    >
      <Heading>Update on your refund request</Heading>
      <Text>Hi {guestFirstName},</Text>
      <Text>
        Your refund request for <strong>{listingName}</strong> (
        {bookingReference}) has been reviewed and declined.
      </Text>

      <Text style={{ margin: "8px 0", fontSize: 14 }}>
        <span style={{ color: "#6B7280" }}>Reason:</span>{" "}
        <strong>{declineReasonLabel}</strong>
      </Text>

      {policySummary ? (
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
          {policySummary}
        </Text>
      ) : null}

      <Text>
        If you believe this decision is incorrect, you can dispute it within 14
        days.
      </Text>

      <Button href={`${APP_URL}/my-trips/${bookingId}`}>
        Dispute this decision
      </Button>

      <Text style={{ marginTop: 20, fontSize: 13, color: "#6B7280" }}>
        Or contact us at{" "}
        <a
          href={`mailto:${supportEmail}`}
          style={{ color: "#1B4D3E", textDecoration: "underline" }}
        >
          {supportEmail}
        </a>
        .
      </Text>
    </Layout>
  );
}
