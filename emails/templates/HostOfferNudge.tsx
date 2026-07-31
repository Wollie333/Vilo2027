import { Hr, Section, Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  firstName?: string;
  planName?: string;
  monthlyPrice?: string | null;
  annualPrice?: string | null;
  annualSaving?: string | null;
  capabilities?: string[];
  subscribeUrl?: string;
  dashboardUrl?: string;
};

export default function HostOfferNudge({
  firstName = "there",
  planName = "a Wielo plan",
  monthlyPrice,
  annualPrice,
  annualSaving,
  subscribeUrl = `${APP_URL}/dashboard/settings/subscription`,
  dashboardUrl = `${APP_URL}/dashboard`,
}: Props) {
  return (
    <Layout preview="The maths on direct bookings — you keep every rand.">
      <Heading>Quick one, {firstName} 💸</Heading>
      <Text>
        Here&rsquo;s why hosts move to Wielo: on a marketplace, a{" "}
        <strong>R2,000</strong> booking loses roughly <strong>R300</strong> to
        commission. On Wielo that R300 stays with you — every booking, every
        month.
      </Text>

      <Text>
        {planName} gives you your own direct-booking page, a live calendar, and
        guest payments straight to your account. Publish a listing and the first
        booking usually pays for the plan several times over.
      </Text>

      {monthlyPrice && (
        <Section
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: "16px 20px",
            margin: "8px 0 20px",
          }}
        >
          <Text style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            {planName}
          </Text>
          <Text style={{ margin: "4px 0 0", fontSize: 14, color: "#111827" }}>
            {monthlyPrice}/month
            {annualPrice ? ` — or ${annualPrice}/year` : ""}
          </Text>
          {annualSaving && (
            <Text style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
              Yearly saves you {annualSaving} and locks your price for as long
              as you stay.
            </Text>
          )}
        </Section>
      )}

      <Button href={subscribeUrl}>Get set up</Button>

      <Hr style={{ borderColor: "#E5E7EB", margin: "24px 0 16px" }} />
      <Text style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
        Want to see it first? Everything&rsquo;s in your{" "}
        <a href={dashboardUrl} style={{ color: "#1B4D3E" }}>
          dashboard
        </a>
        .
      </Text>
    </Layout>
  );
}
