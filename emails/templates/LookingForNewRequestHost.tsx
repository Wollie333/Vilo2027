import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import DetailTable from "../components/DetailTable";
import Shell from "../components/Shell";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wielo.co.za";

type Props = {
  hostFirstName?: string;
  guestFirstName?: string;
  postTitle?: string;
  locationText?: string;
  checkIn?: string;
  guests?: string;
  budget?: string;
  postId?: string;
};

// Host email: a new guest request matches the host's area/saved search — quote
// while it's fresh.
export default function LookingForNewRequestHost({
  hostFirstName = "there",
  guestFirstName = "A guest",
  postTitle = "accommodation",
  locationText = "",
  checkIn = "",
  guests = "",
  budget = "",
  postId = "",
}: Props) {
  const url = postId
    ? `${APP_URL}/dashboard/looking-for/respond/${postId}`
    : `${APP_URL}/dashboard/looking-for`;
  return (
    <Shell
      preview={`${guestFirstName} is looking for ${postTitle}${locationText ? ` in ${locationText}` : ""}.`}
      eyebrow="Looking For"
      title="A new request matches you"
      subtitle={`${guestFirstName} is looking for ${postTitle}${locationText ? ` in ${locationText}` : ""}. Be one of the first to quote.`}
      pill={{ label: "NEW REQUEST", emoji: "🔎" }}
    >
      <Text style={{ margin: `0 0 20px`, fontSize: 14, color: "#4A7C6A" }}>
        Hi {hostFirstName}, a guest just posted a request that fits your area.
        Quotes sent early get seen first.
      </Text>

      <DetailTable
        label="What the guest wants"
        rows={[
          { label: "Looking for", value: postTitle },
          { label: "Area", value: locationText || null },
          { label: "Dates", value: checkIn || null },
          { label: "Guests", value: guests || null },
          { label: "Budget", value: budget || null },
        ]}
      />

      <Button href={url}>Send a quote →</Button>
    </Shell>
  );
}
