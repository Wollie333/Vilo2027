"use server";

import { createElement } from "react";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";
import { EMAIL_REGISTRY } from "@/lib/email/registry";
import { emailFrom } from "@/lib/email/sender";

const previewSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

export type PreviewResult =
  | { ok: true; html: string; subject: string; recipient: string }
  | { ok: false; error: string };

export async function renderPreviewAction(input: {
  type: string;
  payload: Record<string, unknown>;
}): Promise<PreviewResult> {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const entry = EMAIL_REGISTRY[parsed.data.type];
  if (!entry)
    return { ok: false, error: `Unknown template: ${parsed.data.type}` };

  try {
    const html = await render(
      createElement(entry.Template, parsed.data.payload),
    );
    return {
      ok: true,
      html,
      subject: entry.subject(parsed.data.payload),
      recipient: entry.recipient,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Render failed: ${msg}` };
  }
}

const sendTestSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  to: z.string().email(),
  reason: z.string().min(5).max(200),
});

type SendTestArgs = z.infer<typeof sendTestSchema>;

const sendTestInner = withAdminAudit<SendTestArgs, { id: string | null }>(
  {
    permissionKey: "platform.settings",
    actionName: "email.test_send",
    targetType: "platform_setting",
    // No domain row to point at — use the template type as the target id.
    // The action name + payload in the audit row is the real audit signal.
    getTargetId: (a) => a.type,
    requireReason: true,
  },
  async (args) => {
    const entry = EMAIL_REGISTRY[args.type];
    if (!entry) throw new Error(`Unknown template: ${args.type}`);

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");

    const from = emailFrom();
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from,
      to: args.to,
      subject: `[TEST] ${entry.subject(args.payload)}`,
      react: createElement(entry.Template, args.payload),
    });

    if (error) throw new Error(`${error.name}: ${error.message}`);

    return {
      result: { id: data?.id ?? null },
      after: { to: args.to, type: args.type, providerId: data?.id ?? null },
    };
  },
);

export type SendTestResult =
  | { ok: true; providerId: string | null }
  | { ok: false; error: string };

export async function sendTestEmailAction(input: {
  type: string;
  payload: Record<string, unknown>;
  to: string;
  reason: string;
}): Promise<SendTestResult> {
  const parsed = sendTestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    const { id } = await sendTestInner(parsed.data);
    return { ok: true, providerId: id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Send failed.",
    };
  }
}
