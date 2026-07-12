import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wieloplatform.com";

// One access block = either the whole-listing access, or one booked room's
// access (with per-room values already merged over the listing defaults by the
// resolver). Only fields with a value are rendered.
export type StayAccessBlock = {
  label?: string; // room name when the booking has rooms; omitted for whole-listing
  checkInMethod?: string;
  checkInInstructions?: string;
  gateCode?: string;
  doorCode?: string;
  wifiNetwork?: string;
  wifiPassword?: string;
};

type Props = {
  guestFirstName?: string;
  listingName?: string;
  hostName?: string;
  checkIn?: string;
  checkInTime?: string;
  checkOut?: string;
  nights?: number;
  bookingReference?: string;
  bookingId?: string;
  address?: string;
  blocks?: StayAccessBlock[];
};

const LABELS: [keyof StayAccessBlock, string][] = [
  ["checkInMethod", "Check-in"],
  ["gateCode", "Gate code"],
  ["doorCode", "Door code"],
  ["wifiNetwork", "Wi-Fi network"],
  ["wifiPassword", "Wi-Fi password"],
  ["checkInInstructions", "Getting there"],
];

function hasAnyAccess(b: StayAccessBlock): boolean {
  return LABELS.some(([k]) => {
    const v = b[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}

function AccessRows({ block }: { block: StayAccessBlock }) {
  return (
    <>
      {LABELS.map(([key, label]) => {
        const value = block[key];
        if (typeof value !== "string" || value.trim().length === 0) return null;
        const mono = key === "gateCode" || key === "doorCode";
        return (
          <Text key={key} style={{ margin: "2px 0", fontSize: 14 }}>
            <span style={{ color: "#6B7280" }}>{label}:</span>{" "}
            <strong style={mono ? { fontFamily: "monospace" } : undefined}>
              {value}
            </strong>
          </Text>
        );
      })}
    </>
  );
}

export default function StayDetailsGuest({
  guestFirstName = "there",
  listingName = "your stay",
  hostName = "your host",
  checkIn = "—",
  checkInTime = "—",
  checkOut = "—",
  nights = 1,
  bookingReference = "WIELO-XXXX",
  bookingId = "",
  address = "Address shared by your host",
  blocks = [],
}: Props) {
  const accessBlocks = blocks.filter(hasAnyAccess);

  return (
    <Layout
      preview={`Your stay at ${listingName} starts ${checkIn} — here are your access details.`}
    >
      <Heading>Your stay is almost here, {guestFirstName} 👋</Heading>
      <Text>
        Check-in for <strong>{listingName}</strong> with {hostName} is coming
        up. Everything you need for arrival is below — and always on your trip
        page.
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
          <span style={{ color: "#6B7280" }}>Check in:</span>{" "}
          <strong>
            {checkIn} from {checkInTime}
          </strong>
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
          <span style={{ color: "#6B7280" }}>Where:</span>{" "}
          <strong>{address}</strong>
        </Text>
        <Text style={{ margin: "2px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Reference:</span>{" "}
          <strong style={{ fontFamily: "monospace" }}>
            {bookingReference}
          </strong>
        </Text>
      </div>

      {accessBlocks.length > 0 ? (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: 20,
            margin: "16px 0",
          }}
        >
          <Text style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700 }}>
            🔑 Access details
          </Text>
          {accessBlocks.map((block, i) => (
            <div key={i} style={i > 0 ? { marginTop: 14 } : undefined}>
              {block.label ? (
                <Text
                  style={{
                    margin: "0 0 2px",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#374151",
                  }}
                >
                  {block.label}
                </Text>
              ) : null}
              <AccessRows block={block} />
            </div>
          ))}
          <Text style={{ margin: "12px 0 0", fontSize: 12, color: "#6B7280" }}>
            Please keep these codes to yourself — they&apos;re just for your
            stay.
          </Text>
        </div>
      ) : (
        <Text style={{ fontSize: 14 }}>
          Your host will share arrival details with you directly. You can always
          message them from your trip page.
        </Text>
      )}

      <Button href={`${APP_URL}/portal/trips/${bookingId}`}>
        View your trip
      </Button>

      <Text style={{ marginTop: 20, fontSize: 13, color: "#6B7280" }}>
        Questions before you arrive? Reply to this email or message {hostName}{" "}
        through your Wielo inbox. Safe travels!
      </Text>
    </Layout>
  );
}
