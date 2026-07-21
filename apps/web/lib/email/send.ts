import type { ReactElement } from "react";
import { Resend } from "resend";

import { emailFrom } from "@/lib/email/sender";

/**
 * Send a one-off transactional email directly via Resend (outside the
 * notification queue). Use for verified, must-send messages that carry a
 * one-time token in the body (e.g. an enquiry acknowledgement with a magic
 * link) — these can't be re-hydrated by the queue drain later. Best-effort:
 * returns ok/false and never throws, so callers' main flow is unaffected.
 */
export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: emailFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/**
 * Send a one-off transactional email whose body is a React Email component
 * (the shared @vilo/emails Shell templates). Mirrors sendTransactionalEmail but
 * lets auth/enquiry emails use the SAME branded design system as every queued
 * email, instead of hand-rolled inline HTML. Best-effort; never throws.
 */
export async function sendReactEmail(input: {
  to: string;
  subject: string;
  react: ReactElement;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: emailFrom(),
      to: input.to,
      subject: input.subject,
      react: input.react,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
