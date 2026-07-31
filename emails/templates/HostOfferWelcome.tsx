import { Hr, Section, Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  firstName?: string;
  /** Default paid plan name, e.g. "Starter". */
  planName?: string;
  /** Formatted monthly price, e.g. "R 999". */
  monthlyPrice?: string | null;
  /** Formatted annual price, e.g. "R 9 999" (null = monthly only). */
  annualPrice?: string | null;
  /** Formatted saving of annual vs 12× monthly, e.g. "R 1 989" (optional). */
  annualSaving?: string | null;
  /** Up to four headline capabilities the plan unlocks. */
  capabilities?: string[];
  subscribeUrl?: string;
  dashboardUrl?: string;
};

const tick: React.CSSProperties = {
  margin: "0 0 6px",
  color: "#111827",
  fontSize: 14,
};

export default function HostOfferWelcome({
  firstName = "there",
  planName = "a Wielo plan",
  monthlyPrice,
  annualPrice,
  annualSaving,
  capabilities = [],
  subscribeUrl = `${APP_URL}/dashboard/settings/subscription`,
  dashboardUrl = `${APP_URL}/dashboard`,
}: Props) {
  return (
    <Layout preview="Welcome to Wielo — take direct bookings, keep 100% of every rand.">
      <Heading>Welcome to Wielo, {firstName} 👋</Heading>
      <Text>
        You&rsquo;re set up. Wielo is direct-booking management built for South
        African hosts — you take bookings straight from guests and keep{" "}
        <strong>100% of every rand</strong>. No marketplace, no per-booking
        commission, ever.
      </Text>

      <Text>
        Your account is on the free tier so you can look around. When
        you&rsquo;re ready to publish a listing and take live bookings,{" "}
        {planName} unlocks it:
      </Text>

      {capabilities.length > 0 && (
        <Section style={{ margin: "8px 0 16px" }}>
          {capabilities.map((c) => (
            <Text key={c} style={tick}>
              ✓ {c}
            </Text>
          ))}
        </Section>
      )}

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
              Paying yearly saves you {annualSaving}. It works out cheaper over
              the year, and the price is locked for as long as you stay.
            </Text>
          )}
        </Section>
      )}

      <Button href={subscribeUrl}>Choose your plan</Button>

      <Hr style={{ borderColor: "#E5E7EB", margin: "24px 0 16px" }} />
      <Text style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
        No pressure — you can explore your{" "}
        <a href={dashboardUrl} style={{ color: "#1B4D3E" }}>
          dashboard
        </a>{" "}
        first. We&rsquo;re here if you have questions.
      </Text>
    </Layout>
  );
}
