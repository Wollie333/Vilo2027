import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  guestFirstName?: string;
  hostName?: string;
  listingName?: string;
  rating?: number;
  reviewExcerpt?: string | null;
  responseText?: string | null;
  bookingId?: string;
};

export default function ReviewResponseGuest({
  guestFirstName = "there",
  hostName = "Your host",
  listingName = "your stay",
  rating = 5,
  reviewExcerpt = null,
  responseText = null,
  bookingId = "",
}: Props) {
  const stars =
    "★".repeat(Math.min(5, Math.max(0, rating))) +
    "☆".repeat(5 - Math.min(5, Math.max(0, rating)));

  return (
    <Layout preview={`${hostName} replied to your review of ${listingName}.`}>
      <Heading>{hostName} replied to your review</Heading>
      <Text>Hi {guestFirstName},</Text>
      <Text>
        <strong>{hostName}</strong> has responded to the review you left for{" "}
        <strong>{listingName}</strong>.
      </Text>

      {reviewExcerpt ? (
        <div
          style={{
            background: "#FAFDF9",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: 16,
            margin: "16px 0",
          }}
        >
          <Text style={{ margin: 0, fontSize: 16, color: "#F59E0B" }}>
            {stars}
          </Text>
          <Text style={{ margin: "8px 0 0", fontSize: 14, color: "#6B7280" }}>
            Your review: “{reviewExcerpt}”
          </Text>
        </div>
      ) : null}

      <div
        style={{
          background: "#F2F8F4",
          border: "1px solid #C7DCC9",
          borderRadius: 12,
          padding: 16,
          margin: "16px 0",
        }}
      >
        <Text style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
          {hostName} replied:
        </Text>
        <Text style={{ margin: "8px 0 0", fontSize: 14, color: "#374151" }}>
          “{responseText ?? "Thanks for staying with us!"}”
        </Text>
      </div>

      <Button
        href={
          bookingId
            ? `${APP_URL}/portal/trips/${bookingId}`
            : `${APP_URL}/portal/trips`
        }
      >
        View your trip
      </Button>
    </Layout>
  );
}
