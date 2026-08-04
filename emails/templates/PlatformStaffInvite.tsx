import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";

type Props = {
  brand_name?: string;
  role?: string;
  inviteUrl?: string;
  expiresLabel?: string;
};

// Platform ADMIN-TEAM invite (distinct from StaffInvite, which is a host
// inviting someone to co-manage their property). Sent when a super admin invites
// a teammate to the Wielo admin panel with a role. Rendered by the email-queue
// drain — brand_name is injected there; role + inviteUrl come from the enqueuer.
export default function PlatformStaffInvite({
  brand_name = "Wielo",
  role = "team member",
  inviteUrl = "",
  expiresLabel = "72 hours",
}: Props) {
  return (
    <Layout preview={`You've been invited to the ${brand_name} admin team.`}>
      <Heading>You've been invited to the {brand_name} team</Heading>
      <Text>Hi there,</Text>
      <Text>
        You've been invited to join the <strong>{brand_name}</strong> admin team
        as <strong>{role}</strong>. Sign in (or create an account) with this
        email address, then accept your invite to get started.
      </Text>

      <Button href={inviteUrl}>Accept your invite</Button>

      <Text style={{ marginTop: 20, fontSize: 13, color: "#6B7280" }}>
        This invite expires in {expiresLabel}. If you weren&apos;t expecting it,
        you can safely ignore this email.
      </Text>
    </Layout>
  );
}
