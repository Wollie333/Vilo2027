import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://viloplatform.com";

type Props = {
  guestName?: string;
  hostName?: string;
  listingName?: string;
  bookingReference?: string;
  requestedAmount?: string;
  escalationNote?: string;
  refundId?: string;
};

export default function RefundEscalatedAdmin({
  guestName = "Guest",
  hostName = "Host",
  listingName = "—",
  bookingReference = "—",
  requestedAmount = "—",
  escalationNote = "",
  refundId = "",
}: Props) {
  return (
    <Layout
      preview={`[Admin] ${guestName} escalated refund ${bookingReference}.`}
    >
      <Heading>Refund dispute escalated</Heading>
      <Text style={{ marginTop: 0, fontSize: 13, color: "#6B7280" }}>
        Internal admin alert — no guest or host is on this thread.
      </Text>

      <Detail label="Guest" value={guestName} />
      <Detail label="Host" value={hostName} />
      <Detail label="Listing" value={listingName} />
      <Detail label="Booking" value={bookingReference} />
      <Detail label="Requested" value={requestedAmount} />

      {escalationNote ? (
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
          {escalationNote}
        </Text>
      ) : null}

      <Button href={`${APP_URL}/admin/refunds/${refundId}`}>
        Review dispute
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
