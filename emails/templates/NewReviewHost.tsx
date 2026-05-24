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
  rating?: number;
  body?: string | null;
};

export default function NewReviewHost({
  hostFirstName = "there",
  guestName = "A guest",
  listingName = "your listing",
  rating = 5,
  body = null,
}: Props) {
  const stars =
    "★".repeat(Math.min(5, Math.max(0, rating))) +
    "☆".repeat(5 - Math.min(5, Math.max(0, rating)));

  return (
    <Layout
      preview={`${guestName} left a ${rating}-star review for ${listingName}.`}
    >
      <Heading>You&apos;ve got a new review</Heading>
      <Text>Hi {hostFirstName},</Text>
      <Text>
        <strong>{guestName}</strong> left a review for{" "}
        <strong>{listingName}</strong>.
      </Text>

      <div
        style={{
          background: "#FAFDF9",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: 20,
          margin: "16px 0",
        }}
      >
        <Text style={{ margin: 0, fontSize: 18, color: "#F59E0B" }}>
          {stars}
        </Text>
        {body ? (
          <Text style={{ margin: "12px 0 0", fontSize: 14, color: "#374151" }}>
            “{body}”
          </Text>
        ) : null}
      </div>

      <Text>
        Hosts who reply within 24 hours see 2.4× more repeat bookings.
      </Text>

      <Button href={`${APP_URL}/dashboard/reviews?tab=needs-reply`}>
        Reply to review
      </Button>
    </Layout>
  );
}
