import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wieloplatform.com";

type Props = {
  amount?: string;
  detail?: string;
};

export default function AffiliatePayoutPaid({
  amount = "your payout",
  detail,
}: Props) {
  return (
    <Layout preview={`Your affiliate payout of ${amount} is on its way`}>
      <Heading>Your payout is on its way 💸</Heading>
      <Text>
        We&apos;ve sent your affiliate payout of <strong>{amount}</strong>
        {detail ? ` via ${detail}` : ""}.
      </Text>
      <Text>
        Depending on the method it can take a few days to reflect. Your
        remittance advice is available in your payouts.
      </Text>

      <Button href={`${APP_URL}/portal/affiliates/payouts`}>
        View payouts
      </Button>
    </Layout>
  );
}
