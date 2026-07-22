import { Hr, Section, Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  firstName?: string;
  listingName?: string;
  /** Absolute public URL of the live listing. */
  listingUrl?: string;
  /** e.g. "wielo.co.za/property/karoo-sky". */
  displayUrl?: string;
  /** Formatted "from" nightly rate, e.g. "R 950". */
  fromPrice?: string;
  /** Human location line, e.g. "Prince Albert, Western Cape". */
  location?: string;
  /** Number of bookable rooms. */
  roomCount?: number;
};

const rowLabel: React.CSSProperties = {
  margin: 0,
  color: "#6B7280",
  fontSize: 13,
  width: 110,
  verticalAlign: "top",
};
const rowValue: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 14,
  fontWeight: 600,
};

export default function ListingPublishedHost({
  firstName = "there",
  listingName = "your listing",
  listingUrl = `${APP_URL}/dashboard`,
  displayUrl,
  fromPrice,
  location,
  roomCount,
}: Props) {
  return (
    <Layout
      preview={`${listingName} is live on Wielo — share your booking link.`}
    >
      <Heading>You&rsquo;re live, {firstName} 🎉</Heading>
      <Text>
        <strong>{listingName}</strong> is now published and bookable on Wielo.
        Guests can find it in the directory and book you directly — no
        commission, paid straight to you.
      </Text>

      <Section
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: "18px 20px",
          margin: "8px 0 20px",
          backgroundColor: "#F9FAFB",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={rowLabel}>Listing</td>
              <td style={rowValue}>{listingName}</td>
            </tr>
            {location ? (
              <tr>
                <td style={{ ...rowLabel, paddingTop: 8 }}>Where</td>
                <td style={{ ...rowValue, paddingTop: 8 }}>{location}</td>
              </tr>
            ) : null}
            {typeof roomCount === "number" && roomCount > 0 ? (
              <tr>
                <td style={{ ...rowLabel, paddingTop: 8 }}>Rooms</td>
                <td style={{ ...rowValue, paddingTop: 8 }}>
                  {roomCount} bookable {roomCount === 1 ? "room" : "rooms"}
                </td>
              </tr>
            ) : null}
            {fromPrice ? (
              <tr>
                <td style={{ ...rowLabel, paddingTop: 8 }}>From</td>
                <td style={{ ...rowValue, paddingTop: 8 }}>
                  {fromPrice} / night
                </td>
              </tr>
            ) : null}
            {displayUrl ? (
              <tr>
                <td style={{ ...rowLabel, paddingTop: 8 }}>Link</td>
                <td
                  style={{
                    ...rowValue,
                    paddingTop: 8,
                    fontFamily: "monospace",
                    color: "#059669",
                    wordBreak: "break-all",
                  }}
                >
                  {displayUrl}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Section>

      <Button href={listingUrl}>View my live listing</Button>

      <Hr style={{ borderColor: "#E5E7EB", margin: "24px 0" }} />

      <Text style={{ color: "#374151", fontSize: 14, margin: 0 }}>
        Share your link on Instagram, WhatsApp, or your email signature to start
        taking direct bookings. You can edit your listing, pricing and policies
        any time from your dashboard.
      </Text>
      <Text style={{ marginTop: 16, color: "#6B7280", fontSize: 14 }}>
        Need a hand? Reply to this email and we&rsquo;ll get back to you within
        one working day.
      </Text>
    </Layout>
  );
}
