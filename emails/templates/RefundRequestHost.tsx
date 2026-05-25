import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://viloplatform.com";

type Props = {
  hostFirstName?: string;
  guestName?: string;
  listingName?: string;
  bookingReference?: string;
  checkIn?: string;
  totalPaid?: string;
  requestedAmount?: string;
  policyEntitlement?: string;
  reason?: string;
  refundId?: string;
  responseDeadline?: string;
};

export default function RefundRequestHost({
  hostFirstName = "there",
  guestName = "the guest",
  listingName = "your listing",
  bookingReference = "—",
  checkIn = "—",
  totalPaid = "—",
  requestedAmount = "—",
  policyEntitlement = "—",
  reason = "",
  refundId = "",
  responseDeadline = "72 hours",
}: Props) {
  return (
    <Layout
      preview={`${guestName} requested a refund on ${bookingReference} — review within ${responseDeadline}.`}
    >
      <Heading>You have a refund request</Heading>
      <Text>Hi {hostFirstName},</Text>
      <Text>
        <strong>{guestName}</strong> has requested a refund on booking{" "}
        <strong>{bookingReference}</strong> ({listingName}, {checkIn}).
      </Text>

      <Detail label="Paid" value={totalPaid} />
      <Detail label="Requested" value={requestedAmount} />
      <Detail label="Policy entitlement" value={policyEntitlement} />

      {reason ? (
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
          {reason}
        </Text>
      ) : null}

      <Text>
        Please review and respond by <strong>{responseDeadline}</strong>.
        Unresponded requests are escalated to the Vilo team automatically.
      </Text>

      <Button href={`${APP_URL}/dashboard/refunds/${refundId}`}>
        Review refund request
      </Button>
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
