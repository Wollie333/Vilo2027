import { Hr, Section, Text } from "@react-email/components";
import * as React from "react";

import Heading from "../components/Heading";
import Layout from "../components/Layout";

type Props = {
  guestFirstName?: string;
  listingName?: string;
  bookingReference?: string;
  hostName?: string;
  amountPaid?: string | null;
  amountForfeited?: string | null;
  amountRefunded?: string | null;
  policyApplied?: string | null;
  statementNumber?: string | null;
};

const row: React.CSSProperties = { margin: 0, fontSize: 14, color: "#111827" };
const label: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#6B7280",
  width: 150,
  verticalAlign: "top",
};

export default function BookingForfeitedGuest({
  guestFirstName = "there",
  listingName = "your stay",
  bookingReference,
  hostName = "your host",
  amountPaid,
  amountForfeited,
  amountRefunded,
  policyApplied,
  statementNumber,
}: Props) {
  return (
    <Layout preview={`Your booking at ${listingName} was cancelled.`}>
      <Heading>Your booking was cancelled</Heading>
      <Text>Hi {guestFirstName},</Text>
      <Text>
        Your booking at <strong>{listingName}</strong>
        {bookingReference ? ` (${bookingReference})` : ""} has been cancelled by{" "}
        {hostName} as a no-show / abandoned booking.
      </Text>
      <Text>
        Under the cancellation policy that applied to this booking
        {policyApplied ? ` (${policyApplied})` : ""}, the amount you paid is
        non-refundable and has been retained by the host.
      </Text>

      <Section
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: "16px 20px",
          margin: "8px 0 20px",
          backgroundColor: "#F9FAFB",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {amountPaid ? (
              <tr>
                <td style={label}>Amount paid</td>
                <td style={row}>{amountPaid}</td>
              </tr>
            ) : null}
            {amountForfeited ? (
              <tr>
                <td style={{ ...label, paddingTop: 8 }}>Forfeited</td>
                <td style={{ ...row, paddingTop: 8, fontWeight: 700 }}>
                  {amountForfeited}
                </td>
              </tr>
            ) : null}
            {amountRefunded ? (
              <tr>
                <td style={{ ...label, paddingTop: 8 }}>Refunded to you</td>
                <td style={{ ...row, paddingTop: 8 }}>{amountRefunded}</td>
              </tr>
            ) : null}
            {statementNumber ? (
              <tr>
                <td style={{ ...label, paddingTop: 8 }}>Statement</td>
                <td style={{ ...row, paddingTop: 8, fontFamily: "monospace" }}>
                  {statementNumber}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Section>

      <Hr style={{ borderColor: "#E5E7EB", margin: "24px 0" }} />
      <Text style={{ color: "#6B7280", fontSize: 14, margin: 0 }}>
        If you believe this was made in error, reply to this email to reach the
        host directly.
      </Text>
    </Layout>
  );
}
