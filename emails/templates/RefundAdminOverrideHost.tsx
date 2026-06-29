import { Text } from "@react-email/components";
import * as React from "react";

import Heading from "../components/Heading";
import Layout from "../components/Layout";

type Props = {
  hostFirstName?: string;
  guestName?: string;
  listingName?: string;
  bookingReference?: string;
  refundAmount?: string;
  adminNote?: string;
  supportEmail?: string;
};

export default function RefundAdminOverrideHost({
  hostFirstName = "there",
  guestName = "the guest",
  listingName = "—",
  bookingReference = "—",
  refundAmount = "—",
  adminNote = "",
  supportEmail = "support@wieloplatform.com",
}: Props) {
  return (
    <Layout
      preview={`Admin override — refund of ${refundAmount} issued on ${bookingReference}.`}
    >
      <Heading>Refund override on {bookingReference}</Heading>
      <Text>Hi {hostFirstName},</Text>
      <Text>
        Following a review of the refund dispute for booking{" "}
        <strong>{bookingReference}</strong> ({listingName}), the Wielo team has
        issued a refund of <strong>{refundAmount}</strong> to {guestName}.
      </Text>

      {adminNote ? (
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
          {adminNote}
        </Text>
      ) : null}

      <Text style={{ marginTop: 16 }}>
        If you have questions, contact us at{" "}
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
