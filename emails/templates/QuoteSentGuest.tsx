import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wieloplatform.com";

type Props = {
  guestFirstName?: string;
  listingName?: string;
  hostName?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  totalAmount?: string;
  quoteNumber?: string;
  validUntil?: string;
  // The public token quote page — accept with no login.
  quoteId?: string;
  acceptToken?: string;
};

export default function QuoteSentGuest({
  guestFirstName = "there",
  listingName = "your stay",
  hostName = "your host",
  checkIn = "—",
  checkOut = "—",
  nights = 1,
  totalAmount = "—",
  quoteNumber = "Q-XXXX",
  validUntil = "",
  quoteId = "",
  acceptToken = "",
}: Props) {
  const acceptUrl =
    quoteId && acceptToken
      ? `${APP_URL}/q/${quoteId}/${acceptToken}`
      : `${APP_URL}/portal/quotes`;
  return (
    <Layout
      preview={`Your quote for ${listingName} — ${checkIn} to ${checkOut}.`}
    >
      <Heading>Your quote is ready, {guestFirstName} 🎉</Heading>
      <Text>
        {hostName} has prepared a quote for your stay at{" "}
        <strong>{listingName}</strong>. Review it and accept whenever
        you&apos;re ready — no login needed.
      </Text>

      <div
        style={{
          background: "#F2F8F4",
          border: "1px solid #C7DCC9",
          borderRadius: 12,
          padding: 20,
          margin: "16px 0",
        }}
      >
        <Text style={{ margin: "2px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Quote:</span>{" "}
          <strong style={{ fontFamily: "monospace" }}>{quoteNumber}</strong>
        </Text>
        <Text style={{ margin: "2px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Check in:</span>{" "}
          <strong>{checkIn}</strong>
        </Text>
        <Text style={{ margin: "2px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Check out:</span>{" "}
          <strong>{checkOut}</strong>
        </Text>
        <Text style={{ margin: "2px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Length of stay:</span>{" "}
          <strong>
            {nights} {nights === 1 ? "night" : "nights"}
          </strong>
        </Text>
        <Text style={{ margin: "2px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Total:</span>{" "}
          <strong>{totalAmount}</strong>
        </Text>
      </div>

      <Button href={acceptUrl}>View &amp; accept quote</Button>

      {validUntil ? (
        <Text style={{ marginTop: 16, fontSize: 13, color: "#6B7280" }}>
          This quote is valid until <strong>{validUntil}</strong>. Your dates
          are held for you until then.
        </Text>
      ) : null}

      <Text style={{ marginTop: 12, fontSize: 13, color: "#6B7280" }}>
        Questions? Reply to this email or message {hostName} through your Wielo
        inbox.
      </Text>
    </Layout>
  );
}
