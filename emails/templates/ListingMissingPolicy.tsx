import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Shell from "../components/Shell";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wielo.co.za";

type Props = {
  firstName?: string;
  listingName?: string;
  /** Deep link to the property's Policies tab. */
  policiesUrl?: string;
  /** Which policy is absent. Only "cancellation" is queued today. */
  missingType?: string;
  brandName?: string;
};

// A published property has no cancellation policy attached. Queued daily (at
// most weekly per property) by the alert-missing-policies cron.
//
// This is not a nag about tidiness: with no policy attached, the booking's
// policy snapshot has nothing to freeze, so the refund engine falls back to 0%
// — the guest is told they get nothing back, and the host inherits the argument.
// That is what the copy leads with, because it is why the host should care.
export default function ListingMissingPolicy({
  firstName = "there",
  listingName = "your listing",
  policiesUrl = `${APP_URL}/dashboard`,
  missingType = "cancellation",
  brandName = "Wielo",
}: Props) {
  return (
    <Shell
      preview={`${listingName} is live without a ${missingType} policy`}
      eyebrow="Action needed"
      title={`Add a ${missingType} policy`}
      subtitle={`${listingName} is taking bookings without one.`}
      pill={{ label: "ACTION NEEDED", emoji: "⚠️" }}
    >
      <Text style={{ margin: "0 0 16px", fontSize: 14, color: "#052E1F" }}>
        Hi {firstName}, <strong>{listingName}</strong> is published and
        bookable, but it has no {missingType} policy attached.
      </Text>

      <Text style={{ margin: "0 0 16px", fontSize: 14, color: "#052E1F" }}>
        This matters more than it looks. Every booking freezes a copy of your
        policy at the moment it is made — that frozen copy is what decides any
        refund later. With no policy to freeze, {brandName} has to fall back to{" "}
        <strong>no refund at all</strong>. Your guest is told they get nothing
        back, and you are the one who has to have that conversation.
      </Text>

      <Text style={{ margin: "0 0 20px", fontSize: 14, color: "#052E1F" }}>
        It takes a minute: pick a policy, attach it, and every booking from then
        on carries it automatically. Bookings already taken keep whatever was
        frozen at the time — this fixes the next one, not the last one.
      </Text>

      <Button href={policiesUrl}>Add a {missingType} policy</Button>

      <Text style={{ margin: "20px 0 0", fontSize: 12, color: "#6B7280" }}>
        You are getting this because the listing is live. We will remind you at
        most once a week per listing, and not at all once a policy is attached.
      </Text>
    </Shell>
  );
}
