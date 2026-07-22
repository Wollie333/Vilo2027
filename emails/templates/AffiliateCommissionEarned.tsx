import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  amount?: string;
  detail?: string;
};

export default function AffiliateCommissionEarned({
  amount = "commission",
  detail,
}: Props) {
  return (
    <Layout preview={`You earned ${amount} in affiliate commission on Wielo`}>
      <Heading>You earned {amount} 🎉</Heading>
      <Text>
        Nice work — you&apos;ve earned <strong>{amount}</strong> in affiliate
        commission{detail ? ` from ${detail}` : ""}.
      </Text>
      <Text>
        It becomes payable once the refund-hold window passes, then you can
        request a payout. Track everything in your affiliate dashboard.
      </Text>

      <Button href={`${APP_URL}/portal/affiliates`}>View your earnings</Button>
    </Layout>
  );
}
