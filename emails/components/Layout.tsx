import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

const BRAND_PRIMARY = "#1B4D3E";
const BRAND_LIGHT = "#FAFDF9";
const BRAND_DARK = "#0D2B21";
const MUTED = "#6B7280";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://viloplatform.com";

type Props = {
  /** Renders in the email client preview pane. Keep under 90 chars. */
  preview: string;
  children: React.ReactNode;
};

export default function Layout({ preview, children }: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Img
              src={`${APP_URL}/email/vilo-logo.png`}
              width="96"
              height="32"
              alt="Vilo"
              style={styles.logo}
            />
          </Section>

          <Section style={styles.content}>{children}</Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Vilo — direct-booking management for accommodation hosts and
              experience operators.
            </Text>
            <Text style={styles.footerText}>
              <Link href={APP_URL} style={styles.footerLink}>
                viloplatform.com
              </Link>
              {" · "}
              <Link
                href={`${APP_URL}/account/notifications`}
                style={styles.footerLink}
              >
                Email preferences
              </Link>
            </Text>
            <Text style={styles.legal}>
              You received this email because you have a Vilo account.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: BRAND_LIGHT,
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    margin: 0,
    padding: 0,
  },
  container: {
    maxWidth: "560px",
    margin: "0 auto",
    padding: "32px 16px",
  },
  header: {
    padding: "0 0 24px",
  },
  logo: {
    margin: 0,
  },
  content: {
    backgroundColor: "#FFFFFF",
    borderRadius: "16px",
    padding: "32px",
    color: BRAND_DARK,
    fontSize: "16px",
    lineHeight: "1.6",
  },
  hr: {
    border: "none",
    borderTop: `1px solid #E5E7EB`,
    margin: "32px 0 16px",
  },
  footer: {
    padding: "0 8px",
    textAlign: "center" as const,
  },
  footerText: {
    color: MUTED,
    fontSize: "13px",
    lineHeight: "1.5",
    margin: "4px 0",
  },
  footerLink: {
    color: BRAND_PRIMARY,
    textDecoration: "underline",
  },
  legal: {
    color: MUTED,
    fontSize: "11px",
    margin: "16px 0 0",
  },
};
