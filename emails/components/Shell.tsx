import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

// Canonical Wielo email shell — a dark brand header (logo · eyebrow · title ·
// subtitle · optional status pill), a green accent line, a white body, and a
// branded footer. Table-based + inline styles so it renders identically across
// email clients. Templates pass their body as children and use the DetailTable /
// MessageBlock / Button helpers to fill it.

const BRAND_PRIMARY = "#10B981"; // emerald — accent + CTA
const BRAND_SECONDARY = "#064E3B"; // dark forest — header band
const BRAND_INK = "#052E1F";
const BRAND_MUTE = "#4A7C6A";
const PAGE_BG = "#EEF3F0";
const HEADER_EYEBROW = "#5DE0B0"; // legible emerald on the dark band
const HEADER_TITLE = "#ECFDF5";
const HEADER_SUB = "#9FE1CB";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wielo.co.za";
const LOGO_URL = `${APP_URL}/brand/logos/wielo-primary-512.png`;

export type ShellPill = { label: string; emoji?: string };

type Props = {
  /** Email-client preview line. Keep under 90 chars. */
  preview: string;
  /** Small uppercase label above the title, e.g. "Looking For". */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Optional status chip, top-right of the header. */
  pill?: ShellPill;
  /** Footer note lines (defaults to the standard Wielo footer copy). */
  footerNote?: string;
  children: React.ReactNode;
};

export default function Shell({
  preview,
  eyebrow,
  title,
  subtitle,
  pill,
  footerNote,
  children,
}: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header band */}
          <Section style={styles.header}>
            <Row>
              <Column style={styles.brandCol}>
                <Link href={APP_URL} style={styles.brandLink}>
                  <Img
                    src={LOGO_URL}
                    width="24"
                    height="24"
                    alt="Wielo"
                    style={styles.logo}
                  />
                  <span style={styles.wordmark}>Wielo</span>
                </Link>
              </Column>
              {pill ? (
                <Column align="right" style={styles.pillCol}>
                  <span style={styles.pill}>
                    {pill.emoji ? `${pill.emoji} ` : ""}
                    {pill.label}
                  </span>
                </Column>
              ) : null}
            </Row>

            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </Section>

          {/* Green accent line */}
          <Section style={styles.accent}>&nbsp;</Section>

          {/* Body */}
          <Section style={styles.content}>{children}</Section>

          {/* Footer */}
          <Hr style={styles.hr} />
          <Section style={styles.footer}>
            <Row>
              <Column>
                <Text style={styles.footerText}>
                  {footerNote ??
                    "Wielo — direct-booking management for accommodation hosts."}
                </Text>
                <Text style={styles.footerText}>
                  <Link href={APP_URL} style={styles.footerLink}>
                    wielo.co.za
                  </Link>
                  {" · "}
                  <Link
                    href={`${APP_URL}/account/notifications`}
                    style={styles.footerLink}
                  >
                    Email preferences
                  </Link>
                </Text>
              </Column>
              <Column align="right" style={styles.footerBrandCol}>
                <Text style={styles.footerBrand}>WIELO</Text>
                <Text style={styles.footerBrandSub}>
                  Direct booking, sorted.
                </Text>
              </Column>
            </Row>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: PAGE_BG,
    fontFamily: "Arial, Helvetica, -apple-system, 'Segoe UI', sans-serif",
    margin: 0,
    padding: "32px 16px",
  },
  container: {
    maxWidth: "600px",
    width: "100%",
    margin: "0 auto",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  header: {
    backgroundColor: BRAND_SECONDARY,
    padding: "26px 36px 22px",
  },
  brandCol: {
    verticalAlign: "middle" as const,
  },
  brandLink: {
    textDecoration: "none",
    display: "inline-block",
  },
  logo: {
    display: "inline-block",
    borderRadius: "50%",
    verticalAlign: "middle" as const,
    marginRight: "8px",
  },
  wordmark: {
    fontSize: "16px",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: HEADER_TITLE,
    verticalAlign: "middle" as const,
  },
  pillCol: {
    verticalAlign: "top" as const,
  },
  pill: {
    backgroundColor: "rgba(16,185,129,0.22)",
    borderRadius: "20px",
    padding: "5px 13px",
    fontSize: "11px",
    fontWeight: 700,
    color: HEADER_EYEBROW,
    whiteSpace: "nowrap" as const,
  },
  eyebrow: {
    margin: "18px 0 4px",
    fontSize: "11px",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: HEADER_EYEBROW,
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 700,
    color: HEADER_TITLE,
    lineHeight: "1.3",
  },
  subtitle: {
    margin: "6px 0 0",
    fontSize: "13px",
    color: HEADER_SUB,
    lineHeight: "1.5",
  },
  accent: {
    height: "3px",
    lineHeight: "3px",
    fontSize: 0,
    backgroundColor: BRAND_PRIMARY,
  },
  content: {
    padding: "30px 36px 8px",
    color: BRAND_INK,
    fontSize: "14px",
    lineHeight: "1.6",
  },
  hr: {
    border: "none",
    borderTop: "1px solid #DCEAE0",
    margin: "8px 36px 0",
    width: "auto",
  },
  footer: {
    padding: "18px 36px 26px",
  },
  footerText: {
    color: "#8AADA5",
    fontSize: "11px",
    lineHeight: "1.5",
    margin: "3px 0",
  },
  footerLink: {
    color: BRAND_MUTE,
    textDecoration: "underline",
  },
  footerBrandCol: {
    verticalAlign: "middle" as const,
  },
  footerBrand: {
    margin: 0,
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: BRAND_SECONDARY,
    textAlign: "right" as const,
  },
  footerBrandSub: {
    margin: "2px 0 0",
    fontSize: "10px",
    color: "#8AADA5",
    textAlign: "right" as const,
  },
};
