import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import DetailTable from "../components/DetailTable";
import Shell from "../components/Shell";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wielo.co.za";

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
  // The guest's originally requested window (with flexibility), for Looking-For
  // quotes — shown next to the host's quoted dates. Omitted for direct quotes.
  requestedDates?: string;
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
  requestedDates = "",
  quoteId = "",
  acceptToken = "",
}: Props) {
  const acceptUrl =
    quoteId && acceptToken
      ? `${APP_URL}/q/${quoteId}/${acceptToken}`
      : `${APP_URL}/portal/quotes`;
  return (
    <Shell
      preview={`Your quote for ${listingName} — ${checkIn} to ${checkOut}.`}
      eyebrow="New quote"
      title={`Your quote is ready, ${guestFirstName}`}
      subtitle={`${hostName} has prepared a quote for your stay at ${listingName}.`}
      pill={{ label: "QUOTE", emoji: "💬" }}
    >
      <Text style={{ margin: "0 0 20px", fontSize: 14, color: "#4A7C6A" }}>
        Review it and accept whenever you&apos;re ready — no login needed.
      </Text>

      <DetailTable
        label="Quote details"
        rows={[
          { label: "Quote", value: quoteNumber },
          { label: "Listing", value: listingName },
          {
            label: "You requested",
            value: requestedDates ? requestedDates : null,
          },
          { label: "Quoted check in", value: checkIn },
          { label: "Quoted check out", value: checkOut },
          {
            label: "Length of stay",
            value: `${nights} ${nights === 1 ? "night" : "nights"}`,
          },
          { label: "Total", value: totalAmount },
        ]}
      />

      <Button href={acceptUrl}>View &amp; accept quote →</Button>

      {validUntil ? (
        <Text style={{ marginTop: 20, fontSize: 13, color: "#4A7C6A" }}>
          This quote is valid until <strong>{validUntil}</strong>. Your dates
          are held for you until then.
        </Text>
      ) : null}

      <Text style={{ marginTop: 12, fontSize: 13, color: "#4A7C6A" }}>
        Questions? Reply to this email or message {hostName} through your Wielo
        inbox.
      </Text>
    </Shell>
  );
}
