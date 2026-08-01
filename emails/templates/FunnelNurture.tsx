import { Link, Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

// Shared template for every automated funnel-nurture email (host + affiliate
// drip). Content is fully data-driven from the props the nurture worker / admin
// preview pass, so one branded template covers the whole sequence. Copy lives in
// apps/web/lib/funnels/nurtureCopy.ts.

type Props = {
  firstName?: string;
  heading?: string;
  paragraphs?: string[];
  ctaLabel?: string;
  ctaHref?: string;
  /** Public unsubscribe link (POPIA) — every marketing email carries one. */
  unsubscribeHref?: string;
  /** Inbox preview line. */
  subject?: string;
};

export default function FunnelNurture({
  firstName = "there",
  heading = "A quick note from Wielo",
  paragraphs = [],
  ctaLabel,
  ctaHref,
  unsubscribeHref = `${APP_URL}/unsubscribe`,
  subject,
}: Props) {
  return (
    <Layout preview={subject ?? heading}>
      <Heading>{heading}</Heading>
      <Text>Hi {firstName},</Text>
      {paragraphs.map((p, i) => (
        <Text key={i}>{p}</Text>
      ))}
      {ctaLabel && ctaHref ? <Button href={ctaHref}>{ctaLabel}</Button> : null}
      <Text style={{ margin: "20px 0 0", fontSize: 12, color: "#8AADA5" }}>
        You&rsquo;re getting this because you asked Wielo to keep you posted.{" "}
        <Link
          href={unsubscribeHref}
          style={{ color: "#8AADA5", textDecoration: "underline" }}
        >
          Unsubscribe
        </Link>
        .
      </Text>
    </Layout>
  );
}
