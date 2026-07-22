import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  guestFirstName?: string;
  listingName?: string;
  bookingReference?: string;
  totalAmount?: string;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  branchCode?: string;
  swiftCode?: string;
  paymentReference?: string;
  bookingId?: string;
  deadline?: string;
};

export default function EftInstructionsGuest({
  guestFirstName = "there",
  listingName = "your stay",
  bookingReference = "WIELO-XXXX",
  totalAmount = "—",
  bankName = "—",
  accountHolder = "—",
  accountNumber = "—",
  branchCode = "—",
  swiftCode = "—",
  paymentReference = "WIELO-XXXX",
  bookingId = "",
  deadline = "48 hours from now",
}: Props) {
  return (
    <Layout
      preview={`Pay ${totalAmount} by EFT to confirm your stay at ${listingName}.`}
    >
      <Heading>Confirm your booking by EFT</Heading>
      <Text>Hi {guestFirstName},</Text>
      <Text>
        You&apos;re almost done. Pay <strong>{totalAmount}</strong> to the host
        and upload your proof of payment within <strong>{deadline}</strong>.
      </Text>

      <div
        style={{
          background: "#F2F8F4",
          border: "1px solid #C7DCC9",
          borderRadius: 12,
          padding: 20,
          margin: "16px 0",
          fontFamily: "monospace",
          fontSize: 13,
        }}
      >
        <Detail label="Bank" value={bankName} />
        <Detail label="Account holder" value={accountHolder} />
        <Detail label="Account number" value={accountNumber} />
        <Detail label="Branch code" value={branchCode} />
        <Detail label="SWIFT" value={swiftCode} />
        <Detail label="Reference (important)" value={paymentReference} />
      </div>

      <Text style={{ fontSize: 14, color: "#6B7280" }}>
        Use the reference exactly — it tells your host which booking the payment
        is for.
      </Text>

      <Button href={`${APP_URL}/booking/${bookingId}/success`}>
        Upload proof of payment
      </Button>

      <Text style={{ marginTop: 20, fontSize: 13, color: "#6B7280" }}>
        Booking reference: <strong>{bookingReference}</strong>. If you
        don&apos;t pay within {deadline}, the booking is cancelled
        automatically.
      </Text>
    </Layout>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Text style={{ margin: "4px 0" }}>
      <span style={{ color: "#6B7280" }}>{label}:</span>{" "}
      <strong>{value}</strong>
    </Text>
  );
}
