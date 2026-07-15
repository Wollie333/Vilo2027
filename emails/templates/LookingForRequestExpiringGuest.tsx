import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import DetailTable from "../components/DetailTable";
import Shell from "../components/Shell";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wielo.co.za";

type Props = {
  guestFirstName?: string;
  postTitle?: string;
  expiresInDays?: number;
  quoteCount?: number;
  postId?: string;
};

// Guest email: their Looking-For request is about to expire — extend it or
// review the quotes received.
export default function LookingForRequestExpiringGuest({
  guestFirstName = "there",
  postTitle = "your request",
  expiresInDays = 3,
  quoteCount = 0,
  postId = "",
}: Props) {
  const url = postId
    ? `${APP_URL}/portal/looking-for/${postId}`
    : `${APP_URL}/portal/looking-for`;
  const when =
    expiresInDays <= 0
      ? "today"
      : expiresInDays === 1
        ? "tomorrow"
        : `in ${expiresInDays} days`;
  return (
    <Shell
      preview={`"${postTitle}" expires ${when}. Extend it or review your quotes.`}
      eyebrow="Looking For"
      title={`Your request expires ${when}`}
      subtitle={`"${postTitle}" will stop accepting new quotes ${when}.`}
      pill={{ label: "EXPIRING", emoji: "⏳" }}
    >
      <Text style={{ margin: "0 0 20px", fontSize: 14, color: "#4A7C6A" }}>
        Hi {guestFirstName},{" "}
        {quoteCount > 0
          ? `you have ${quoteCount} quote${quoteCount === 1 ? "" : "s"} to review. `
          : ""}
        Extend the request to keep receiving quotes, or accept one you like.
      </Text>

      <DetailTable
        rows={[
          { label: "Request", value: postTitle },
          {
            label: "Expires",
            value: when.charAt(0).toUpperCase() + when.slice(1),
          },
          {
            label: "Quotes received",
            value: quoteCount > 0 ? String(quoteCount) : "None yet",
          },
        ]}
      />

      <Button href={url}>Review &amp; extend →</Button>
    </Shell>
  );
}
